import { InvalidInput } from "../../../shared/errors";

export type DadosLeitor = { nome: string; cpf: string; email: string; telefone: string };
export type Leitor = DadosLeitor & { id: number };

/** O CPF identifica o leitor; pontuação não faz parte do valor persistido. */
export function normalizarCpf(valor: string): string {
  if (!/^[\d.\-\s]+$/.test(valor)) throw new InvalidInput("CPF inválido.");
  const cpf = valor.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    throw new InvalidInput("CPF inválido.");
  }
  for (const tamanho of [9, 10]) {
    const soma = [...cpf.slice(0, tamanho)].reduce(
      (total, digito, indice) => total + Number(digito) * (tamanho + 1 - indice), 0,
    );
    const resto = (soma * 10) % 11;
    if (Number(cpf[tamanho]) !== (resto === 10 ? 0 : resto)) {
      throw new InvalidInput("CPF inválido.");
    }
  }
  return cpf;
}

export function validarDadosLeitor(entrada: unknown): DadosLeitor {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    throw new InvalidInput("Informe os dados do leitor.");
  }
  const dados = entrada as Record<string, unknown>;
  function texto(campo: string): string {
    const valor = dados[campo];
    if (typeof valor !== "string" || !valor.trim()) {
      throw new InvalidInput(`O campo ${campo} é obrigatório.`);
    }
    return valor.trim();
  }
  const nome = texto("nome");
  const cpf = normalizarCpf(texto("cpf"));
  const email = texto("email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvalidInput("E-mail inválido.");
  const telefoneInformado = texto("telefone");
  if (!/^[\d\s()+.\-]+$/.test(telefoneInformado)) throw new InvalidInput("Telefone inválido.");
  const telefone = telefoneInformado.replace(/\D/g, "");
  if (telefone.length < 10 || telefone.length > 15) throw new InvalidInput("Telefone inválido.");
  return { nome, cpf, email, telefone };
}
