import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { Autor, Emprestimo, Exemplar, Leitor, Livro, Reserva } from "../../frontend/src/api.ts";

// Fixtures exclusivas: a suíte não apaga nem trunca dados de outras atividades.
const rodada = Date.now().toString(36);
let sequencia = Date.now() % 1_000_000_000;
const nome = (prefixo: string) => `${prefixo} ${rodada}-${++sequencia}`;
function isbn() {
  const base = `978${String(++sequencia % 1_000_000_000).padStart(9, "0")}`;
  const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * (indice % 2 ? 3 : 1), 0);
  return `${base}${(10 - soma % 10) % 10}`;
}
function cpf() {
  const numeros = [...String(++sequencia % 1_000_000_000).padStart(9, "0")].map(Number);
  for (const peso of [10, 11]) {
    const resto = numeros.reduce((total, digito, indice) => total + digito * (peso - indice), 0) % 11;
    numeros.push(resto < 2 ? 0 : 11 - resto);
  }
  return numeros.join("");
}
async function criar<T>(request: APIRequestContext, recurso: string, dados: unknown): Promise<T> {
  const resposta = await request.post(`/api/${recurso}`, { data: dados });
  expect(resposta.status(), await resposta.text()).toBe(201);
  return resposta.json() as Promise<T>;
}
async function autor(request: APIRequestContext) {
  return criar<Autor>(request, "autores", { nome: nome("Autor de teste"), tipo: "didatico" });
}
async function livro(request: APIRequestContext) {
  const escritor = await autor(request);
  return criar<Livro>(request, "livros", { isbn: isbn(), titulo: nome("Livro de teste"), autorId: escritor.id });
}
async function leitor(request: APIRequestContext) {
  return criar<Leitor>(request, "leitores", { nome: nome("Leitor de teste"), cpf: cpf(), email: `${nome("leitor").replaceAll(" ", "")}@example.com`, telefone: "27999998888" });
}
async function exemplar(request: APIRequestContext, registro?: Livro) {
  const obra = registro ?? await livro(request);
  return criar<Exemplar>(request, "exemplares", { livroId: obra.id, localizacao: "Estante QA", estadoConservacao: "Bom" });
}
async function buscar(page: Page, caminho: string, termo: string) {
  await page.goto(caminho);
  await page.getByLabel("Termo de busca", { exact: true }).fill(termo);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator("main [role=status]").filter({ hasText: "Carregando" })).toHaveCount(0);
}
async function confirmarExclusao(page: Page) {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
}
async function reservarPelaTela(page: Page, pessoa: Leitor, copia: Exemplar) {
  await page.goto(`/reservas/criar?exemplarId=${copia.id}`);
  await page.getByLabel("Leitor", { exact: true }).selectOption(String(pessoa.id));
  await page.getByLabel("Exemplar disponível", { exact: true }).selectOption(String(copia.id));
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
}
async function emprestarPelaTela(page: Page, pessoa: Leitor, copia: Exemplar) {
  await page.goto(`/emprestimos/registrar?leitorId=${pessoa.id}&exemplarId=${copia.id}`);
  await page.getByLabel("Exemplar para empréstimo", { exact: true }).selectOption(String(copia.id));
  await page.getByRole("button", { name: "Registrar empréstimo", exact: true }).click();
}

let errosDoNavegador: string[] = [];
test.beforeEach(async ({ page }) => {
  errosDoNavegador = [];
  page.on("pageerror", (erro) => errosDoNavegador.push(erro.message));
});
test.afterEach(async ({}, info) => {
  if (errosDoNavegador.length) await info.attach("erros-do-navegador", { body: JSON.stringify(errosDoNavegador, null, 2), contentType: "application/json" });
  expect(errosDoNavegador, "As telas não devem lançar erros JavaScript").toEqual([]);
});

test("UC05–UC08: cadastro, busca, edição e exclusão de autor pela interface", async ({ page, request }, info) => {
  const original = nome("Autora da interface");
  const alterado = `${original} revisada`;
  await page.goto("/autores/cadastrar");
  await page.getByLabel("Nome", { exact: true }).fill(original);
  await page.getByLabel("Categoria").selectOption("literatura");
  await page.getByRole("button", { name: "Cadastrar autor", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText(original);
  await buscar(page, "/autores", original);
  const linha = page.getByRole("row").filter({ hasText: original });
  await expect(linha).toContainText("Literatura");
  await linha.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(original);
  await page.getByLabel("Nome", { exact: true }).fill(alterado);
  await page.getByLabel("Categoria").selectOption("didatico");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".sucesso")).toContainText("atualizado");
  await buscar(page, "/autores", alterado);
  await expect(page.getByRole("row").filter({ hasText: alterado })).toContainText("Didático");
  await page.screenshot({ path: info.outputPath("autores-desktop.png"), fullPage: true });
  await page.getByRole("row").filter({ hasText: alterado }).getByRole("link", { name: "Excluir", exact: true }).click();
  await confirmarExclusao(page);
  await expect(page.locator(".sucesso")).toContainText("excluído");
  expect(await (await request.get(`/api/autores?q=${encodeURIComponent(alterado)}`)).json()).toEqual([]);
});

test("UC09–UC12: leitor com quatro campos obrigatórios, CPF validado e CRUD completo", async ({ page, request }) => {
  const original = nome("Leitora da interface");
  const documento = cpf();
  await page.goto("/leitores/cadastrar");
  for (const campo of ["Nome completo", "CPF", "E-mail", "Telefone"]) await expect(page.getByLabel(campo, { exact: true })).toHaveAttribute("required", "");
  await page.getByLabel("Nome completo").fill(original);
  await page.getByLabel("CPF", { exact: true }).fill("111.111.111-11");
  await page.getByLabel("E-mail", { exact: true }).fill(`ui-${documento}@example.com`);
  await page.getByLabel("Telefone", { exact: true }).fill("(27) 99999-8888");
  await page.getByRole("button", { name: "Cadastrar leitor", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/CPF/i);
  await page.getByLabel("CPF", { exact: true }).fill(documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"));
  await page.getByRole("button", { name: "Cadastrar leitor", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText(original);
  const cadastros = await (await request.get(`/api/leitores?q=${documento}`)).json() as Leitor[];
  expect(cadastros).toHaveLength(1);
  expect(cadastros[0].cpf).toBe(documento);
  await buscar(page, "/leitores", documento);
  await page.getByRole("row").filter({ hasText: original }).getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Nome completo")).toHaveValue(original);
  await page.getByLabel("Telefone", { exact: true }).fill("27988887777");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".sucesso")).toContainText("atualizado");
  await buscar(page, "/leitores", documento);
  const linha = page.getByRole("row").filter({ hasText: original });
  await expect(linha).toContainText("27988887777");
  await linha.getByRole("link", { name: "Excluir", exact: true }).click();
  await confirmarExclusao(page);
  await expect(page.locator(".sucesso")).toContainText("excluído");
});

test("UC01–UC04: livro bibliográfico sem registro físico, busca, edição e exclusão", async ({ page, request }) => {
  const escritor = await autor(request);
  const codigo = isbn();
  const titulo = nome("Livro pela interface");
  await page.goto("/livros/cadastrar");
  await page.getByLabel("ISBN-13").fill(codigo);
  await page.getByLabel("Título", { exact: true }).fill(titulo);
  await page.getByLabel("Autor", { exact: true }).selectOption(String(escritor.id));
  await page.getByRole("button", { name: "Cadastrar livro", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText(titulo);
  await buscar(page, "/livros", codigo);
  const linha = page.getByRole("row").filter({ hasText: titulo });
  await expect(linha).toContainText("0 disponível(is) / 0 total");
  await expect(page.getByRole("columnheader", { name: "Registro", exact: true })).toHaveCount(0);
  await linha.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(titulo);
  await expect(page.getByLabel("Autor", { exact: true })).toHaveValue(String(escritor.id));
  await page.getByLabel("Título", { exact: true }).fill(`${titulo} revisado`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".sucesso")).toContainText("atualizado");
  await buscar(page, "/livros", codigo);
  await page.getByRole("row").filter({ hasText: `${titulo} revisado` }).getByRole("link", { name: "Excluir", exact: true }).click();
  await confirmarExclusao(page);
  await expect(page.locator(".sucesso")).toContainText("excluído");
  expect(await (await request.get(`/api/livros?q=${codigo}`)).json()).toEqual([]);
});

test("UC13–UC16: exemplares físicos com registro gerado, filtros, edição e exclusão", async ({ page, request }, info) => {
  const obra = await livro(request);
  await page.goto("/exemplares/cadastrar");
  await page.getByLabel("Livro", { exact: true }).selectOption(String(obra.id));
  await page.getByLabel("Localização", { exact: true }).fill("Estante B, prateleira 3");
  await page.getByLabel("Estado de conservação", { exact: true }).fill("Novo");
  await page.getByRole("button", { name: "Cadastrar exemplar", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText(obra.titulo);
  const copias = await (await request.get(`/api/exemplares?livroId=${obra.id}`)).json() as Exemplar[];
  expect(copias).toHaveLength(1);
  expect(copias[0].numeroRegistro).toMatch(/^\d{4}-\d{6}$/);
  await page.goto(`/exemplares?livroId=${obra.id}&situacao=disponivel`);
  await expect(page.getByLabel("Livro", { exact: true })).toHaveValue(String(obra.id));
  await expect(page.getByLabel("Situação", { exact: true })).toHaveValue("disponivel");
  const linha = page.getByRole("row").filter({ hasText: copias[0].numeroRegistro });
  await expect(linha).toContainText("Disponível");
  await linha.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Localização", { exact: true })).toHaveValue("Estante B, prateleira 3");
  await page.getByLabel("Localização", { exact: true }).fill("Estante C");
  await page.getByLabel("Estado de conservação", { exact: true }).fill("Bom");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".sucesso")).toContainText("atualizado");
  await page.goto(`/exemplares?livroId=${obra.id}`);
  await expect(page.getByRole("row").filter({ hasText: copias[0].numeroRegistro })).toContainText("Estante C");
  await page.screenshot({ path: info.outputPath("exemplares-desktop.png"), fullPage: true });
  await page.getByRole("row").filter({ hasText: copias[0].numeroRegistro }).getByRole("link", { name: "Excluir", exact: true }).click();
  await confirmarExclusao(page);
  await expect(page.locator(".sucesso")).toContainText("excluído");
});

test("UC17, UC22 e UC18: duas reservas por leitor, janela de 7 dias e cancelamento", async ({ page, request }) => {
  const pessoa = await leitor(request);
  const obra = await livro(request);
  const copias = await Promise.all([exemplar(request, obra), exemplar(request, obra), exemplar(request, obra)]);
  await reservarPelaTela(page, pessoa, copias[0]);
  await expect(page.locator(".sucesso")).toContainText("Reserva confirmada");
  await reservarPelaTela(page, pessoa, copias[1]);
  await expect(page.locator(".sucesso")).toContainText("Reserva confirmada");
  await reservarPelaTela(page, pessoa, copias[2]);
  await expect(page.getByRole("alert")).toContainText(/duas|2/i);
  const reservas = await (await request.get(`/api/reservas?leitorId=${pessoa.id}&situacao=ativa`)).json() as Reserva[];
  expect(reservas).toHaveLength(2);
  expect((Date.parse(reservas[0].dataExpiracao) - Date.parse(reservas[0].dataReserva)) / 86_400_000).toBe(7);
  expect((Date.parse(reservas[0].dataLimiteRetirada) - Date.parse(reservas[0].dataReserva)) / 86_400_000).toBe(6);
  await page.goto(`/reservas?leitorId=${pessoa.id}&situacao=ativa`);
  await expect(page.getByLabel("Leitor", { exact: true })).toHaveValue(String(pessoa.id));
  const linha = page.getByRole("row").filter({ hasText: copias[0].numeroRegistro });
  await expect(linha).toContainText("Ativa");
  await linha.getByRole("link", { name: "Cancelar", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Cancelar reserva", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText("cancelada");
  expect((await (await request.get(`/api/exemplares/${copias[0].id}`)).json()).situacao).toBe("disponivel");
  await reservarPelaTela(page, pessoa, copias[2]);
  await expect(page.locator(".sucesso")).toContainText("Reserva confirmada");
});

test("UC19, UC21 e UC20: reserva própria atendida, prazo de 14 dias e devolução", async ({ page, request }) => {
  const pessoa = await leitor(request);
  const outra = await leitor(request);
  const copia = await exemplar(request);
  const reserva = await criar<Reserva>(request, "reservas", { leitorId: pessoa.id, exemplarId: copia.id });
  await page.goto(`/emprestimos/registrar?leitorId=${outra.id}`);
  await expect(page.getByLabel("Exemplar para empréstimo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Exemplar para empréstimo", { exact: true }).locator(`option[value="${copia.id}"]`)).toHaveCount(0);
  await page.goto(`/reservas?leitorId=${pessoa.id}`);
  await page.getByRole("row").filter({ hasText: copia.numeroRegistro }).getByRole("link", { name: "Emprestar", exact: true }).click();
  await expect(page.getByLabel("Exemplar para empréstimo", { exact: true })).toHaveValue(String(copia.id));
  await page.getByRole("button", { name: "Registrar empréstimo", exact: true }).click();
  await expect(page.locator(".sucesso")).toContainText("Empréstimo registrado");
  const emprestimos = await (await request.get(`/api/emprestimos?leitorId=${pessoa.id}`)).json() as Emprestimo[];
  expect(emprestimos).toHaveLength(1);
  expect((Date.parse(emprestimos[0].dataPrevistaDevolucao) - Date.parse(emprestimos[0].dataEmprestimo)) / 86_400_000).toBe(14);
  expect((await (await request.get(`/api/reservas/${reserva.id}`)).json()).situacao).toBe("atendida");
  await page.goto(`/emprestimos?leitorId=${pessoa.id}&situacao=em_aberto`);
  const linha = page.getByRole("row").filter({ hasText: copia.numeroRegistro });
  await expect(linha).toContainText("Em aberto");
  await linha.getByRole("link", { name: "Devolver", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar devolução" }).click();
  await expect(page.locator(".sucesso")).toContainText("Devolução do exemplar");
  expect((await (await request.get(`/api/exemplares/${copia.id}`)).json()).situacao).toBe("disponivel");
  await page.goto(`/emprestimos?leitorId=${pessoa.id}&situacao=devolvido`);
  await expect(page.getByRole("row").filter({ hasText: copia.numeroRegistro })).toContainText("Devolvido");
});

test("UC19: recusa do quarto empréstimo e seleção disponível para o leitor", async ({ page, request }) => {
  const pessoa = await leitor(request);
  const obra = await livro(request);
  const copias = await Promise.all([exemplar(request, obra), exemplar(request, obra), exemplar(request, obra), exemplar(request, obra)]);
  for (const copia of copias.slice(0, 3)) await criar<Emprestimo>(request, "emprestimos", { leitorId: pessoa.id, exemplarId: copia.id });
  await emprestarPelaTela(page, pessoa, copias[3]);
  await expect(page.getByRole("alert")).toContainText(/três|3/i);
  expect((await (await request.get(`/api/exemplares/${copias[3].id}`)).json()).situacao).toBe("disponivel");
});

test("UC04, UC08, UC12 e UC16: vínculos e histórico impedem exclusão", async ({ page, request }) => {
  const escritor = await autor(request);
  const obra = await criar<Livro>(request, "livros", { isbn: isbn(), titulo: nome("Histórico preservado"), autorId: escritor.id });
  const copia = await exemplar(request, obra);
  const pessoa = await leitor(request);
  const reserva = await criar<Reserva>(request, "reservas", { leitorId: pessoa.id, exemplarId: copia.id });
  const cancelamento = await request.post(`/api/reservas/${reserva.id}/cancelamento`);
  expect(cancelamento.status()).toBe(200);
  for (const [recurso, id, mensagem] of [["autores", escritor.id, /livro/i], ["livros", obra.id, /exemplar/i], ["leitores", pessoa.id, /histórico|reserva/i], ["exemplares", copia.id, /histórico|reserva/i]] as const) {
    await page.goto(`/${recurso}/excluir?id=${id}`);
    await confirmarExclusao(page);
    await expect(page.getByRole("alert")).toContainText(mensagem);
    expect((await request.get(`/api/${recurso}/${recurso === "livros" ? "id/" : ""}${id}`)).status()).toBe(200);
  }
});

test("22 rotas acessíveis, navegação por área e layout móvel sem overflow", async ({ page, request }, info) => {
  const obra = await livro(request);
  const copia = await exemplar(request, obra);
  const pessoa = await leitor(request);
  await criar<Emprestimo>(request, "emprestimos", { leitorId: pessoa.id, exemplarId: copia.id });
  const rotas = ["/livros/cadastrar", "/livros", "/livros/editar", "/livros/excluir", "/autores/cadastrar", "/autores", "/autores/editar", "/autores/excluir", "/leitores/cadastrar", "/leitores", "/leitores/editar", "/leitores/excluir", "/exemplares/cadastrar", "/exemplares", "/exemplares/editar", "/exemplares/excluir", "/reservas/criar", "/reservas/cancelar", "/emprestimos/registrar", "/emprestimos/devolver", "/emprestimos", "/reservas"];
  for (const rota of rotas) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Áreas da biblioteca" }).getByRole("link")).toHaveCount(6);
  }
  await page.goto(`/?q=${obra.isbn}`);
  await expect(page).toHaveURL(`/livros?q=${obra.isbn}`);
  await expect(page.getByRole("row").filter({ hasText: obra.titulo })).toBeVisible();
  await page.screenshot({ path: info.outputPath("livros-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const rota of [`/emprestimos?leitorId=${pessoa.id}`, `/exemplares?livroId=${obra.id}`, "/leitores/cadastrar", "/reservas/criar"]) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto(`/emprestimos?leitorId=${pessoa.id}`);
  await expect(page.getByRole("row").filter({ hasText: copia.numeroRegistro })).toBeVisible();
  await page.screenshot({ path: info.outputPath("emprestimos-mobile.png"), fullPage: true });
});
