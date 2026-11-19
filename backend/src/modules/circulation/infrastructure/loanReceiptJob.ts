import type { RedisClient } from "bun";
import { emailSender } from "../../../infrastructure/email";
import { queue, type Job } from "../../../infrastructure/queue";
import type { EmailSender } from "../../../shared/EmailSender";
import { NotImplemented } from "../../../shared/errors";

/** A mensagem leva só o id do empréstimo: o resto, o worker lê na hora de enviar. */
export type LoanReceiptTask = { loanId: number };

/** O que aconteceu com um pedido de comprovante. O worker escreve isso no log. */
export type ReceiptOutcome = "enviado" | "já enviado" | "empréstimo não encontrado" | "sem remetente";

/**
 * Manda o comprovante do empréstimo ao leitor, uma vez só. Lança quando o envio
 * falha: no worker, sem o XACK, a fila entrega a mensagem de novo mais tarde.
 *
 * TODO (atividade): o trabalho que o worker faz com cada mensagem.
 *   1. sem remetente (sender null), devolva "sem remetente" sem tocar em nada;
 *   2. leia o empréstimo no Postgres; se ele não existe, "empréstimo não encontrado";
 *   3. com comprovante_enviado_em preenchida, "já enviado": a fila entrega cada
 *      mensagem pelo menos uma vez, e o leitor não pode receber dois e-mails;
 *   4. pela porta CirculationLookup, busque o nome e o e-mail ATUAIS do leitor e
 *      o título e o número de registro do exemplar (o e-mail mora em Leitores);
 *   5. monte a mensagem com receiptEmail, de ./receiptEmail, e envie com sender.send;
 *   6. marque comprovante_enviado_em e devolva "enviado". Marcar antes ou depois
 *      do envio é decisão sua (justifique no commit), mas um envio que falhou não
 *      pode deixar o comprovante marcado como enviado.
 */
export async function sendLoanReceipt(loanId: number, sender: EmailSender | null = emailSender): Promise<ReceiptOutcome> {
  throw new NotImplemented(`Comprovante (UC19) ainda não implementado: enviar o do empréstimo ${loanId}`);
}

/**
 * UC19: pede o comprovante e volta na hora. Quem chama precisa estar depois do
 * COMMIT do empréstimo.
 *
 * TODO (atividade): siga scheduleBookIndex, em
 * modules/catalog/infrastructure/bookIndexJob.ts:
 *   1. publique { loanId } no stream da tarefa com enqueue, passando `client`;
 *   2. sem fila, ou com ela fora do ar (enqueue devolve null), envie aqui mesmo
 *      com sendLoanReceipt, passando `sender`. Se esse envio falhar, registre um
 *      aviso (console.warn) e siga: o empréstimo já está gravado, e o comprovante
 *      não pode transformá-lo num erro.
 */
export async function scheduleLoanReceipt(
  loanId: number,
  { client = queue, sender = emailSender }: { client?: RedisClient | null; sender?: EmailSender | null } = {},
): Promise<void> {
  throw new NotImplemented(`Comprovante (UC19) ainda não implementado: pedir o do empréstimo ${loanId}`);
}

/**
 * A tarefa do lado do worker, como bookIndexJob.
 *
 * TODO (atividade):
 *   1. stream: monte a chave com redisKey(...), de infrastructure/redis. O
 *      primeiro trecho diz o módulo dono; o teste 1 diz a chave completa, e
 *      `bun run check-boundaries` confere o dono;
 *   2. handle: a mensagem é dado externo, como o corpo de uma requisição. Sem um
 *      loanId inteiro, lance um Error cuja mensagem diga "sem o id do empréstimo";
 *   3. chame sendLoanReceipt com o `sender` recebido e escreva o resultado no log.
 */
export function loanReceiptJob(sender: EmailSender | null = emailSender): Job<LoanReceiptTask> {
  throw new NotImplemented("Comprovante (UC19) ainda não implementado: a tarefa do worker");
}
