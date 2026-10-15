# Biblioteca — evolução SaaS, fase 01

Tópicos Especiais em Engenharia de Software II · Ifes 2026.2

A branch `saas-evolution/fase01` implementa a
[aula de PostgreSQL, Docker e React](.docs/saas-evolution/saas-fase01.html).
O monólito modular da fase 53 usa PostgreSQL 18 e oferece uma interface React 19
para cadastrar e buscar livros por ISBN, título ou autor.

## Executar a aplicação

Com Docker Desktop aberto, na raiz do projeto:

```bash
docker compose -f infra/compose.yaml up -d --build
```

Abra <http://localhost:3000>. O `infra/Dockerfile` compila o frontend, e o backend serve
a interface e a API no mesmo endereço. O PostgreSQL atende somente na rede do
Compose, sem publicar a porta 5432. Os dados ficam no volume `pgdata`.

Para parar e preservar os dados:

```bash
docker compose -f infra/compose.yaml down
```

## Testes e verificações

Na primeira execução, crie o banco exclusivo da suíte, com o serviço `db` no ar:

```bash
docker compose -f infra/compose.yaml exec db createdb -U biblioteca biblioteca_test
```

Execute a suíte completa dentro da rede do Docker:

```bash
docker compose -f infra/compose.yaml run --rm --build test
```

Os testes de integração usam `biblioteca_test`; a aplicação usa `biblioteca`.
Se remover o volume com `docker compose -f infra/compose.yaml down -v`, crie novamente o banco de testes.

As verificações que dispensam PostgreSQL podem rodar localmente com Bun 1.4 ou
mais novo. Em `backend/`:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run verificar
bun test tests/cadastrar-livro.test.ts
```

## Desenvolver o frontend

Mantenha a aplicação no Docker. Em `frontend/`:

```bash
bun install --frozen-lockfile
bun run dev
```

Abra <http://localhost:5173>. O proxy do Vite encaminha `/api` para a aplicação
na porta 3000. As páginas são `/` (busca) e `/cadastrar` (cadastro).

Para validar o frontend:

```bash
bun run lint
bun run build
```

Após alterações no backend, recrie o serviço com
`docker compose -f infra/compose.yaml up -d --build app`. Para atualizar também a interface servida
pela porta 3000, refaça esse build depois de alterar o frontend.

## API e carga inicial

| Operação | Endereço |
|---|---|
| Identificação da API | `GET /api` |
| Cadastro de livro | `POST /api/livros` |
| Busca por ISBN, título ou autor | `GET /api/livros/:q` |

O cadastro recebe `isbn`, `titulo` e `autorId`. Os autores da carga inicial são
1 — Eric Evans, 2 — Robert C. Martin, 3 — Harper Lee e 4 — Jane Austen.

## Estrutura e tutorial original

- `backend/`: aplicação Bun/Hono, módulos Acervo e Autoria, testes e verificador de fronteiras.
- `frontend/`: React, React Router, Vite e CSS.
- `infra/`: Compose, Dockerfile e `Dockerfile.dockerignore`.
- `.docs/saas-evolution/`: aulas da evolução SaaS.
- `.docs/atividades/`: atividades complementares.

O [tutorial original](.docs/modular-monolith.html) percorre as 53 fases até o
monólito modular. Os estados anteriores estão nas branches
`modular-monolith/fase01` a `modular-monolith/fase53`.

O Compose usa a raiz do repositório como contexto de build para incluir
`backend/` e `frontend/`. O ignore específico `infra/Dockerfile.dockerignore`
filtra esse contexto. O nome do projeto continua sendo `biblioteca-tutorial`.

## Atividades da turma: 22 casos de uso

Abra o [índice dos tutoriais](.docs/use-cases/index.html) no navegador.
O [painel de andamento](.docs/use-cases/painel.html) mostra os 22 casos em ordem
de implementação, com pré-requisitos imediatos e quatro estados editáveis.
Cabe em 1280 × 800, salva neste navegador e permite exportar/importar o progresso.
Cada documento inclui os pré-requisitos, código completo de backend e React,
testes e o fluxo de entrega por PR. Os alunos trabalham em forks pessoais,
em branches `uc01` a `uc22`, com destino a `saas-evolution/fase01`.

Antes de começar uma atividade, o comando abaixo verifica se seus pré-requisitos
já foram integrados pelo professor e cria a branch a partir da base atualizada:

```bash
bun .docs/use-cases/preparar.ts uc05
```

Troque `uc05` pela atividade atribuída. Somente `maroquio` pode atualizar ou
integrar PRs na branch central. A implementação completa validada está na branch
`saas-evolution/fase01-teste`; as instruções de validação ficam em `qa/README.md`
nessa branch.
