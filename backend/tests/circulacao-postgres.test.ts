import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";
import { ConsultaCirculacaoPostgres } from "../src/adapters/ConsultaCirculacaoPostgres";
import { LeitorHistoricoPostgres } from "../src/adapters/LeitorHistoricoPostgres";
import { CadastrarLeitor } from "../src/modules/leitores/domain/CadastrarLeitor";
import { AtualizarLeitor } from "../src/modules/leitores/domain/AtualizarLeitor";
import { ExcluirLeitor } from "../src/modules/leitores/domain/ExcluirLeitor";
import { prepararLeitores } from "../src/modules/leitores/infrastructure/schema";
import { LeitoresPostgres } from "../src/modules/leitores/infrastructure/LeitoresPostgres";
import { prepararCirculacao } from "../src/modules/circulacao/infrastructure/schema";
import { CirculacaoPostgres } from "../src/modules/circulacao/infrastructure/CirculacaoPostgres";
import { ReservarExemplar } from "../src/modules/circulacao/domain/ReservarExemplar";
import { CancelarReserva } from "../src/modules/circulacao/domain/CancelarReserva";
import { RegistrarEmprestimo } from "../src/modules/circulacao/domain/RegistrarEmprestimo";
import { RegistrarDevolucao } from "../src/modules/circulacao/domain/RegistrarDevolucao";
import { ConsultarReservas } from "../src/modules/circulacao/domain/ConsultarReservas";
import { ConsultarEmprestimos } from "../src/modules/circulacao/domain/ConsultarEmprestimos";
import { ana, bruno } from "./leitoresDouble";

/** Esquema exclusivo: estes testes nunca apagam dados da aplicação ou de outra suíte. */
const esquema = `qa_circulacao_${process.pid}_${crypto.randomUUID().replaceAll("-", "")}`;
const db = process.env.DATABASE_URL ? new SQL(process.env.DATABASE_URL) : null;
const testePostgres = db ? test : test.skip;
const clock = () => new Date("2026-10-15T12:00:00Z");

async function transacao<T>(acao: (tx: TransactionSQL) => Promise<T>): Promise<T> {
  return await db!.begin(async tx => {
    await tx.unsafe(`SET LOCAL search_path TO "${esquema}"`);
    await tx`SELECT pg_advisory_xact_lock(22001)`;
    return await acao(tx);
  }) as T;
}

function dependencias(tx: TransactionSQL) {
  return [new CirculacaoPostgres(tx), new ConsultaCirculacaoPostgres(tx), clock] as const;
}

beforeAll(async () => {
  if (!db) return;
  await db.unsafe(`CREATE SCHEMA "${esquema}"`);
  await transacao(async tx => {
    await prepararLeitores(tx); await prepararCirculacao(tx);
    await tx`CREATE TABLE livros (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, isbn TEXT NOT NULL)`;
    await tx`CREATE TABLE exemplares (id INTEGER PRIMARY KEY, livro_id INTEGER NOT NULL, numero_registro TEXT NOT NULL)`;
  });
});

beforeEach(async () => {
  if (!db) return;
  await transacao(async tx => {
    await tx`TRUNCATE leitores, reservas, emprestimos, exemplares, livros RESTART IDENTITY`;
    const repo = new LeitoresPostgres(tx);
    await new CadastrarLeitor(repo).executar(ana); await new CadastrarLeitor(repo).executar(bruno);
    await tx`INSERT INTO livros (id, titulo, isbn) VALUES (1, 'Livro de teste', '9780141439518')`;
    for (let id = 1; id <= 8; id++) {
      await tx`INSERT INTO exemplares (id, livro_id, numero_registro) VALUES (${id}, 1, ${`2026-${String(id).padStart(6, "0")}`})`;
    }
  });
});

afterAll(async () => {
  if (!db) return;
  await db.unsafe(`DROP SCHEMA IF EXISTS "${esquema}" CASCADE`);
  await db.close();
});

testePostgres("PostgreSQL leitores: CPF único, busca com máscara, edição e exclusão sem histórico", async () => {
  await transacao(async tx => {
    const repo = new LeitoresPostgres(tx);
    expect((await repo.buscar("529.982.247-25"))[0]!.nome).toBe(ana.nome);
    expect(await repo.buscar("ANA")).toHaveLength(1);
    expect(await repo.buscar("não existe")).toEqual([]);
    await expect(new CadastrarLeitor(repo).executar({ ...ana, cpf: "529.982.247-25" })).rejects.toThrow("Já existe");
    await new AtualizarLeitor(repo).executar(1, { ...ana, nome: "Ana Alterada" });
    await expect(new AtualizarLeitor(repo).executar(1, { ...ana, cpf: bruno.cpf })).rejects.toThrow("Já existe");
    await new ExcluirLeitor(repo, new LeitorHistoricoPostgres(tx)).executar(1);
    await expect(repo.obter(1)).rejects.toThrow("não encontrado");
  });
});

testePostgres("PostgreSQL concorrência: somente duas de três reservas simultâneas do leitor", async () => {
  const resultados = await Promise.allSettled([1, 2, 3].map(exemplarId => transacao(tx => new ReservarExemplar(...dependencias(tx)).executar(1, exemplarId))));
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(2);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
  await transacao(async tx => expect(await new ConsultarReservas(...dependencias(tx)).executar({ situacao: "ativa" })).toHaveLength(2));
});

testePostgres("PostgreSQL concorrência: dois leitores não reservam a mesma cópia", async () => {
  const resultados = await Promise.allSettled([1, 2].map(leitorId => transacao(tx => new ReservarExemplar(...dependencias(tx)).executar(leitorId, 1))));
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
});

testePostgres("PostgreSQL concorrência: empréstimo limita três por leitor e um por exemplar", async () => {
  const resultados = await Promise.allSettled([1, 2, 3, 4].map(exemplarId => transacao(tx => new RegistrarEmprestimo(...dependencias(tx)).executar(1, exemplarId))));
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(3);
  await transacao(async tx => {
    const emprestimos = await new ConsultarEmprestimos(...dependencias(tx)).executar({ leitorId: 1 });
    expect(emprestimos).toHaveLength(3);
    await expect(new RegistrarEmprestimo(...dependencias(tx)).executar(2, emprestimos[0]!.exemplarId)).rejects.toThrow("já está emprestado");
  });
});

testePostgres("PostgreSQL reserva própria vira empréstimo e histórico impede excluir leitor após devolução", async () => {
  await transacao(async tx => {
    const deps = dependencias(tx);
    const reserva = await new ReservarExemplar(...deps).executar(1, 1);
    const emprestimo = await new RegistrarEmprestimo(...deps).executar(1, 1);
    expect((await new ConsultarReservas(...deps).obter(reserva.id)).situacao).toBe("atendida");
    await new RegistrarDevolucao(...deps).executar(emprestimo.id);
    await expect(new RegistrarDevolucao(...deps).executar(emprestimo.id)).rejects.toThrow("já foi devolvido");
    await expect(new ExcluirLeitor(new LeitoresPostgres(tx), new LeitorHistoricoPostgres(tx)).executar(1)).rejects.toThrow("histórico");
    const segunda = await new ReservarExemplar(...deps).executar(2, 2);
    await new CancelarReserva(...deps).executar(segunda.id);
    await expect(new ExcluirLeitor(new LeitoresPostgres(tx), new LeitorHistoricoPostgres(tx)).executar(2)).rejects.toThrow("histórico");
  });
});

testePostgres("PostgreSQL falha ao inserir empréstimo reverte atendimento da reserva", async () => {
  const reserva = await transacao(tx => new ReservarExemplar(...dependencias(tx)).executar(1, 1));
  await expect(transacao(async tx => {
    await new RegistrarEmprestimo(...dependencias(tx)).executar(1, 1);
    throw new Error("falha simulada antes do commit");
  })).rejects.toThrow("falha simulada");
  await transacao(async tx => {
    expect((await new ConsultarReservas(...dependencias(tx)).obter(reserva.id)).situacao).toBe("ativa");
    expect(await new ConsultarEmprestimos(...dependencias(tx)).executar()).toEqual([]);
  });
});
