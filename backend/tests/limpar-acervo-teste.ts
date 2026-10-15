import { emTransacao } from "../src/infrastructure/transaction";

/** Só a suíte legada precisa zerar o acervo; jamais permita executar isso no banco da aula. */
export async function limparAcervoDeTeste(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "postgres://sem-banco/nao-configurado");
  if (!decodeURIComponent(url.pathname).endsWith("_test")) {
    throw new Error("A limpeza dos testes exige DATABASE_URL apontando para um banco com nome terminado em _test.");
  }
  await emTransacao(async tx => {
    // A aplicação pode estar em uma etapa anterior: as tabelas novas ainda podem não existir.
    for (const tabela of ["reservas", "emprestimos", "exemplares"] as const) {
      const [row] = await tx`SELECT to_regclass(${tabela}) AS tabela`;
      if (row?.tabela) await tx.unsafe(`DELETE FROM ${tabela}`);
    }
    await tx`DELETE FROM livros`;
  });
}
