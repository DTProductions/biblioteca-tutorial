import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { UseCases } from "./composition";
import { DomainError, InvalidValue } from "./shared/domain-errors";
import { registerRoutes as registerAcervo } from "./modules/acervo";
import { InvalidInput, NotFound, RuleConflict } from "./shared/errors";

/** O build do React (`bun run build` em frontend/), relativo à pasta backend/. */
const FRONTEND = "../frontend/dist";

function errorResponse(error: unknown): Response {
  if (error instanceof InvalidInput || error instanceof InvalidValue) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof NotFound) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof RuleConflict || error instanceof DomainError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  console.error(error);

  return Response.json({ error: "Erro interno" }, { status: 500 });
}

export function createServer(useCases: UseCases, porta = Number(process.env.PORT ?? 3000)) {
  const api = new Hono();

  api.get("/", (contexto) => contexto.json({ message: "API da Biblioteca" }));

  registerAcervo(api, useCases);

  const app = new Hono();

  // toda a API mora sob /api: o resto dos endereços fica livre para o frontend
  app.route("/api", api);
  app.all("/api/*", (contexto) => contexto.notFound());

  // arquivos do build: index.html, JS, CSS, ícone
  app.use("*", serveStatic({ root: FRONTEND }));

  // qualquer outro endereço (/cadastrar, por exemplo) é rota do React Router:
  // devolve o index.html e o roteador do navegador decide o que mostrar
  app.get("*", serveStatic({ path: `${FRONTEND}/index.html` }));

  app.notFound((contexto) =>
    contexto.json({ error: "Recurso não encontrado" }, 404),
  );

  app.onError((error) => errorResponse(error));

  return Bun.serve({ port: porta, fetch: app.fetch });
}
