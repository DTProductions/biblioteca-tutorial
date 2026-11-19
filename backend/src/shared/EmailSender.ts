/** Um e-mail de texto simples, para um destinatário. */
export type Email = {
  /** o endereço de quem recebe */
  to: string;
  /** o nome de quem recebe, como aparece na caixa de entrada */
  toName: string;
  subject: string;
  text: string;
};

/**
 * Port: mandar um e-mail. O domínio não sabe se quem entrega é o Mailpit, um
 * provedor de verdade ou a caixa de saída em memória dos testes. Lança quando o
 * envio falha: quem chamou decide se tenta de novo ou desiste.
 */
export type EmailSender = {
  send(email: Email): Promise<void>;
};
