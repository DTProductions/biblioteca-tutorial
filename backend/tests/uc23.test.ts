import { expect, test } from "bun:test";
import { api, autorDeTeste, exemplarDeTeste } from "./suporte-api";
import { sql } from "../src/infrastructure/postgres";
import { executarSeed } from "../src/seed/executar";
import { cpfFicticio, VERSAO_SEED, type CatalogoSeed } from "../src/seed/modelo";
import { leitorDeTeste } from "./leitoresApiFixture";
import { relatorioSeed } from "../src/seed/relatorio";
import { normalizarCpf } from "../src/modules/leitores/domain/Leitor";

if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) {
  throw new Error("UC23 exige um banco de testes cujo nome termine em _test.");
}

test("UC23: conflito tardio de ISBN reverte toda a execução sem apagar dados existentes", async () => {
  if ((await relatorioSeed(sql)).executado) return; // Esta prova exige a primeira execução no banco dedicado.
  const catalogo = await Bun.file(new URL("../src/seed/catalogo.json", import.meta.url)).json() as CatalogoSeed;
  const alvo = catalogo.autores.at(-1)!.livros.at(-1)!;
  const autor = await autorDeTeste();
  const [conflito] = await sql`INSERT INTO livros (isbn, titulo, autor_id, data_catalogacao) VALUES (${alvo.isbn}, 'Registro incompatível de teste UC23', ${autor.id}, '2026-01-01') RETURNING id`;
  const contar = async () => (await sql`SELECT (SELECT COUNT(*)::int FROM autores) AS autores, (SELECT COUNT(*)::int FROM livros) AS livros, (SELECT COUNT(*)::int FROM exemplares) AS exemplares, (SELECT COUNT(*)::int FROM leitores) AS leitores, (SELECT COUNT(*)::int FROM emprestimos) AS emprestimos, (SELECT COUNT(*)::int FROM reservas) AS reservas`)[0];
  const antes = await contar();
  await expect(executarSeed()).rejects.toThrow("Seed cancelado");
  expect(await contar()).toEqual(antes);
  expect(await relatorioSeed(sql)).toEqual({ executado: false });
  await sql`DELETE FROM livros WHERE id = ${conflito!.id}`;
});

// Esta suíte cria apenas seus dados. Rode em biblioteca_uc23_test, nunca no banco da aula.
test("UC23: seed atômico, idempotente, completo e coerente com os limites e o histórico", async () => {
  const banco = new URL(process.env.DATABASE_URL!).pathname;
  expect(banco.endsWith("_test")).toBe(true);
  const sentinela = await leitorDeTeste(); const copiaExistente = await exemplarDeTeste();
  const emprestimoExistente = await (await api("POST", "/emprestimos", { leitorId: sentinela.id, exemplarId: copiaExistente.id })).json();
  await api("POST", `/emprestimos/${emprestimoExistente.id}/devolucao`);
  const [antes] = await sql`SELECT COUNT(*)::int AS total FROM leitores`;
  const response = await api("POST", "/seed");
  expect(response.status, await response.clone().text()).toBe(200);
  const resultado = await response.json();
  expect(resultado).toMatchObject({ executado: true, resumo: { autores: 50, leitores: 120, emprestimosDevolvidos: 120, emprestimosEmDia: 30, emprestimosAtrasados: 30, reservasAtivas: 20, reservasCanceladas: 10, reservasExpiradas: 10 } });
  expect(resultado.resumo.livros).toBeGreaterThanOrEqual(50);
  expect(resultado.resumo.exemplares).toBeGreaterThanOrEqual(100);
  const resumo = resultado.resumo;
  const [contagens] = await sql`SELECT
    (SELECT COUNT(*)::int FROM seed_registros WHERE versao = ${VERSAO_SEED} AND entidade = 'autores') AS autores,
    (SELECT COUNT(*)::int FROM seed_registros WHERE versao = ${VERSAO_SEED} AND entidade = 'livros') AS livros,
    (SELECT COUNT(*)::int FROM seed_registros WHERE versao = ${VERSAO_SEED} AND entidade = 'exemplares') AS exemplares,
    (SELECT COUNT(*)::int FROM seed_registros WHERE versao = ${VERSAO_SEED} AND entidade = 'leitores') AS leitores`;
  expect(contagens).toEqual({ autores: resumo.autores, livros: resumo.livros, exemplares: resumo.exemplares, leitores: resumo.leitores });
  const [invalidos] = await sql`SELECT
    EXISTS(SELECT l.autor_id FROM livros l JOIN seed_registros s ON s.entidade = 'autores' AND s.registro_id = l.autor_id AND s.versao = ${VERSAO_SEED} GROUP BY l.autor_id HAVING COUNT(*) > 5) AS autores,
    EXISTS(SELECT l.id FROM livros l JOIN seed_registros s ON s.entidade = 'livros' AND s.registro_id = l.id AND s.versao = ${VERSAO_SEED} LEFT JOIN exemplares e ON e.livro_id = l.id GROUP BY l.id HAVING COUNT(e.id) < 1 OR COUNT(e.id) > 10) AS exemplares,
    EXISTS(SELECT leitor_id FROM emprestimos WHERE data_devolucao IS NULL GROUP BY leitor_id HAVING COUNT(*) > 3) AS leitores,
    EXISTS(SELECT leitor_id FROM reservas WHERE situacao = 'ativa' AND data_expiracao > ${resultado.dataReferencia} GROUP BY leitor_id HAVING COUNT(*) > 2) AS reservas`;
  expect(invalidos).toEqual({ autores: false, exemplares: false, leitores: false, reservas: false });
  const [emprestimos] = await sql`SELECT
    COUNT(*) FILTER (WHERE e.data_devolucao IS NOT NULL)::int AS devolvidos,
    COUNT(*) FILTER (WHERE e.data_devolucao IS NULL AND e.data_prevista_devolucao >= ${resultado.dataReferencia})::int AS em_dia,
    COUNT(*) FILTER (WHERE e.data_devolucao IS NULL AND e.data_prevista_devolucao < ${resultado.dataReferencia})::int AS atrasados
    FROM emprestimos e JOIN seed_registros s ON s.entidade = 'emprestimos' AND s.registro_id = e.id AND s.versao = ${VERSAO_SEED}`;
  expect(emprestimos).toEqual({ devolvidos: 120, em_dia: 30, atrasados: 30 });
  const [reservas] = await sql`SELECT
    COUNT(*) FILTER (WHERE r.situacao = 'ativa' AND r.data_expiracao > ${resultado.dataReferencia})::int AS ativas,
    COUNT(*) FILTER (WHERE r.situacao = 'cancelada')::int AS canceladas,
    COUNT(*) FILTER (WHERE r.situacao = 'ativa' AND r.data_expiracao <= ${resultado.dataReferencia})::int AS expiradas
    FROM reservas r JOIN seed_registros s ON s.entidade = 'reservas' AND s.registro_id = r.id AND s.versao = ${VERSAO_SEED}`;
  expect(reservas).toEqual({ ativas: 20, canceladas: 10, expiradas: 10 });
  const [datas] = await sql`SELECT
    EXISTS(SELECT 1 FROM emprestimos e JOIN seed_registros s ON s.entidade = 'emprestimos' AND s.registro_id = e.id AND s.versao = ${VERSAO_SEED} JOIN exemplares x ON x.id = e.exemplar_id JOIN livros l ON l.id = x.livro_id WHERE e.data_prevista_devolucao::date - e.data_emprestimo::date <> 14 OR e.data_emprestimo < x.data_catalogacao OR x.data_catalogacao < l.data_catalogacao OR e.data_devolucao < e.data_emprestimo) AS emprestimos,
    EXISTS(SELECT 1 FROM reservas r JOIN seed_registros s ON s.entidade = 'reservas' AND s.registro_id = r.id AND s.versao = ${VERSAO_SEED} WHERE r.data_expiracao::date - r.data_reserva::date <> 7 OR r.data_limite_retirada::date - r.data_reserva::date <> 6) AS reservas,
    EXISTS(SELECT 1 FROM emprestimos e JOIN reservas r ON r.exemplar_id = e.exemplar_id WHERE e.data_devolucao IS NULL AND r.situacao = 'ativa' AND r.data_expiracao > ${resultado.dataReferencia}) AS colisao`;
  expect(datas).toEqual({ emprestimos: false, reservas: false, colisao: false });
  const [sobreposicao] = await sql`SELECT EXISTS(
    SELECT 1 FROM emprestimos a JOIN emprestimos b ON a.exemplar_id = b.exemplar_id AND a.id < b.id
    JOIN seed_registros s ON s.entidade = 'emprestimos' AND s.registro_id = a.id AND s.versao = ${VERSAO_SEED}
    WHERE a.data_emprestimo < COALESCE(b.data_devolucao, '9999-12-31')
      AND b.data_emprestimo < COALESCE(a.data_devolucao, '9999-12-31')
  ) AS existe`;
  expect(sobreposicao!.existe).toBe(false);
  for (let i = 1; i <= 120; i++) expect(normalizarCpf(cpfFicticio(i))).toBe(cpfFicticio(i));
  const [total] = await sql`SELECT COUNT(*)::int AS total FROM leitores`;
  if (resultado.criado) expect(total!.total).toBe(antes!.total + 120);
  expect(await (await api("GET", `/leitores/${sentinela.id}`)).json<Record<string, unknown>>()).toMatchObject(sentinela);
  expect(await (await api("GET", `/emprestimos/${emprestimoExistente.id}`)).json<Record<string, unknown>>()).toMatchObject({ id: emprestimoExistente.id, situacao: "devolvido" });
  const repeticoes = await Promise.all([executarSeed(), executarSeed()]);
  expect(repeticoes.every(r => r.criado === false)).toBe(true);
  const repetido = repeticoes[0];
  expect(repetido).toEqual({ ...resultado, criado: false });
  expect(await (await api("GET", "/seed")).json<Record<string, unknown>>()).toEqual({ executado: true, dataReferencia: resultado.dataReferencia, resumo });
});
