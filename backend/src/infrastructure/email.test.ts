import { expect, test } from "bun:test";
import { chooseEmailSender, createMailpitSender, createMemorySender } from "./email";

// a suíte manda os e-mails para a memória; só estes testes falam com o Mailpit
const MAILPIT = process.env.TEST_EMAIL_URL ?? "http://mailpit:8025";

const message = (to: string) => ({ to, toName: "Leitor de Teste", subject: "Teste do adaptador", text: "Olá" });

test("sem EMAIL_PROVIDER nem EMAIL_URL, não há remetente", () => {
  expect(chooseEmailSender({})).toBeNull();
});

test("a caixa de saída em memória guarda o que foi enviado", async () => {
  const sender = createMemorySender();
  await sender.send(message("ana@exemplo.com"));
  expect(sender.sent).toEqual([message("ana@exemplo.com")]);
});

test("o Mailpit recebe o e-mail pelo adaptador HTTP", async () => {
  const to = `${crypto.randomUUID()}@exemplo.com`;
  await createMailpitSender(MAILPIT).send(message(to));
  const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json() as {
    messages_count: number;
    messages: { ID: string; Subject: string; To: { Name: string; Address: string }[] }[];
  };
  // apaga o e-mail do teste: a caixa de http://localhost:8025 fica só com os da aplicação.
  // Sem nenhum ID, o Mailpit apagaria a caixa inteira; por isso o if.
  const ids = found.messages.map((m) => m.ID);
  if (ids.length > 0) {
    await fetch(`${MAILPIT}/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: ids }),
    });
  }
  expect(found.messages_count).toBe(1);
  expect(found.messages[0]).toMatchObject({ Subject: "Teste do adaptador", To: [{ Name: "Leitor de Teste", Address: to }] });
});

test("com o provedor fora do ar, o envio lança", async () => {
  await expect(createMailpitSender("http://127.0.0.1:1").send(message("ana@exemplo.com"))).rejects.toThrow();
});
