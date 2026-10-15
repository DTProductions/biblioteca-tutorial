import type { Context } from "hono";
import { InvalidInput } from "../shared/errors";

export function idPositivo(valor: unknown, nome = "Identificador"): number {
  if ((typeof valor !== "string" && typeof valor !== "number") || !/^\d+$/.test(String(valor))) {
    throw new InvalidInput(`${nome} inválido.`);
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) throw new InvalidInput(`${nome} inválido.`);
  return id;
}

export async function corpoJson(c: Context): Promise<Record<string, unknown>> {
  let dados: unknown;
  try { dados = await c.req.json(); } catch { throw new InvalidInput("Corpo JSON inválido."); }
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new InvalidInput("Informe um objeto JSON.");
  }
  return dados as Record<string, unknown>;
}

export function filtroId(valor: string | undefined): number | undefined {
  return valor ? idPositivo(valor) : undefined;
}
