import { getBodyAsObject, getFieldAsText } from "../../../shared/validation";

export type DadosFisicos = { localizacao: string; estadoConservacao: string };
export function dadosFisicos(body: unknown): DadosFisicos {
  const data = getBodyAsObject(body);
  return { localizacao: getFieldAsText(data, "localizacao"), estadoConservacao: getFieldAsText(data, "estadoConservacao") };
}
