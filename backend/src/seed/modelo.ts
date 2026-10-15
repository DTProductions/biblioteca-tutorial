import { Isbn } from "../modules/acervo/domain/Isbn";
import { RuleConflict } from "../shared/errors";

export const VERSAO_SEED = "uc23-v1";
export type CatalogoSeed = { fonte: string; consultadoEm: string; autores: { nome: string; fonte: string; livros: { titulo: string; isbn: string; fonte: string }[] }[] };
export type ResumoSeed = { autores: number; livros: number; exemplares: number; leitores: number; emprestimosDevolvidos: number; emprestimosEmDia: number; emprestimosAtrasados: number; reservasAtivas: number; reservasCanceladas: number; reservasExpiradas: number };
export type RelatorioSeed = { executado: boolean; resumo?: ResumoSeed; dataReferencia?: string };

export function validarCatalogo(catalogo: CatalogoSeed): void {
  if (!Array.isArray(catalogo.autores) || catalogo.autores.length !== 50) throw new RuleConflict("O catálogo do seed deve ter exatamente 50 autores reais.");
  const autores = new Set<string>(); const isbns = new Set<string>();
  for (const autor of catalogo.autores) {
    const nome = autor.nome.trim().toLowerCase();
    if (!nome || !autor.fonte || autores.has(nome) || autor.livros.length < 1 || autor.livros.length > 5) throw new RuleConflict("Catálogo do seed inválido: autor repetido, sem fonte ou fora do limite de 1 a 5 livros.");
    autores.add(nome);
    for (const livro of autor.livros) {
      if (!livro.titulo.trim() || !livro.fonte || !Isbn.isValid(livro.isbn) || isbns.has(livro.isbn)) throw new RuleConflict(`Catálogo do seed inválido: título, fonte ou ISBN ${livro.isbn}.`);
      isbns.add(livro.isbn);
    }
  }
}

export function cpfFicticio(indice: number): string {
  let cpf = `900${String(indice).padStart(6, "0")}`;
  for (const tamanho of [9, 10]) {
    const soma = [...cpf].reduce((total, n, i) => total + Number(n) * (tamanho + 1 - i), 0);
    const resto = soma * 10 % 11; cpf += String(resto === 10 ? 0 : resto);
  }
  return cpf;
}
