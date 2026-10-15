import { api, nomeDeTeste } from "./suporte-api";
import type { Leitor } from "../src/modules/leitores/domain/Leitor";

export function cpfDeTeste(): string {
  let cpf = Array.from(crypto.getRandomValues(new Uint8Array(9)), n => String(n % 10)).join("");
  if (/^(\d)\1{8}$/.test(cpf)) return cpfDeTeste();
  for (const tamanho of [9, 10]) {
    const soma = [...cpf].reduce((total, digito, indice) => total + Number(digito) * (tamanho + 1 - indice), 0);
    const resto = (soma * 10) % 11;
    cpf += resto === 10 ? "0" : String(resto);
  }
  return cpf;
}

export async function leitorDeTeste(): Promise<Leitor> {
  const response = await api("POST", "/leitores", {
    nome: nomeDeTeste("Leitor"), cpf: cpfDeTeste(),
    email: `${crypto.randomUUID()}@exemplo.com`, telefone: "27999991234",
  });
  if (response.status !== 201) throw new Error(`Fixture leitor: ${await response.text()}`);
  return response.json();
}
