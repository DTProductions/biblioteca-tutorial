import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Autor, Emprestimo, Exemplar, Leitor, Livro, Reserva } from "../../frontend/src/api.ts";

/** Esta suíte manipula somente as datas dos próprios fixtures no banco QA dedicado. */
const BANCO_QA = "postgres://biblioteca:biblioteca@127.0.0.1:62311/biblioteca";
const PASTA_BACKEND = fileURLToPath(new URL("../../backend", import.meta.url));
const marca = () => crypto.randomUUID();
function documento(tamanho: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(tamanho)), n => String(n % 10)).join("");
}
function cpf(): string {
  let valor = documento(9);
  if (/^(\d)\1{8}$/.test(valor)) return cpf();
  for (const tamanho of [9, 10]) {
    const soma = [...valor].reduce((total, n, i) => total + Number(n) * (tamanho + 1 - i), 0);
    const resto = soma * 10 % 11;
    valor += String(resto === 10 ? 0 : resto);
  }
  return valor;
}
function isbn(): string {
  const base = `978${documento(9)}`;
  const soma = [...base].reduce((total, n, i) => total + Number(n) * (i % 2 ? 3 : 1), 0);
  return `${base}${(10 - soma % 10) % 10}`;
}
function hoje(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function somarDias(data: string, quantidade: number): string {
  const dia = new Date(`${data}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + quantidade);
  return dia.toISOString().slice(0, 10);
}
async function criar<T>(request: APIRequestContext, recurso: string, dados: unknown): Promise<T> {
  const resposta = await request.post(`/api/${recurso}`, { data: dados });
  expect(resposta.status(), await resposta.text()).toBe(201);
  return resposta.json() as Promise<T>;
}
function leitor(request: APIRequestContext): Promise<Leitor> {
  const id = marca();
  return criar(request, "leitores", { nome: `Leitor regras ${id}`, cpf: cpf(), email: `regras-${id}@example.com`, telefone: "27999990000" });
}
async function livro(request: APIRequestContext): Promise<Livro> {
  const autor = await criar<Autor>(request, "autores", { nome: `Autor regras ${marca()}`, tipo: "didatico" });
  return criar(request, "livros", { titulo: `Livro regras ${marca()}`, isbn: isbn(), autorId: autor.id });
}
function exemplar(request: APIRequestContext, obra: Livro): Promise<Exemplar> {
  return criar(request, "exemplares", { livroId: obra.id, localizacao: "Estante regras QA", estadoConservacao: "bom" });
}

function ajustarDatas(tipo: "reserva" | "emprestimo", id: number, leitorId: number, inicio: string, fim: string): void {
  expect(Number.isSafeInteger(id) && id > 0).toBe(true);
  const programa = `
    import { SQL } from "bun";
    const url = new URL(process.env.DATABASE_URL);
    if (url.hostname !== "127.0.0.1" || url.port !== "62311" || url.pathname !== "/biblioteca") throw new Error("Banco fora do QA dedicado");
    const sql = new SQL(url.href);
    try {
      await sql.begin(async tx => {
        await tx\`SELECT pg_advisory_xact_lock(22001)\`;
        const id = Number(process.env.QA_REGISTRO_ID);
        const leitorId = Number(process.env.QA_LEITOR_ID);
        const inicio = process.env.QA_DATA_INICIO;
        const fim = process.env.QA_DATA_FIM;
        const limite = process.env.QA_DATA_LIMITE;
        const rows = process.env.QA_TIPO === "reserva"
          ? await tx\`UPDATE reservas SET data_reserva = \${inicio}, data_limite_retirada = \${limite}, data_expiracao = \${fim} WHERE id = \${id} AND leitor_id = \${leitorId} RETURNING id\`
          : await tx\`UPDATE emprestimos SET data_emprestimo = \${inicio}, data_prevista_devolucao = \${fim} WHERE id = \${id} AND leitor_id = \${leitorId} RETURNING id\`;
        if (rows.length !== 1) throw new Error("Fixture de QA não encontrado");
      });
    } finally { await sql.close(); }
  `;
  execFileSync(process.env.BUN_EXECUTABLE ?? "bun", ["-e", programa], {
    cwd: PASTA_BACKEND,
    env: { ...process.env, DATABASE_URL: BANCO_QA, QA_TIPO: tipo,
      QA_REGISTRO_ID: String(id), QA_LEITOR_ID: String(leitorId),
      QA_DATA_INICIO: inicio, QA_DATA_FIM: fim, QA_DATA_LIMITE: somarDias(inicio, 6) },
    encoding: "utf8",
  });
}

test.beforeEach(async ({}, info) => {
  expect(info.project.use.baseURL, "Os fixtures com datas alteradas exigem o servidor QA dedicado").toBe("http://127.0.0.1:62310");
});

test("Reserva: último dia inclusivo, expiração automática, disponibilidade e histórico preservado", async ({ request, page }) => {
  const pessoa = await leitor(request); const outra = await leitor(request);
  const obra = await livro(request); const copia = await exemplar(request, obra);
  const reserva = await criar<Reserva>(request, "reservas", { leitorId: pessoa.id, exemplarId: copia.id });
  // Hoje representa o sétimo dia: a retirada ainda é permitida e o exemplar continua bloqueado.
  ajustarDatas("reserva", reserva.id, pessoa.id, somarDias(hoje(), -6), somarDias(hoje(), 1));
  expect(await (await request.get(`/api/reservas/${reserva.id}`)).json()).toMatchObject({ situacao: "ativa", dataLimiteRetirada: hoje() });
  expect(await (await request.get(`/api/exemplares/${copia.id}`)).json()).toMatchObject({ situacao: "reservado" });
  expect((await request.post("/api/reservas", { data: { leitorId: outra.id, exemplarId: copia.id } })).status()).toBe(409);
  await page.goto(`/reservas?leitorId=${pessoa.id}&situacao=ativa`);
  await expect(page.getByRole("row").filter({ hasText: copia.numeroRegistro })).toContainText("Ativa");

  // Hoje passa a representar o oitavo dia: basta consultar para observar a expiração.
  ajustarDatas("reserva", reserva.id, pessoa.id, somarDias(hoje(), -7), hoje());
  expect(await (await request.get(`/api/reservas/${reserva.id}`)).json()).toMatchObject({ situacao: "expirada", dataExpiracao: hoje() });
  expect(await (await request.get(`/api/exemplares/${copia.id}`)).json()).toMatchObject({ situacao: "disponivel" });
  expect(await (await request.get(`/api/livros/id/${obra.id}`)).json()).toMatchObject({ totalExemplares: 1, exemplaresDisponiveis: 1 });
  await page.goto(`/reservas?leitorId=${pessoa.id}&situacao=expirada`);
  const linha = page.getByRole("row").filter({ hasText: copia.numeroRegistro });
  await expect(linha).toContainText("Expirada");
  await expect(linha.getByRole("link", { name: "Cancelar", exact: true })).toHaveCount(0);
  await expect(linha.getByRole("link", { name: "Emprestar", exact: true })).toHaveCount(0);
  expect((await request.post(`/api/reservas/${reserva.id}/cancelamento`)).status()).toBe(409);
  // Expirar libera a cópia, mas preserva os vínculos históricos para exclusões.
  expect((await request.delete(`/api/leitores/${pessoa.id}`)).status()).toBe(409);
  expect((await request.delete(`/api/exemplares/${copia.id}`)).status()).toBe(409);
  const nova = await criar<Reserva>(request, "reservas", { leitorId: outra.id, exemplarId: copia.id });
  expect(nova.situacao).toBe("ativa");
});

test("Empréstimo: atraso continua em aberto e pode ser devolvido pela interface", async ({ request, page }) => {
  const pessoa = await leitor(request); const obra = await livro(request); const copia = await exemplar(request, obra);
  const emprestimo = await criar<Emprestimo>(request, "emprestimos", { leitorId: pessoa.id, exemplarId: copia.id });
  ajustarDatas("emprestimo", emprestimo.id, pessoa.id, somarDias(hoje(), -15), somarDias(hoje(), -1));
  const abertos = await (await request.get(`/api/emprestimos?leitorId=${pessoa.id}&situacao=em_aberto`)).json();
  expect(abertos).toEqual([expect.objectContaining({ id: emprestimo.id, situacao: "atrasado", diasDeAtraso: 1 })]);
  await page.goto(`/emprestimos?leitorId=${pessoa.id}&situacao=em_aberto`);
  const linha = page.getByRole("row").filter({ hasText: copia.numeroRegistro });
  await expect(linha).toContainText("Atrasado");
  await expect(linha).toContainText("1 dia(s) de atraso");
  await linha.getByRole("link", { name: "Devolver", exact: true }).click();
  await expect(page.getByText("1 dia(s) de atraso.", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar devolução", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText("Devolução do exemplar");
  expect(await (await request.get(`/api/emprestimos/${emprestimo.id}`)).json()).toMatchObject({ situacao: "devolvido", dataDevolucao: hoje(), diasDeAtraso: 1 });
  expect(await (await request.get(`/api/emprestimos?leitorId=${pessoa.id}&situacao=em_aberto`)).json()).toEqual([]);
  expect(await (await request.get(`/api/exemplares/${copia.id}`)).json()).toMatchObject({ situacao: "disponivel" });
  expect((await request.post(`/api/emprestimos/${emprestimo.id}/devolucao`)).status()).toBe(409);
  expect((await request.delete(`/api/leitores/${pessoa.id}`)).status()).toBe(409);
  expect((await request.delete(`/api/exemplares/${copia.id}`)).status()).toBe(409);
});

test("Concorrência HTTP: limites de duas reservas, três empréstimos e uma operação por exemplar", async ({ request }) => {
  const pessoa = await leitor(request); const obra = await livro(request);
  const reservas = await Promise.all(Array.from({ length: 3 }, () => exemplar(request, obra)));
  const disputas = await Promise.all(reservas.map(copia => request.post("/api/reservas", { data: { leitorId: pessoa.id, exemplarId: copia.id } })));
  expect(disputas.filter(r => r.status() === 201)).toHaveLength(2);
  expect(disputas.filter(r => r.status() === 409)).toHaveLength(1);
  expect(await (await request.get(`/api/reservas?leitorId=${pessoa.id}&situacao=ativa`)).json()).toHaveLength(2);

  const tomador = await leitor(request);
  const copias = await Promise.all(Array.from({ length: 4 }, () => exemplar(request, obra)));
  const emprestimos = await Promise.all(copias.map(copia => request.post("/api/emprestimos", { data: { leitorId: tomador.id, exemplarId: copia.id } })));
  expect(emprestimos.filter(r => r.status() === 201)).toHaveLength(3);
  expect(emprestimos.filter(r => r.status() === 409)).toHaveLength(1);
  expect(await (await request.get(`/api/emprestimos?leitorId=${tomador.id}&situacao=em_aberto`)).json()).toHaveLength(3);

  const a = await leitor(request); const b = await leitor(request);
  const copiaReserva = await exemplar(request, obra);
  const reservaUnica = await Promise.all([a, b].map(l => request.post("/api/reservas", { data: { leitorId: l.id, exemplarId: copiaReserva.id } })));
  expect(reservaUnica.filter(r => r.status() === 201)).toHaveLength(1);
  expect(reservaUnica.filter(r => r.status() === 409)).toHaveLength(1);
  const copiaEmprestimo = await exemplar(request, obra);
  const emprestimoUnico = await Promise.all([a, b].map(l => request.post("/api/emprestimos", { data: { leitorId: l.id, exemplarId: copiaEmprestimo.id } })));
  expect(emprestimoUnico.filter(r => r.status() === 201)).toHaveLength(1);
  expect(emprestimoUnico.filter(r => r.status() === 409)).toHaveLength(1);
});

test("Consultas rejeitam situação desconhecida em vez de ocultar resultados", async ({ request }) => {
  for (const recurso of ["reservas", "emprestimos"]) {
    const resposta = await request.get(`/api/${recurso}?situacao=inexistente`);
    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toEqual({ error: expect.stringMatching(/inválida/i) });
  }
});
