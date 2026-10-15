import { createApp } from "../src/server";
import { buildUseCases } from "../src/composition";
import { createAcervoTablesPostgres } from "../src/modules/acervo";
import { createAutoriaTablesPostgres } from "../src/modules/autoria";
import { carregarCasosDeUso } from "../src/use-cases/loader";

// Cada suíte usa um banco de TESTES. Os fixtures são próprios: nenhuma tabela é apagada.
await createAutoriaTablesPostgres();
await createAcervoTablesPostgres();
const casos = await carregarCasosDeUso();
for (const caso of casos) await caso.preparar?.();
const app = createApp(buildUseCases(), casos);

// O contrato JSON é verificado pelos expects de cada atividade.
export interface RespostaDeTeste extends Response { json<T = any>(): Promise<T> }
export async function api(metodo: string, caminho: string, body?: unknown): Promise<RespostaDeTeste> {
  return app.request(`/api${caminho}`, {
    method: metodo,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  }) as Promise<RespostaDeTeste>;
}

export function nomeDeTeste(prefixo: string): string {
  return `${prefixo} ${crypto.randomUUID()}`;
}

export function isbnDeTeste(): string {
  const numeros = crypto.getRandomValues(new Uint8Array(9));
  const doze = "978" + Array.from(numeros, (n) => n % 10).join("");
  const soma = [...doze].reduce((total, n, i) => total + Number(n) * (i % 2 ? 3 : 1), 0);
  return doze + (10 - soma % 10) % 10;
}

export async function autorDeTeste(tipo = "literatura"): Promise<{ id: number; nome: string }> {
  const response = await api("POST", "/autores", { nome: nomeDeTeste("Autor"), tipo });
  if (response.status !== 201) throw new Error(`Fixture autor: ${await response.text()}`);
  return response.json();
}

export async function livroDeTeste(): Promise<{ id: number; isbn: string; titulo: string; autorId: number; dataCatalogacao: string }> {
  const autor = await autorDeTeste();
  const response = await api("POST", "/livros", { isbn: isbnDeTeste(), titulo: nomeDeTeste("Livro"), autorId: autor.id });
  if (response.status !== 201) throw new Error(`Fixture livro: ${await response.text()}`);
  return response.json();
}

export async function exemplarDeTeste(): Promise<{ id: number; livroId: number; numeroRegistro: string }> {
  const livro = await livroDeTeste();
  const response = await api("POST", "/exemplares", { livroId: livro.id, localizacao: "Estante T", estadoConservacao: "bom" });
  if (response.status !== 201) throw new Error(`Fixture exemplar: ${await response.text()}`);
  return response.json();
}
