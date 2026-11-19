import { RedisClient } from "bun";

// O worker: outro processo, sem porta e sem página. Ele só busca trabalho na fila.
//   bun worker.ts            um worker chamado worker-<pid>
//   bun worker.ts chapa-2    dê um nome a cada um para acompanhar no terminal
const queue = new RedisClient("redis://localhost:6400");

const STREAM = "pedidos";
const GROUP = "workers";
const DEAD = `${STREAM}:mortas`; // a fila de mensagens mortas
const CONSUMER = process.argv[2] ?? `worker-${process.pid}`;

const PREP_MS = 3000; // quanto demora preparar um lanche
const RETRY_AFTER_MS = 8000; // pendente há mais tempo que isso volta a ser entregue
const MAX_DELIVERIES = 3; // se a terceira entrega falhar, a mensagem vai para as mortas

type Entry = [id: string, fields: string[]];

// 1. O grupo. "0": entregar desde a primeira mensagem do stream, inclusive as
//    publicadas antes de existir um worker. MKSTREAM cria o stream se ele faltar.
try {
  await queue.send("XGROUP", ["CREATE", STREAM, GROUP, "0", "MKSTREAM"]);
} catch (error) {
  // BUSYGROUP: o grupo já existe, outro worker criou antes. Não é erro.
  if (!String(error).includes("BUSYGROUP")) throw error;
}

// 2. O trabalho de verdade. Lança um erro quando não consegue.
async function prepare(senha: number) {
  const key = `pedido:${senha}`;
  const order = await queue.hgetall(key);
  // a mesma mensagem pode chegar duas vezes: o que já está pronto não é refeito
  if (order.status === "pronto") return;
  if (order.item === "pedra") throw new Error("não sei fazer sopa de pedra");

  await queue.send("HSET", [key, "status", "em preparo", "worker", CONSUMER]);
  Bun.sleepSync(PREP_MS); // o trabalho lento, agora fora do servidor web
  await queue.send("HSET", [key, "status", "pronto"]);
}

// 3. Uma entrega: primeiro trabalha, depois confirma.
async function run([id, fields]: Entry, deliveries: number) {
  const { senha } = JSON.parse(fields[1]); // fields = ["dados", '{"senha":7}']
  await queue.send("HSET", [`pedido:${senha}`, "tentativas", String(deliveries)]);
  try {
    await prepare(senha);
    // XACK: só agora a fila fica sabendo que deu certo
    await queue.send("XACK", [STREAM, GROUP, id]);
    console.log(`✓ pedido ${senha} pronto (tentativa ${deliveries})`);
  } catch (error) {
    const reason = (error as Error).message;
    if (deliveries < MAX_DELIVERIES) {
      // sem XACK, a mensagem continua pendente e volta depois de RETRY_AFTER_MS
      console.log(`✗ pedido ${senha} falhou na tentativa ${deliveries}: ${reason}`);
      return;
    }
    // Desistir também é uma decisão: a mensagem sai da fila, mas não some.
    // Ela vai para outro stream, com o motivo, para uma pessoa olhar depois.
    await queue.send("XADD", [DEAD, "*", ...fields, "erro", reason, "origem", id]);
    await queue.send("XACK", [STREAM, GROUP, id]);
    await queue.send("HSET", [`pedido:${senha}`, "status", "falhou"]);
    console.log(`☠ pedido ${senha} foi para as mortas depois de ${deliveries} tentativas: ${reason}`);
  }
}

// 4. Pendentes paradas: um worker recebeu a mensagem e não confirmou a tempo.
async function retryStuck() {
  // XPENDING ... IDLE: [[id, worker, ms parada, entregas], ...]
  const stuck = await queue.send("XPENDING", [STREAM, GROUP, "IDLE", String(RETRY_AFTER_MS), "-", "+", "10"]);
  for (const [id, , , deliveries] of stuck) {
    // XCLAIM passa a mensagem para este worker. Se outro worker pegou antes, volta vazio.
    const claimed: Entry[] = await queue.send("XCLAIM", [STREAM, GROUP, CONSUMER, String(RETRY_AFTER_MS), id]);
    for (const entry of claimed) await run(entry, deliveries + 1);
  }
}

// 5. Mensagens novas (">"): as que nunca foram entregues a ninguém do grupo.
async function readNew() {
  // BLOCK 2000: espera até 2 s por uma mensagem, em vez de perguntar sem parar
  const reply = await queue.send("XREADGROUP", [
    "GROUP", GROUP, CONSUMER, "COUNT", "1", "BLOCK", "2000", "STREAMS", STREAM, ">",
  ]);
  // a resposta é { pedidos: [[id, campos]] }, ou null quando nada chegou
  for (const entry of reply?.[STREAM] ?? []) await run(entry, 1);
}

console.log(`${CONSUMER} esperando pedidos`);
while (true) {
  try {
    await retryStuck(); // primeiro as que ficaram para trás
    await readNew(); // depois as novas
  } catch (error) {
    // a fila saiu do ar: o worker espera e tenta de novo, em vez de morrer
    console.log(`fila fora do ar (${(error as Error).message}); nova tentativa em 1 s`);
    await Bun.sleep(1000);
  }
}
