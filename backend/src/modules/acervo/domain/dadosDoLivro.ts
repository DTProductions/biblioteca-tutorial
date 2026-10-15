import { getBodyAsObject, getFieldAsPositiveInt, getFieldAsText } from "../../../shared/validation";
import { Isbn } from "./Isbn";

export type DadosDoLivro = { isbn: string; titulo: string; autorId: number };

export function dadosDoLivro(body: unknown): DadosDoLivro {
  const data = getBodyAsObject(body);
  return {
    isbn: new Isbn(getFieldAsText(data, "isbn")).value,
    titulo: getFieldAsText(data, "titulo"),
    autorId: getFieldAsPositiveInt(data, "autorId"),
  };
}

export function identificador(raw: unknown): number {
  return getFieldAsPositiveInt({ id: raw }, "id");
}

export function diaDoCatalogo(agora: Date): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
