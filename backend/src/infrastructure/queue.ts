import type { RedisClient } from "bun";
import { createRedis, ready } from "./redis";

/**
 * A fila mora num Redis só dela (o serviço fila do compose), com volume: ao
 * contrário do cache, o que está ali é trabalho que ainda não foi feito. Sem
 * QUEUE_URL o cliente é null, e cada caso de uso faz o trabalho na hora, dentro
 * da requisição, como era antes desta aula.
 */
export const queue: RedisClient | null = process.env.QUEUE_URL ? createRedis(process.env.QUEUE_URL) : null;

/** Um grupo só: cada mensagem é entregue a UM dos workers do grupo. */
const GROUP = "workers";

/** A fila não é arquivo: cada stream guarda até umas 10 mil mensagens. */
const MAX_LENGTH = "10000";

/** Uma tarefa: o stream de onde ela vem e o que fazer com cada mensagem. */
export type Job<T = any> = {
  /** a chave do stream; o primeiro trecho diz o módulo dono, como toda chave do Redis */
  stream: string;
  /** lança quando falha: sem confirmação, a mensagem volta para a fila */
  handle: (data: T) => Promise<void>;
};

export type WorkerOptions = {
  client: RedisClient;
  /** o nome deste worker dentro do grupo */
  consumer: string;
  /** quanto o XREADGROUP espera por mensagem nova; null não espera */
  blockMs?: number | null;
  /** uma mensagem sem confirmação há este tempo volta a ser entregue */
  retryAfterMs?: number;
  /** na última entrega que falhar, a mensagem vai para a fila de mortas */
  maxDeliveries?: number;
};

type Settings = Required<WorkerOptions>;
type Entry = [id: string, fields: string[]];

const DEFAULTS = { blockMs: 5000, retryAfterMs: 10_000, maxDeliveries: 5 };

/** Onde ficam as mensagens que esgotaram as tentativas, para alguém olhar. */
export function deadLetterStream(stream: string): string {
  return `${stream}:mortas`;
}

/**
 * Publica a tarefa e devolve o id da mensagem; null quando não há fila ou ela
 * não respondeu. A mensagem leva só identificadores, nunca o objeto inteiro:
 * quando o worker for trabalhar, ele lê o estado atual no Postgres.
 */
export async function enqueue(stream: string, data: unknown, client: RedisClient | null = queue): Promise<string | null> {
  if (!client) return null;
  try {
    await ready(client);
    return await client.send("XADD", [stream, "MAXLEN", "~", MAX_LENGTH, "*", "dados", JSON.stringify(data)]) as string;
  } catch (error) {
    console.warn("Fila indisponível:", (error as Error).message);
    return null;
  }
}

/**
 * Cria o grupo de cada stream. Começa do "0", e não do "$": o que foi publicado
 * antes de existir algum worker também é entregue. Criar de novo não é erro.
 */
export async function prepareGroups(jobs: Job[], client: RedisClient): Promise<void> {
  await ready(client);
  for (const job of jobs) {
    try {
      await client.send("XGROUP", ["CREATE", job.stream, GROUP, "0", "MKSTREAM"]);
    } catch (error) {
      if (!/BUSYGROUP/.test((error as Error).message)) throw error;
    }
  }
}

/** Executa uma mensagem. Só o XACK tira a mensagem da lista de pendentes. */
async function run(job: Job, [id, fields]: Entry, deliveries: number, settings: Settings): Promise<void> {
  const { client, maxDeliveries } = settings;
  try {
    await job.handle(JSON.parse(fields[fields.indexOf("dados") + 1] ?? "null"));
    await client.send("XACK", [job.stream, GROUP, id]);
  } catch (error) {
    const reason = (error as Error).message;
    if (deliveries < maxDeliveries) {
      // sem XACK, a mensagem continua pendente e volta depois de retryAfterMs
      console.warn(`Tarefa ${id} de ${job.stream} falhou na tentativa ${deliveries}: ${reason}`);
      return;
    }
    // desistir também é uma decisão: a mensagem sai da fila, mas não some
    await client.send("XADD", [deadLetterStream(job.stream), "*", ...fields, "erro", reason, "origem", id]);
    await client.send("XACK", [job.stream, GROUP, id]);
    console.warn(`Tarefa ${id} de ${job.stream} foi para a fila de mortas depois de ${deliveries} tentativa(s): ${reason}`);
  }
}

/**
 * Pendentes há mais de retryAfterMs: o worker que as recebeu falhou ou caiu sem
 * confirmar. O XPENDING diz quantas vezes cada uma já foi entregue; o XCLAIM
 * passa a mensagem para este worker e confere de novo o tempo parado, então
 * dois workers nunca pegam a mesma.
 */
async function retryStuck(job: Job, settings: Settings): Promise<number> {
  const { client, consumer, retryAfterMs } = settings;
  const stuck = await client.send("XPENDING", [job.stream, GROUP, "IDLE", String(retryAfterMs), "-", "+", "10"]) as [string, string, number, number][];
  let handled = 0;
  for (const [id, , , deliveries] of stuck) {
    const claimed = await client.send("XCLAIM", [job.stream, GROUP, consumer, String(retryAfterMs), id]) as Entry[];
    for (const entry of claimed) {
      await run(job, entry, deliveries + 1, settings);
      handled++;
    }
  }
  return handled;
}

/** Mensagens novas (">"): nunca entregues a ninguém do grupo. */
async function readNew(jobs: Job[], settings: Settings): Promise<number> {
  const { client, consumer, blockMs } = settings;
  const args = ["GROUP", GROUP, consumer, "COUNT", "10"];
  if (blockMs !== null) args.push("BLOCK", String(blockMs));
  args.push("STREAMS", ...jobs.map((job) => job.stream), ...jobs.map(() => ">"));
  // em RESP3, a resposta é um mapa { stream: [[id, campos], ...] }; null quando nada chegou
  const reply = await client.send("XREADGROUP", args) as Record<string, Entry[]> | null;
  if (!reply) return 0;
  let handled = 0;
  for (const job of jobs) {
    for (const entry of reply[job.stream] ?? []) {
      await run(job, entry, 1, settings);
      handled++;
    }
  }
  return handled;
}

/** Uma volta do worker: primeiro as que ficaram pendentes, depois as novas. */
export async function workOnce(jobs: Job[], options: WorkerOptions): Promise<number> {
  const settings = { ...DEFAULTS, ...options } as Settings;
  await ready(settings.client);
  let handled = 0;
  for (const job of jobs) handled += await retryStuck(job, settings);
  return handled + await readNew(jobs, settings);
}

/**
 * O laço do worker. Para no SIGTERM (docker compose stop): fecha a conexão, o
 * que interrompe o XREADGROUP bloqueado. Uma tarefa interrompida no meio não foi
 * confirmada, então outro worker a pega depois: a entrega é "pelo menos uma vez".
 */
export async function work(jobs: Job[], options: WorkerOptions): Promise<void> {
  let running = true;
  const stop = () => {
    running = false;
    options.client.close();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  while (running) {
    try {
      await prepareGroups(jobs, options.client);
      while (running) await workOnce(jobs, options);
    } catch (error) {
      if (!running) break;
      // fila fora do ar ou recriada sem os grupos: espera e começa de novo
      console.warn("Fila indisponível:", (error as Error).message);
      await Bun.sleep(1000);
    }
  }
}
