import { InvalidInput } from "../../../shared/errors";
import { getBodyAsObject, getFieldAsText } from "../../../shared/validation";
import type { TipoDeAutor } from "./Autor";

export type DadosDoAutor = { nome: string; tipo: TipoDeAutor };

export function dadosDoAutor(body: unknown): DadosDoAutor {
  const data = getBodyAsObject(body);
  const tipo = getFieldAsText(data, "tipo");
  if (tipo !== "literatura" && tipo !== "didatico") throw new InvalidInput("Tipo deve ser literatura ou didatico");
  return { nome: getFieldAsText(data, "nome"), tipo };
}
