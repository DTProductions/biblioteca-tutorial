import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const origem = process.env.BIBLIOTECA_DOCS_URL ?? "http://127.0.0.1:62312";
const url = `${origem}/.docs/use-cases/painel.html`;
const raiz = resolve(import.meta.dirname, "../..");
const imediatos: Record<string, string[]> = {
  uc01: ["uc06"], uc02: ["uc01"], uc03: ["uc02"], uc04: ["uc13"],
  uc05: [], uc06: ["uc05"], uc07: ["uc01"], uc08: ["uc01"],
  uc09: [], uc10: ["uc09"], uc11: ["uc10"], uc12: ["uc10"],
  uc13: ["uc02"], uc14: ["uc13"], uc15: ["uc14"], uc16: ["uc14"],
  uc17: ["uc10", "uc14"], uc18: ["uc22"], uc19: ["uc22"],
  uc20: ["uc21"], uc21: ["uc19"], uc22: ["uc17"], uc23: ["uc18", "uc20"],
};
const ordem = ["uc05", "uc09", "uc06", "uc10", "uc01", "uc11", "uc12", "uc02", "uc07", "uc08", "uc03", "uc13", "uc04", "uc14", "uc15", "uc16", "uc17", "uc22", "uc18", "uc19", "uc21", "uc20", "uc23"];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
});

test("23 cards inteiros em 1280×800, sem rolagem ou sobreposição", async ({ page }, info) => {
  const erros: string[] = [];
  page.on("pageerror", erro => erros.push(erro.message));
  await page.reload();
  await expect(page.locator(".caso")).toHaveCount(23);
  const limites = await page.locator(".caso").evaluateAll(cards => cards.map(card => {
    const caixa = card.getBoundingClientRect();
    const titulo = card.querySelector("h2")!.getBoundingClientRect();
    const deps = card.querySelector(".dependencias")!.getBoundingClientRect();
    const seletor = card.querySelector("select")!.getBoundingClientRect();
    return { id: card.id, x: caixa.x, y: caixa.y, direita: caixa.right, baixo: caixa.bottom, tituloBaixo: titulo.bottom, depsTopo: deps.top, seletorBaixo: seletor.bottom };
  }));
  for (const card of limites) {
    expect(card.x, card.id).toBeGreaterThanOrEqual(0);
    expect(card.y, card.id).toBeGreaterThanOrEqual(0);
    expect(card.direita, card.id).toBeLessThanOrEqual(1280);
    expect(card.baixo, card.id).toBeLessThanOrEqual(800);
    expect(card.seletorBaixo, card.id).toBeLessThanOrEqual(card.baixo);
    expect(card.tituloBaixo, `Título não deve sobrepor pré-requisitos de ${card.id}`).toBeLessThanOrEqual(card.depsTopo);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(erros).toEqual([]);
  await page.screenshot({ path: info.outputPath("painel-1280x800.png") });
});

test("ordem topológica e pré-requisitos imediatos sem redundâncias", async ({ page }) => {
  expect(await page.locator(".caso").evaluateAll(cards => cards.map(card => card.id))).toEqual(ordem);
  for (const [id, dependencias] of Object.entries(imediatos)) {
    expect(await page.locator(`#${id} [data-requisito]`).evaluateAll(links => links.map(link => link.getAttribute("data-requisito")))).toEqual(dependencias);
    for (const dependencia of dependencias) expect(ordem.indexOf(dependencia)).toBeLessThan(ordem.indexOf(id));
    await expect(page.locator(`#${id} .codigo`)).toHaveAttribute("href", `${id}.html`);
  }
});

test("quatro estados mudam o fundo, atualizam legenda e persistem ao recarregar", async ({ page }, info) => {
  await page.getByLabel("Estado de UC05", { exact: true }).selectOption("implementacao");
  await page.getByLabel("Estado de UC09", { exact: true }).selectOption("correcao");
  await page.getByLabel("Estado de UC06", { exact: true }).selectOption("concluido");
  await expect(page.locator("#total-pendente")).toHaveText("20");
  for (const estado of ["implementacao", "correcao", "concluido"]) await expect(page.locator(`#total-${estado}`)).toHaveText("1");
  const fundos = await page.locator("#uc01, #uc05, #uc09, #uc06").evaluateAll(cards => cards.map(card => getComputedStyle(card).backgroundColor));
  expect(new Set(fundos).size).toBe(4);
  await expect(page.locator("#progresso")).toHaveText("1 de 23 concluídos");
  await page.reload();
  await expect(page.locator("#uc05")).toHaveAttribute("data-estado", "implementacao");
  await expect(page.locator("#uc09")).toHaveAttribute("data-estado", "correcao");
  await expect(page.locator("#uc06")).toHaveAttribute("data-estado", "concluido");
  await page.screenshot({ path: info.outputPath("painel-quatro-estados-1280x800.png") });
});

test("liberação considera os pré-requisitos próprios, sem esperar a onda inteira", async ({ page }) => {
  await expect(page.locator("#disponiveis")).toHaveText("Podem iniciar: UC05 · UC09");
  await page.getByLabel("Estado de UC09", { exact: true }).selectOption("concluido");
  await expect(page.locator("#disponiveis")).toHaveText("Podem iniciar: UC05 · UC10");
  await page.getByLabel("Estado de UC10", { exact: true }).selectOption("concluido");
  await expect(page.locator("#disponiveis")).toHaveText("Podem iniciar: UC05 · UC11 · UC12");
  await page.getByLabel("Estado de UC06", { exact: true }).selectOption("concluido");
  await expect(page.locator("#disponiveis")).not.toContainText("UC01");
  await page.getByLabel("Estado de UC05", { exact: true }).selectOption("concluido");
  await expect(page.locator("#disponiveis")).toContainText("UC01");
});

test("exportação e importação recuperam os 23 estados; arquivo inválido preserva o andamento", async ({ page }) => {
  await page.getByLabel("Estado de UC05", { exact: true }).selectOption("concluido");
  await page.getByLabel("Estado de UC09", { exact: true }).selectOption("implementacao");
  const baixando = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const download = await baixando;
  const caminho = await download.path();
  expect(caminho).toBeTruthy();
  const conteudo = readFileSync(caminho!, "utf8");
  const copia = JSON.parse(conteudo);
  expect(Object.keys(copia.estados)).toHaveLength(23);
  expect(copia.estados.uc05).toBe("concluido");
  await page.getByLabel("Estado de UC05", { exact: true }).selectOption("correcao");
  await page.locator("#arquivo").setInputFiles({ name: "andamento.json", mimeType: "application/json", buffer: Buffer.from(conteudo) });
  await expect(page.locator("#uc05")).toHaveAttribute("data-estado", "concluido");
  await page.reload();
  await expect(page.locator("#uc09")).toHaveAttribute("data-estado", "implementacao");
  await page.locator("#arquivo").setInputFiles({ name: "invalido.json", mimeType: "application/json", buffer: Buffer.from('{"versao":1,"estados":{"uc05":"inexistente"}}') });
  await expect(page.getByRole("status")).toContainText("o andamento atual foi mantido");
  await expect(page.locator("#uc05")).toHaveAttribute("data-estado", "concluido");
});

test("funciona aberto como arquivo local e se adapta ao celular", async ({ page }, info) => {
  const externas: string[] = [];
  page.on("request", request => { if (/^https?:/.test(request.url())) externas.push(request.url()); });
  await page.goto(pathToFileURL(resolve(raiz, ".docs/use-cases/painel.html")).href);
  await expect(page.locator(".caso")).toHaveCount(23);
  await page.getByLabel("Estado de UC05", { exact: true }).selectOption("implementacao");
  await page.reload();
  await expect(page.locator("#uc05")).toHaveAttribute("data-estado", "implementacao");
  expect(externas).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("painel-mobile.png") });
});

test("armazenamento indisponível mantém os controles e oferece exportação", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error("Armazenamento bloqueado"); };
  });
  await page.reload();
  await page.getByLabel("Estado de UC05", { exact: true }).selectOption("implementacao");
  await expect(page.locator("#uc05")).toHaveAttribute("data-estado", "implementacao");
  await expect(page.getByRole("status")).toContainText("Clique em Exportar");
  await expect(page.getByRole("button", { name: "Exportar", exact: true })).toBeEnabled();
});

test("painel preserva o andamento salvo com 22 casos e acrescenta UC23 pendente", async ({ page }) => {
  await page.evaluate(() => {
    const estados = Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`uc${String(i + 1).padStart(2, "0")}`, i === 4 ? "concluido" : "pendente"]));
    localStorage.setItem("biblioteca:turma:fase01:painel:v1", JSON.stringify({ versao: 1, estados }));
  });
  await page.reload();
  await expect(page.locator("#uc05")).toHaveAttribute("data-estado", "concluido");
  await expect(page.locator("#uc23")).toHaveAttribute("data-estado", "pendente");
  await expect(page.locator("#progresso")).toHaveText("1 de 23 concluídos");
});
