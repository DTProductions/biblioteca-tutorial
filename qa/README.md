# Validação dos 22 tutoriais

Execute na branch `saas-evolution/fase01-teste`. O material dos alunos está em
[.docs/use-cases/index.html](../.docs/use-cases/index.html).

## Ambiente isolado

Na raiz do repositório, com Docker Desktop (Compose 2.24.4+) aberto:

```bash
docker compose -p biblioteca-uc22-validacao -f infra/compose.yaml -f qa/compose.yaml up -d --build
```

Abra <http://127.0.0.1:62310>. O PostgreSQL exclusivo desta validação atende em
`127.0.0.1:62311`; seu volume pertence ao projeto `biblioteca-uc22-validacao`.
Os testes de navegador criam dados sintéticos e mantêm o histórico para inspeção.

## Testes no navegador

Em `qa/`:

```bash
bun install --frozen-lockfile
bunx playwright install chromium
PLAYWRIGHT_JSON_OUTPUT_NAME=evidencias/playwright.json bun run test -- interface.spec.ts regras.spec.ts
```

Os testes `regras.spec.ts` exigem exatamente o ambiente isolado acima: alteram
as datas apenas dos próprios fixtures para verificar expiração e atraso. A
guarda impede executá-los contra outra porta ou outro banco.

Para incluir os testes dos documentos, sirva a raiz do repositório em outro terminal:

```bash
python3 -m http.server 62312 --bind 127.0.0.1
```

Então, em `qa/`:

```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=evidencias/playwright.json bun run test
bun run report
```

São 9 testes de interface, 4 de regras e 25 de documentação. Eles cobrem os
22 casos de uso, os 508 blocos de código, o botão de cópia, links, responsividade,
limites concorrentes, expiração e devolução em atraso.

O painel de acompanhamento possui mais 7 testes. Com o servidor de documentos
ativo, execute somente essa verificação em `qa/`:

```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=evidencias/painel.json bun run test -- painel.spec.ts
```

Eles conferem os 22 cards inteiros em 1280 × 800, a ordem topológica e os
pré-requisitos sem redundâncias, cores e contagens, persistência, liberação
por pré-requisitos, exportação/importação e uso como arquivo local.

## Reprodução independente dos tutoriais

O replay precisa de Python 3, Git, Bun, `psql` e das dependências instaladas em
`backend/` e `frontend/`. Use o PostgreSQL isolado acima. Na raiz:

```bash
python3 qa/replay-tutoriais.py
```

Cada UC recebe uma cópia limpa do commit `0920d3b`, somente os pacotes dos
pré-requisitos transitivos e o próprio pacote. O replay confere os códigos,
executa typecheck e o teste específico e compila o React. Cada atividade usa
seu próprio banco terminado em `_test`. Os diretórios e bancos são preservados
para diagnóstico. Consulte `python3 qa/replay-tutoriais.py --help` para selecionar
atividades ou configurar a conexão administrativa de validação.

Os resultados ficam em `qa/evidencias/`. Para atualizar o relatório HTML:

```bash
python3 .docs/use-cases/relatorio.py
```

Para encerrar os contêineres, preservando os dados de validação:

```bash
docker compose -p biblioteca-uc22-validacao -f infra/compose.yaml -f qa/compose.yaml down
```
