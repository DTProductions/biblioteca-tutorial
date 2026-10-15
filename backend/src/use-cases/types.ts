import type { Hono } from "hono";

/** Um ponto de composição por atividade: adicionar uma UC não altera as demais. */
export type CasoDeUso = {
  id: string;
  preparar?: () => Promise<void>;
  registrar: (api: Hono) => void;
};
