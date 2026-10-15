import { buildUseCases } from "./composition";
import { createAcervoTablesPostgres } from "./modules/acervo";
import { createAutoriaTablesPostgres } from "./modules/autoria";
import { createServer } from "./server";

await createAutoriaTablesPostgres();
await createAcervoTablesPostgres();

const server = createServer(buildUseCases());

console.log(`Servidor executando em http://localhost:${server.port}`);
