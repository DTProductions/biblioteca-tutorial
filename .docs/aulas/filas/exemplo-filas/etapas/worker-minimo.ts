import { RedisClient } from "bun";

// O worker: outro processo, sem porta e sem página. Ele só busca trabalho na fila.
//   bun worker.ts            um worker chamado worker-<pid>
//   bun worker.ts chapa-2    dê um nome a cada um para acompanhar no terminal
const queue = new RedisClient("redis://localhost:6400");

const STREAM = "pedidos";
const GROUP = "workers";
const CONSUMER = process.argv[2] ?? `worker-${process.pid}`;

const PREP_MS = 3000; // quanto demora preparar um lanche

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
  if (order.item === "pedra") throw new Error("não sei fazer sopa de pedra");

  await queue.send("HSET", [key, "status", "em preparo", "worker", CONSUMER]);
  Bun.sleepSync(PREP_MS); // o trabalho lento, agora fora do servidor web
  await queue.send("HSET", [key, "status", "pronto"]);
}

// 3. Uma entrega: primeiro trabalha, depois confirma.
async function run([id, fields]: Entry) {
  const { senha } = JSON.parse(fields[1]); // fields = ["dados", '{"senha":7}']
  await prepare(senha);
  // XACK: só agora a fila fica sabendo que deu certo
  await queue.send("XACK", [STREAM, GROUP, id]);
  console.log(`✓ pedido ${senha} pronto`);
}

// 4. Mensagens novas (">"): as que nunca foram entregues a ninguém do grupo.
async function readNew() {
  // BLOCK 2000: espera até 2 s por uma mensagem, em vez de perguntar sem parar
  const reply = await queue.send("XREADGROUP", [
    "GROUP", GROUP, CONSUMER, "COUNT", "1", "BLOCK", "2000", "STREAMS", STREAM, ">",
  ]);
  // a resposta é { pedidos: [[id, campos]] }, ou null quando nada chegou
  for (const entry of reply?.[STREAM] ?? []) await run(entry);
}

console.log(`${CONSUMER} esperando pedidos`);
while (true) await readNew();
