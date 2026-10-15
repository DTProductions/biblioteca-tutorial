/** O que a API devolve para cada livro (o LivroJson do backend). */
export type Livro = {
  id: number;
  numeroRegistro: string;
  isbn: string;
  titulo: string;
  autor: string;
  livrosDoAutor: number;
  dataCatalogacao: string;
};

/** O que a API espera para cadastrar um livro. */
export type NovoLivro = {
  isbn: string;
  titulo: string;
  autorId: number;
};

/** Lê o JSON da resposta. Se a API recusou, lança o { error } que ela mandou. */
async function lerJson<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(corpo.error ?? `Erro ${resposta.status}`);
  }

  return corpo as T;
}

export async function buscarLivros(termo: string): Promise<Livro[]> {
  const resposta = await fetch(`/api/livros/${encodeURIComponent(termo)}`);

  return lerJson<Livro[]>(resposta);
}

export async function cadastrarLivro(livro: NovoLivro): Promise<Livro> {
  const resposta = await fetch("/api/livros", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(livro),
  });

  return lerJson<Livro>(resposta);
}

/** "2026-10-01" → "01/10/2026", sem passar por Date (e sem erro de fuso). */
export function formatarData(iso: string): string {
  return iso.split("-").reverse().join("/");
}
