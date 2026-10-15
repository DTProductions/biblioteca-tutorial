import type { SQL, TransactionSQL } from "bun";
import { sql } from "../infrastructure/postgres";
import { hoje, somarDias } from "../modules/circulacao/domain/modelo";
import { validarDadosLeitor } from "../modules/leitores/domain/Leitor";
import { RuleConflict } from "../shared/errors";
import { prepararSeed } from "./preparar";
import { relatorioSeed } from "./relatorio";
import { cpfFicticio, validarCatalogo, VERSAO_SEED, type CatalogoSeed, type ResumoSeed } from "./modelo";

type Copia = { id: number; data_catalogacao: string };
async function marcar(tx: TransactionSQL, entidade: string, id: number) {
  await tx`INSERT INTO seed_registros (versao, entidade, registro_id) VALUES (${VERSAO_SEED}, ${entidade}, ${id}) ON CONFLICT DO NOTHING`;
}

/** Orquestração de integração fora de modules: todas as escritas são uma transação única. */
export async function executarSeed(db: SQL = sql, agora = new Date(), fornecido?: CatalogoSeed) {
  const catalogo = fornecido ?? await Bun.file(new URL("./catalogo.json", import.meta.url)).json() as CatalogoSeed;
  validarCatalogo(catalogo);
  await prepararSeed(db);
  return await db.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(22001)`;
    const anterior = await relatorioSeed(tx);
    if (anterior.executado) return { ...anterior, criado: false };
    const data = hoje(() => agora); const antiga = somarDias(data, -180);
    const todos: Copia[] = []; let quantidadeLivros = 0;
    for (const autor of catalogo.autores) {
      const existentes = await tx`SELECT id FROM autores WHERE lower(btrim(nome)) = lower(btrim(${autor.nome}))`;
      if (existentes.length > 1) throw new RuleConflict(`Seed cancelado: há mais de um autor chamado ${autor.nome}.`);
      const [novo] = existentes.length ? existentes : await tx`INSERT INTO autores (nome, tipo) VALUES (${autor.nome}, 'literatura') RETURNING id`;
      const autorId = Number(novo!.id); await marcar(tx, "autores", autorId);
      const atuais = await tx<{ id: number; isbn: string }[]>`SELECT id, isbn FROM livros WHERE autor_id = ${autorId}`;
      const adicionais = autor.livros.filter(l => !atuais.some(r => r.isbn === l.isbn)).length;
      if (atuais.length + adicionais > 5) throw new RuleConflict(`Seed cancelado: ${autor.nome} ultrapassaria 5 livros. Nenhum dado foi alterado.`);
      for (const livro of autor.livros) {
        const [atual] = await tx`SELECT id, titulo, autor_id, data_catalogacao FROM livros WHERE isbn = ${livro.isbn}`;
        if (atual && (atual.autor_id !== autorId || atual.titulo.trim().toLowerCase() !== livro.titulo.trim().toLowerCase())) throw new RuleConflict(`Seed cancelado: ISBN ${livro.isbn} já pertence a outro registro bibliográfico.`);
        if (!atual) {
          const [titulo] = await tx`SELECT id FROM livros WHERE autor_id = ${autorId} AND lower(btrim(titulo)) = lower(btrim(${livro.titulo}))`;
          if (titulo) throw new RuleConflict(`Seed cancelado: título ${livro.titulo} já existe com outro ISBN.`);
        }
        const [inserido] = atual ? [atual] : await tx`INSERT INTO livros (isbn, titulo, autor_id, data_catalogacao) VALUES (${livro.isbn}, ${livro.titulo}, ${autorId}, ${antiga}) RETURNING id, data_catalogacao`;
        const livroId = Number(inserido!.id); await marcar(tx, "livros", livroId);
        const copias = await tx<Copia[]>`SELECT id, data_catalogacao FROM exemplares WHERE livro_id = ${livroId} ORDER BY id`;
        if (copias.length > 10) throw new RuleConflict(`Seed cancelado: o livro ${livro.titulo} já possui mais de 10 exemplares.`);
        const desejadas = 1 + quantidadeLivros++ % 10;
        const dataCopia = String(inserido!.data_catalogacao) > antiga ? String(inserido!.data_catalogacao) : antiga;
        for (let i = copias.length; i < desejadas; i++) {
          const ano = dataCopia.slice(0, 4);
          const [contador] = await tx`INSERT INTO acervo_sequencias (ano, ultimo) VALUES (${ano}, 1) ON CONFLICT (ano) DO UPDATE SET ultimo = acervo_sequencias.ultimo + 1 RETURNING ultimo`;
          const registro = `${ano}-${String(contador!.ultimo).padStart(6, "0")}`;
          const [copia] = await tx<Copia[]>`INSERT INTO exemplares (livro_id, numero_registro, localizacao, estado_conservacao, data_catalogacao) VALUES (${livroId}, ${registro}, 'Acervo demonstrativo UC23', 'bom', ${dataCopia}) RETURNING id, data_catalogacao`;
          copias.push(copia!);
        }
        for (const copia of copias) {
          if (copia.data_catalogacao > data || copia.data_catalogacao < String(inserido!.data_catalogacao)) throw new RuleConflict("Seed cancelado: há datas de catalogação incompatíveis na base existente.");
          await marcar(tx, "exemplares", copia.id); todos.push(copia);
        }
      }
      await tx`UPDATE autores SET livros_no_acervo = (SELECT COUNT(*) FROM livros WHERE autor_id = ${autorId}) WHERE id = ${autorId}`;
    }
    const livres: Copia[] = [];
    for (const copia of todos) {
      // Movimentações de demonstração só usam cópias antigas e sem histórico anterior.
      // Assim não alteramos nem sobrepomos a circulação dos dados preexistentes.
      if (copia.data_catalogacao > antiga) continue;
      const [historico] = await tx`SELECT EXISTS(SELECT 1 FROM emprestimos WHERE exemplar_id = ${copia.id}) OR EXISTS(SELECT 1 FROM reservas WHERE exemplar_id = ${copia.id}) AS existe`;
      if (!historico!.existe) livres.push(copia);
    }
    const historicos = livres;
    if (todos.length < 100 || livres.length < 100) throw new RuleConflict("Seed cancelado: são necessários 100 exemplares catalogados há pelo menos 180 dias e sem histórico anterior. Nenhum dado foi alterado.");
    const leitores: number[] = [];
    for (let i = 1; i <= 120; i++) {
      const dados = validarDadosLeitor({ nome: `Leitor Fictício ${String(i).padStart(3, "0")}`, cpf: cpfFicticio(i), email: `leitor.seed${String(i).padStart(3, "0")}@example.com`, telefone: `2799${String(i).padStart(7, "0")}` });
      const [existente] = await tx`SELECT id, nome, email, telefone FROM leitores WHERE cpf = ${dados.cpf}`;
      if (existente && (existente.nome !== dados.nome || existente.email !== dados.email || existente.telefone !== dados.telefone)) throw new RuleConflict(`Seed cancelado: CPF fictício ${dados.cpf} já pertence a outro leitor.`);
      if (existente) {
        const [vinculado] = await tx`SELECT EXISTS(SELECT 1 FROM reservas WHERE leitor_id = ${existente.id}) OR EXISTS(SELECT 1 FROM emprestimos WHERE leitor_id = ${existente.id}) AS existe`;
        if (vinculado!.existe) throw new RuleConflict("Seed cancelado: um leitor fictício já possui histórico incompatível.");
      }
      const [salvo] = existente ? [existente] : await tx`INSERT INTO leitores (nome, cpf, email, telefone) VALUES (${dados.nome}, ${dados.cpf}, ${dados.email}, ${dados.telefone}) RETURNING id`;
      leitores.push(Number(salvo!.id)); await marcar(tx, "leitores", Number(salvo!.id));
    }
    for (let i = 0; i < 120; i++) {
      const copia = historicos[i % historicos.length]!;
      // Cada volta usa uma quinzena anterior, sem sobrepor os empréstimos da mesma cópia.
      const inicio = somarDias(data, -60 - Math.floor(i / historicos.length) * 15);
      const [r] = await tx`INSERT INTO emprestimos (leitor_id, exemplar_id, data_emprestimo, data_prevista_devolucao, data_devolucao) VALUES (${leitores[i]!}, ${copia.id}, ${inicio}, ${somarDias(inicio, 14)}, ${somarDias(inicio, 7)}) RETURNING id`;
      await marcar(tx, "emprestimos", Number(r!.id));
    }
    for (let i = 0; i < 60; i++) {
      const inicio = somarDias(data, i < 30 ? -3 : -21);
      const [r] = await tx`INSERT INTO emprestimos (leitor_id, exemplar_id, data_emprestimo, data_prevista_devolucao) VALUES (${leitores[i]!}, ${livres[i]!.id}, ${inicio}, ${somarDias(inicio, 14)}) RETURNING id`;
      await marcar(tx, "emprestimos", Number(r!.id));
    }
    for (let i = 0; i < 40; i++) {
      const inicio = somarDias(data, i < 20 ? 0 : i < 30 ? -10 : -8);
      const situacao = i >= 20 && i < 30 ? "cancelada" : "ativa";
      const [r] = await tx`INSERT INTO reservas (leitor_id, exemplar_id, data_reserva, data_limite_retirada, data_expiracao, situacao) VALUES (${leitores[i + 60]!}, ${livres[i + 60]!.id}, ${inicio}, ${somarDias(inicio, 6)}, ${somarDias(inicio, 7)}, ${situacao}) RETURNING id`;
      await marcar(tx, "reservas", Number(r!.id));
    }
    const resumo: ResumoSeed = { autores: 50, livros: quantidadeLivros, exemplares: todos.length, leitores: 120, emprestimosDevolvidos: 120, emprestimosEmDia: 30, emprestimosAtrasados: 30, reservasAtivas: 20, reservasCanceladas: 10, reservasExpiradas: 10 };
    await tx`INSERT INTO seed_execucoes (versao, data_referencia, resumo) VALUES (${VERSAO_SEED}, ${data}, ${JSON.stringify(resumo)}::text::jsonb)`;
    return { executado: true, criado: true, dataReferencia: data, resumo };
  });
}
