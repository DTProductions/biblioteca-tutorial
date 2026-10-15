/** Contrato público da API. Livro é o catálogo; exemplar é a cópia física. */
export type Livro = {
  id: number;
  isbn: string;
  titulo: string;
  autorId: number;
  autor: string;
  livrosDoAutor: number;
  dataCatalogacao: string;
  totalExemplares: number;
  exemplaresDisponiveis: number;
};

export type NovoLivro = { isbn: string; titulo: string; autorId: number };
export type Autor = { id: number; nome: string; tipo: "literatura" | "didatico"; livrosNoAcervo: number };
export type Leitor = { id: number; nome: string; cpf: string; email: string; telefone: string };
export type Exemplar = {
  id: number;
  livroId: number;
  numeroRegistro: string;
  localizacao: string;
  estadoConservacao: string;
  dataCatalogacao: string;
  situacao: "disponivel" | "reservado" | "emprestado";
  titulo: string;
  isbn: string;
};
export type Reserva = {
  id: number;
  leitorId: number;
  exemplarId: number;
  dataReserva: string;
  dataLimiteRetirada: string;
  dataExpiracao: string;
  situacao: "ativa" | "cancelada" | "atendida" | "expirada";
  leitorNome: string;
  leitorCpf: string;
  livroTitulo: string;
  numeroRegistro: string;
};
export type Emprestimo = {
  id: number;
  leitorId: number;
  exemplarId: number;
  dataEmprestimo: string;
  dataPrevistaDevolucao: string;
  dataDevolucao: string | null;
  situacao: "em_aberto" | "atrasado" | "devolvido";
  diasDeAtraso: number;
  leitorNome: string;
  leitorCpf: string;
  livroTitulo: string;
  numeroRegistro: string;
};

/** Centraliza JSON e mensagens de regra de negócio (400, 404 e 409). */
export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, opcoes);
  } catch {
    throw new Error("Não foi possível conectar à biblioteca. Verifique a conexão e tente novamente.");
  }
  if (resposta.status === 204) return undefined as T;
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(typeof corpo.error === "string" ? corpo.error : `Não foi possível concluir a operação (HTTP ${resposta.status}).`);
  }
  return corpo as T;
}

export function enviar<T>(caminho: string, metodo: "POST" | "PUT", dados?: unknown): Promise<T> {
  return api<T>(caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados ?? {}),
  });
}

export function buscarLivros(termo: string): Promise<Livro[]> {
  return api<Livro[]>(`/api/livros/${encodeURIComponent(termo)}`);
}

export function cadastrarLivro(livro: NovoLivro): Promise<Livro> {
  return enviar<Livro>("/api/livros", "POST", livro);
}

/** Não converte a data civil para UTC, evitando mudança de dia por fuso. */
export function formatarData(iso: string | null): string {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

export function formatarCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function parametros(dados: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(dados)) if (valor) query.set(chave, valor);
  const resultado = query.toString();
  return resultado ? `?${resultado}` : "";
}
