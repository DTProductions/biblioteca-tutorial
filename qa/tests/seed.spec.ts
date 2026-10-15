import { test, expect } from "@playwright/test";

test("UC23: gerar exemplos, conferir contagens, consultar telas e repetir sem duplicação", async ({ page, request }, info) => {
  // Esta prova povoa a aplicação. Só execute contra uma instância dedicada de QA.
  test.skip(process.env.BIBLIOTECA_SEED_TEST !== "1", "Use BIBLIOTECA_SEED_TEST=1 e BIBLIOTECA_URL de uma instância dedicada.");
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  const antes = await request.get("/api/seed");
  expect(antes.ok(), await antes.text()).toBe(true);
  const estadoInicial = await antes.json();
  await page.goto("/livros/seed");
  await expect(page.getByRole("heading", { name: "Gerar dados de exemplo", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Executar seed", exact: true })).toBeVisible();
  const primeiraResposta = page.waitForResponse((resposta) => resposta.url().endsWith("/api/seed") && resposta.request().method() === "POST");
  await page.getByRole("button", { name: "Executar seed", exact: true }).click();
  const primeira = await primeiraResposta;
  expect(primeira.ok(), await primeira.text()).toBe(true);
  const resultado = await primeira.json();
  expect(resultado.criado).toBe(!estadoInicial.executado);
  await expect(page.locator(".sucesso")).toContainText(resultado.criado ? "gerados com sucesso" : "Nenhum registro foi duplicado");
  expect(resultado.resumo).toMatchObject({ autores: 50, emprestimosDevolvidos: 120, emprestimosEmDia: 30, emprestimosAtrasados: 30, reservasAtivas: 20, reservasCanceladas: 10, reservasExpiradas: 10 });
  expect(resultado.resumo.livros).toBeGreaterThan(0);
  expect(resultado.resumo.livros).toBeLessThanOrEqual(250);
  expect(resultado.resumo.exemplares).toBeGreaterThanOrEqual(resultado.resumo.livros);
  expect(resultado.resumo.exemplares).toBeLessThanOrEqual(resultado.resumo.livros * 10);
  expect(resultado.resumo.leitores).toBeGreaterThan(0);
  for (const [chave, valor] of Object.entries(resultado.resumo)) {
    await expect(page.locator(`[data-contagem="${chave}"] td`).last()).toHaveText(String(valor));
  }
  await page.screenshot({ path: info.outputPath("uc23-dados-gerados.png"), fullPage: true });
  const totais = async () => {
    const contagens: Record<string, number> = {};
    for (const recurso of ["autores", "livros", "exemplares", "leitores", "emprestimos", "reservas"]) {
      const resposta = await request.get(`/api/${recurso}`);
      expect(resposta.ok()).toBe(true);
      contagens[recurso] = (await resposta.json()).length;
    }
    return contagens;
  };
  const contagensAntes = await totais();
  const segundaResposta = page.waitForResponse((resposta) => resposta.url().endsWith("/api/seed") && resposta.request().method() === "POST");
  await page.getByRole("button", { name: "Executar seed", exact: true }).click();
  const segunda = await segundaResposta;
  expect(segunda.ok(), await segunda.text()).toBe(true);
  const repeticao = await segunda.json();
  expect(repeticao.criado).toBe(false);
  expect(repeticao.resumo).toEqual(resultado.resumo);
  expect(repeticao.dataReferencia).toBe(resultado.dataReferencia);
  await expect(page.locator(".sucesso")).toContainText("Nenhum registro foi duplicado");
  expect(await totais()).toEqual(contagensAntes);
  await page.reload();
  await expect(page.getByText("Os dados de exemplo já foram gerados nesta biblioteca.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-contagem="autores"] td').last()).toHaveText("50");
  const livros = await (await request.get("/api/livros")).json();
  await page.goto(`/livros?q=${livros[0].isbn}`);
  await expect(page.getByRole("row").filter({ hasText: livros[0].titulo })).toBeVisible();
  const leitores = await (await request.get("/api/leitores")).json();
  await page.goto(`/leitores?q=${encodeURIComponent(leitores[0].cpf)}`);
  await expect(page.getByRole("row").filter({ hasText: leitores[0].nome })).toBeVisible();
  for (const situacao of ["devolvido", "em_aberto", "atrasado"]) {
    await page.goto(`/emprestimos?situacao=${situacao}`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(situacao === "devolvido" ? 120 : 30);
  }
  for (const situacao of ["ativa", "cancelada", "expirada"]) {
    await page.goto(`/reservas?situacao=${situacao}`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(situacao === "ativa" ? 20 : 10);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/livros/seed");
  await expect(page.locator('[data-contagem="autores"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("uc23-mobile.png"), fullPage: true });
  expect(erros).toEqual([]);
  await info.attach("resultado-seed", { body: JSON.stringify({ resultado, repeticao, contagensAntes, contagensDepois: await totais(), errosJavaScript: erros }, null, 2), contentType: "application/json" });
});
