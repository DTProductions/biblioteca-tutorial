import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Servir a raiz com: python3 -m http.server 62312 --bind 127.0.0.1
const origem = process.env.BIBLIOTECA_DOCS_URL ?? "http://127.0.0.1:62312";
const pasta = `${origem}/.docs/use-cases/`;
const raiz = resolve(import.meta.dirname, "../..");
type Arquivo = { caminho: string; conteudo: string; sha256: string; comum: boolean };
type Pacote = { id: string; titulo: string; prerequisitos: string[]; arquivos: Arquivo[] };
const casos = Array.from({ length: 22 }, (_, indice) => `uc${String(indice + 1).padStart(2, "0")}`);
const pacote = (id: string): Pacote => JSON.parse(readFileSync(resolve(raiz, `.docs/use-cases/pacotes/${id}.json`), "utf8"));

for (const id of casos) {
  test(`${id}: tutorial íntegro, pré-requisitos e arquivos completos copiáveis`, async ({ page }, info) => {
    const dados = pacote(id);
    const erros: string[] = [];
    page.on("pageerror", (erro) => erros.push(erro.message));
    const resposta = await page.goto(`${pasta}${id}.html`);
    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${id.toUpperCase()} · ${dados.titulo}`);
    for (const secao of ["prerequisitos", "backend", "frontend", "testes", "pr"]) await expect(page.locator(`#${secao}`)).toHaveCount(1);
    const preRequisitos = await page.locator("#prerequisitos a[href^='uc']").evaluateAll((links) => links.map((link) => link.getAttribute("href")?.replace(".html", "")));
    expect(preRequisitos).toEqual(dados.prerequisitos);
    await expect(page.locator("#prerequisitos")).toContainText("Aguarde a integração pelo professor");
    await expect(page.locator("#pr")).toContainText("saas-evolution/fase01");
    await expect(page.locator("#pr")).toContainText(`git push -u origin ${id}`);
    const blocos = await page.locator(".bloco[data-source]").evaluateAll((elementos) => elementos.map((bloco) => ({
      caminho: bloco.getAttribute("data-source"), conteudo: bloco.querySelector("code")?.textContent,
      botoes: bloco.querySelectorAll("button[data-copy]").length,
    })));
    expect(blocos.length).toBe(dados.arquivos.length);
    for (const arquivo of dados.arquivos) {
      const encontrados = blocos.filter((bloco) => bloco.caminho === arquivo.caminho);
      expect(encontrados, arquivo.caminho).toHaveLength(1);
      expect(encontrados[0].botoes, arquivo.caminho).toBe(1);
      expect(encontrados[0].conteudo, `HTML versus pacote: ${arquivo.caminho}`).toBe(arquivo.conteudo);
      const fonte = readFileSync(resolve(raiz, arquivo.caminho), "utf8");
      expect(encontrados[0].conteudo, `HTML versus fonte executada: ${arquivo.caminho}`).toBe(fonte);
      expect(createHash("sha256").update(fonte).digest("hex"), arquivo.caminho).toBe(arquivo.sha256);
    }
    const codigos = await page.locator("pre code").allTextContents();
    for (const codigo of codigos) expect(codigo, "Não inserir marcadores de diff em comandos copiáveis").not.toMatch(/^\+\s{2,}/m);
    expect(erros).toEqual([]);
    await info.attach("integridade-do-tutorial", { body: JSON.stringify({ id, prerequisitos: dados.prerequisitos, arquivos: blocos.map((bloco) => bloco.caminho), quantidadeDeArquivos: blocos.length, errosJavaScript: erros }, null, 2), contentType: "application/json" });
  });
}

test("todos os links internos do índice e dos 22 tutoriais retornam 200", async ({ page, request }, info) => {
  const links = new Set<string>();
  for (const documento of ["index", ...casos, "validacao"]) {
    const resposta = await page.goto(`${pasta}${documento}.html`);
    expect(resposta?.status(), documento).toBe(200);
    const encontrados = await page.locator("a[href]").evaluateAll((elementos) => elementos.map((elemento) => (elemento as HTMLAnchorElement).href));
    for (const link of encontrados) if (link.startsWith(origem)) links.add(link);
  }
  expect([...links]).toContain(`${pasta}validacao.html`);
  const resultados: { url: string; status: number; ancora: boolean | null }[] = [];
  for (const link of [...links].sort()) {
    const url = new URL(link);
    const resposta = await request.get(link);
    const texto = await resposta.text();
    const ancora = url.hash ? await page.evaluate(({ html, id }) => Boolean(new DOMParser().parseFromString(html, "text/html").getElementById(id)), { html: texto, id: decodeURIComponent(url.hash.slice(1)) }) : null;
    resultados.push({ url: link, status: resposta.status(), ancora });
    expect(resposta.status(), link).toBe(200);
    if (url.hash) expect(ancora, link).toBe(true);
  }
  await info.attach("links-internos", { body: JSON.stringify(resultados, null, 2), contentType: "application/json" });
});

test("botão Copiar entrega o arquivo UC17 integral na área de transferência", async ({ page, context }, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: origem });
  await page.goto(`${pasta}uc17.html`);
  const arquivo = "frontend/src/use-cases/uc17.tsx";
  const bloco = page.locator(`.bloco[data-source="${arquivo}"]`);
  await bloco.getByRole("button").click();
  await expect(bloco.getByRole("button")).toHaveText("Copiado");
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  const fonte = readFileSync(resolve(raiz, arquivo), "utf8");
  expect(copiado).toBe(fonte);
  await info.attach("copia-validada", { body: JSON.stringify({ arquivo, caracteres: copiado.length, sha256: createHash("sha256").update(copiado).digest("hex"), integral: copiado === fonte }, null, 2), contentType: "application/json" });
});

test("revisão visual: UC17 desktop e índice móvel sem overflow de página", async ({ page }, info) => {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${pasta}uc17.html`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: info.outputPath("uc17-desktop.png") });
  await page.locator("#frontend").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("uc17-codigo-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${pasta}index.html`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("indice-mobile.png") });
  for (const id of casos) {
    await page.goto(`${pasta}${id}.html`);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: `${id} deve preservar a largura móvel` }).toBe(true);
    // Expandir também a preparação comum: a rolagem fica dentro do código.
    await page.locator("details summary").first().click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(erros).toEqual([]);
});
