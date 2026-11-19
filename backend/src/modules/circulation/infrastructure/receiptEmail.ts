import type { Email } from "../../../shared/EmailSender";

/** O que vai no comprovante: lido do empréstimo, do leitor e do exemplar na hora de enviar. */
export type ReceiptDetails = {
  loanId: number;
  readerName: string;
  readerEmail: string;
  bookTitle: string;
  registrationNumber: string;
  /** AAAA-MM-DD, como no banco */
  loanedOn: string;
  /** AAAA-MM-DD, como no banco */
  dueOn: string;
};

/** 2026-12-03 vira 03/12/2026. */
export function brazilianDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * O texto do comprovante. Está pronto: a atividade é sobre quando e quantas
 * vezes ele sai, não sobre o que ele diz.
 */
export function receiptEmail(details: ReceiptDetails): Email {
  return {
    to: details.readerEmail,
    toName: details.readerName,
    subject: `Comprovante de empréstimo: ${details.bookTitle}`,
    text: [
      `Olá, ${details.readerName}.`,
      "",
      `Empréstimo nº ${details.loanId}, registrado em ${brazilianDate(details.loanedOn)}:`,
      `${details.bookTitle}, exemplar ${details.registrationNumber}.`,
      "",
      `Devolva até ${brazilianDate(details.dueOn)}.`,
      "",
      "Biblioteca",
    ].join("\n"),
  };
}
