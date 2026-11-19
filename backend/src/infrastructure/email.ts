import type { Email, EmailSender } from "../shared/EmailSender";

/** Quem assina os e-mails da biblioteca. */
const FROM = { Email: "nao-responda@biblioteca.local", Name: "Biblioteca" };

/**
 * O Mailpit faz o papel do provedor de e-mail: recebe pela API HTTP e mostra
 * cada mensagem numa caixa de entrada web, sem entregar nada a ninguém. Os
 * provedores de verdade (Amazon SES, Resend, Postmark...) também recebem por
 * HTTP: trocar de provedor é trocar este adaptador.
 *
 * O envio desiste depois de `timeoutMs`. Um provedor travado não pode prender o
 * worker para sempre, e o prazo precisa ser menor que o tempo que a fila espera
 * para entregar a mensagem de novo (retryAfterMs, 10 s em queue.ts).
 */
export function createMailpitSender(url: string, timeoutMs = 5000): EmailSender {
  return {
    async send(email) {
      const response = await fetch(new URL("/api/v1/send", url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: FROM,
          To: [{ Email: email.to, Name: email.toName }],
          Subject: email.subject,
          Text: email.text,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`O provedor de e-mail respondeu ${response.status}: ${await response.text()}`);
    },
  };
}

/** Uma caixa de saída em memória: o teste confere o que foi enviado, sem rede. */
export type MemorySender = EmailSender & { readonly sent: Email[] };

export function createMemorySender(): MemorySender {
  const sent: Email[] = [];
  return {
    sent,
    async send(email) {
      sent.push(email);
    },
  };
}

/**
 * Escolhe o remetente pelo ambiente, como o embedder. A suíte usa
 * EMAIL_PROVIDER=memory; o app e o worker, o Mailpit do compose (EMAIL_URL).
 * Sem nenhum dos dois, null: nada é enviado.
 */
export function chooseEmailSender(env: Record<string, string | undefined>): EmailSender | null {
  if (env.EMAIL_PROVIDER === "memory") return createMemorySender();
  if (env.EMAIL_URL) return createMailpitSender(env.EMAIL_URL);
  return null;
}

export const emailSender: EmailSender | null = chooseEmailSender(process.env);
