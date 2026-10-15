import { buildUseCases } from "./composition";
import { createAcervoTablesPostgres } from "./modules/acervo";
import { createAutoriaTablesPostgres } from "./modules/autoria";
import { createServer } from "./server";
import { carregarCasosDeUso } from "./use-cases/loader";

await createAutoriaTablesPostgres();
await createAcervoTablesPostgres();

const casos = await carregarCasosDeUso();
for (const caso of casos) await caso.preparar?.();

const server = createServer(buildUseCases(), Number(process.env.PORT ?? 3000), casos);

console.log(`Servidor executando em http://localhost:${server.port}`);
