import { cadastrarLivro, prepararCatalogo } from "./modules/acervo/catalogo";
import { integracaoDoCatalogo } from "./adapters/acervoIntegracao";
import { createAutoriaTablesPostgres } from "./modules/autoria";

await createAutoriaTablesPostgres();
await prepararCatalogo();

const path = process.argv[2];

if (!path) {
  console.error("uso: bun run importar <arquivo.csv>");
  process.exit(1);
}

const content = await Bun.file(path).text();
const rows = content.trim().split("\n").slice(1);

let importados = 0;
let rejeitados = 0;

for (const row of rows) {
  const [isbn, titulo, autorId] = row.split(",") as [string, string, string];

  try {
    await cadastrarLivro({ isbn, titulo, autorId: Number(autorId) }, integracaoDoCatalogo);
    importados++;
  } catch (error) {
    console.log(`linha rejeitada (${(error as Error).message}): ${row}`);
    rejeitados++;
  }
}

console.log(`importados: ${importados} | rejeitados: ${rejeitados}`);
