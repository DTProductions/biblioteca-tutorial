import type { SQL } from "bun";

export async function prepararLeitores(db: SQL): Promise<void> {
  await db`CREATE TABLE IF NOT EXISTS leitores (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL
  )`;
}
