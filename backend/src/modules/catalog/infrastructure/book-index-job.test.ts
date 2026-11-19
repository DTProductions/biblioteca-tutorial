import { afterAll, expect, test } from "bun:test";
import { api, testAuthor, testIsbn } from "#tests/api";
import { prepareGroups, workOnce } from "../../../infrastructure/queue";
import { createRedis, ready, redis } from "../../../infrastructure/redis";
import { catalogIntegration } from "../../../integration/catalogIntegration";
import { bookIndexKey } from "./bookIndex";
import { BOOK_INDEX_STREAM, bookIndexJob, scheduleBookIndex } from "./bookIndexJob";

// a suíte roda sem QUEUE_URL; aqui o cliente da fila é explícito
const queue = createRedis(process.env.TEST_QUEUE_URL ?? "redis://fila:6379");
afterAll(() => queue.close());

const job = bookIndexJob(catalogIntegration);
const options = { client: queue, consumer: "teste", blockMs: null, retryAfterMs: 300, maxDeliveries: 2 };

async function createBook(): Promise<{ id: number }> {
  const author = await testAuthor();
  const response = await api("POST", "/livros", { isbn: testIsbn(), titulo: `Livro ${crypto.randomUUID().slice(0, 8)}`, autorId: author.id });
  expect(response.status).toBe(201);
  return response.json();
}

async function indexed(id: number): Promise<boolean> {
  return await (await ready(redis!)).exists(bookIndexKey(id));
}

test("UC01: sem fila, o livro é indexado na hora, dentro da requisição", async () => {
  const book = await createBook();
  expect(await indexed(book.id)).toBe(true);
});

test("UC01: com fila, a requisição só publica, e o worker indexa", async () => {
  const book = await createBook();
  await redis!.del(bookIndexKey(book.id));
  await prepareGroups([job], queue);
  await scheduleBookIndex([book.id], catalogIntegration, queue);
  // publicou e voltou: ninguém indexou ainda
  expect(await indexed(book.id)).toBe(false);
  await workOnce([job], options);
  expect(await indexed(book.id)).toBe(true);
});

test("UC04: o worker também tira do índice o livro excluído", async () => {
  const book = await createBook();
  expect((await api("DELETE", `/livros/${book.id}`)).status).toBe(204);
  await redis!.send("HSET", [bookIndexKey(book.id), "texto", "sobra de um índice antigo"]);
  await prepareGroups([job], queue);
  await scheduleBookIndex([book.id], catalogIntegration, queue);
  await workOnce([job], options);
  expect(await indexed(book.id)).toBe(false);
});

test("tarefa sem ids falha, e a fila decide o que fazer com ela", async () => {
  await expect(job.handle({ ids: "1" } as never)).rejects.toThrow("sem a lista de ids");
});

test("o stream da indexação tem dono: o acervo", () => {
  expect(BOOK_INDEX_STREAM).toBe(`${process.env.REDIS_PREFIX ?? "biblioteca"}:acervo:fila:indice-livros`);
});
