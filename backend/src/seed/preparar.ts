import type { SQL } from "bun";

export async function prepararSeed(db: SQL): Promise<void> {
  await db.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(22001)`;
    await tx`CREATE TABLE IF NOT EXISTS seed_execucoes (versao TEXT PRIMARY KEY, data_referencia TEXT NOT NULL, resumo JSONB NOT NULL)`;
    await tx`CREATE TABLE IF NOT EXISTS seed_registros (versao TEXT NOT NULL, entidade TEXT NOT NULL, registro_id INTEGER NOT NULL, PRIMARY KEY (versao, entidade, registro_id))`;
  });
}
