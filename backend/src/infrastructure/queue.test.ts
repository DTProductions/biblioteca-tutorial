import { afterAll, expect, test } from "bun:test";
import { deadLetterStream, enqueue, prepareGroups, workOnce, type Job } from "./queue";
import { createRedis } from "./redis";

// a suíte roda sem QUEUE_URL; os testes da fila usam o serviço fila pelo TEST_QUEUE_URL
const client = createRedis(process.env.TEST_QUEUE_URL ?? "redis://fila:6379");
afterAll(() => client.close());

/** Um stream novo por teste, no prefixo dos testes. */
function stream(): string {
  return `${process.env.REDIS_PREFIX ?? "biblioteca"}:testes-da-fila:${crypto.randomUUID()}`;
}

// sem espera: cada volta lê o que há e devolve o controle ao teste
const options = { client, consumer: "teste", blockMs: null, retryAfterMs: 300, maxDeliveries: 2 };

async function pending(key: string): Promise<number> {
  const [count] = await client.send("XPENDING", [key, "workers"]) as [number];
  return count;
}

test("a fila entrega a mensagem e o XACK a tira das pendentes", async () => {
  const received: unknown[] = [];
  const job: Job = { stream: stream(), handle: async (data) => { received.push(data); } };
  expect(await enqueue(job.stream, { ids: [7] }, client)).toMatch(/^\d+-\d+$/);
  // o grupo nasce depois da mensagem e, ainda assim, a recebe: começa do "0"
  await prepareGroups([job], client);
  expect(await workOnce([job], options)).toBe(1);
  expect(received).toEqual([{ ids: [7] }]);
  expect(await pending(job.stream)).toBe(0);
});

test("sem XACK a mensagem volta, e outra tentativa a conclui", async () => {
  let calls = 0;
  const job: Job = { stream: stream(), handle: async () => { if (++calls === 1) throw new Error("Gemini fora do ar"); } };
  await prepareGroups([job], client);
  await enqueue(job.stream, { ids: [1] }, client);
  await workOnce([job], options);
  expect(await pending(job.stream)).toBe(1);
  // antes de retryAfterMs, ninguém pega a mensagem de volta
  expect(await workOnce([job], options)).toBe(0);
  await Bun.sleep(400);
  expect(await workOnce([job], options)).toBe(1);
  expect(calls).toBe(2);
  expect(await pending(job.stream)).toBe(0);
});

test("esgotadas as tentativas, a mensagem vai para a fila de mortas", async () => {
  const job: Job = { stream: stream(), handle: async () => { throw new Error("sempre falha"); } };
  await prepareGroups([job], client);
  await enqueue(job.stream, { ids: [2] }, client);
  await workOnce([job], options);
  await Bun.sleep(400);
  await workOnce([job], options);
  expect(await pending(job.stream)).toBe(0);
  const dead = await client.send("XRANGE", [deadLetterStream(job.stream), "-", "+"]) as [string, string[]][];
  expect(dead).toHaveLength(1);
  const fields = dead[0]![1];
  expect(fields[fields.indexOf("erro") + 1]).toBe("sempre falha");
  expect(fields[fields.indexOf("dados") + 1]).toBe(JSON.stringify({ ids: [2] }));
});

test("mensagem que nem é JSON também acaba na fila de mortas", async () => {
  const job: Job = { stream: stream(), handle: async () => {} };
  await prepareGroups([job], client);
  await client.send("XADD", [job.stream, "*", "dados", "{quebrado"]);
  await workOnce([job], options);
  await Bun.sleep(400);
  await workOnce([job], options);
  expect(await client.send("XLEN", [deadLetterStream(job.stream)])).toBe(1);
});

test("dois workers no mesmo grupo dividem as mensagens", async () => {
  const seen: string[] = [];
  const job: Job<{ n: number }> = { stream: stream(), handle: async ({ n }) => { seen.push(`m${n}`); } };
  await prepareGroups([job], client);
  for (const n of [1, 2, 3, 4]) await enqueue(job.stream, { n }, client);
  const first = await workOnce([job], { ...options, consumer: "a" });
  const second = await workOnce([job], { ...options, consumer: "b" });
  // COUNT 10: o primeiro leva tudo o que havia; o segundo não recebe nada repetido
  expect(first + second).toBe(4);
  expect(seen.sort()).toEqual(["m1", "m2", "m3", "m4"]);
});

test("sem fila, ou com ela fora do ar, enqueue devolve null", async () => {
  expect(await enqueue(stream(), { ids: [1] }, null)).toBeNull();
  const dead = createRedis("redis://127.0.0.1:1", { autoReconnect: false });
  expect(await enqueue(stream(), { ids: [1] }, dead)).toBeNull();
});
