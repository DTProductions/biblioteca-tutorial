import { sql } from "./infrastructure/postgres";
import { createAcervoTablesPostgres } from "./modules/acervo";
import { createAutoriaTablesPostgres } from "./modules/autoria";
import { carregarCasosDeUso } from "./use-cases/loader";
import { executarSeed } from "./seed/executar";

try {
  await createAutoriaTablesPostgres();
  await createAcervoTablesPostgres();
  for (const caso of await carregarCasosDeUso()) await caso.preparar?.();
  console.log(JSON.stringify(await executarSeed(), null, 2));
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally { await sql.close(); }
