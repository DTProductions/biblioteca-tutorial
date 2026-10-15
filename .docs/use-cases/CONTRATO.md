# Contrato dos tutoriais e da implementação de referência

Base: `saas-evolution/fase01`, commit `0920d3b`. Referência executável: `saas-evolution/fase01-teste`.

## Organização

- Cada UC tem um ponto de composição HTTP independente em `backend/src/use-cases/ucXX.ts`, com exportação default do tipo `CasoDeUso` de `./types`.
- `CasoDeUso = { id: string; preparar?: () => Promise<void>; registrar: (api: Hono) => void }`.
- O servidor carrega os arquivos `uc[0-9][0-9].ts` em ordem. Executa todos os `preparar` antes de registrar rotas. Não registra as rotas legadas em duplicidade.
- Classes, regras e repositórios ficam em seus módulos. SQL de outro módulo só pode aparecer em adapters de integração fora de `modules/`. Cada UC registra exclusivamente suas próprias rotas.
- Cada UC tem `frontend/src/use-cases/ucXX.tsx`, exportando default `{ id, titulo, caminho, Componente }`. O App usa `import.meta.glob` para descobrir páginas; cada UC acrescenta um arquivo sem sobrescrever os demais.

## API (JSON)

Erros: `{ error: string }`; 400 entrada inválida, 404 ausente, 409 regra/vínculo/conflito. Listas são arrays JSON. POST cria com 201; PUT/ações devolvem JSON com 200; DELETE devolve 204.

| UC | Operação |
|---|---|
| 01 | POST /api/livros |
| 02 | GET /api/livros?q=termo; GET /api/livros/id/:id; GET /api/livros/:q compatível |
| 03 | PUT /api/livros/:id |
| 04 | DELETE /api/livros/:id |
| 05 | POST /api/autores |
| 06 | GET /api/autores?q=termo; GET /api/autores/:id |
| 07 | PUT /api/autores/:id |
| 08 | DELETE /api/autores/:id |
| 09 | POST /api/leitores |
| 10 | GET /api/leitores?q=termo; GET /api/leitores/:id |
| 11 | PUT /api/leitores/:id |
| 12 | DELETE /api/leitores/:id |
| 13 | POST /api/exemplares |
| 14 | GET /api/exemplares?q=termo&livroId=id&situacao=disponivel; GET /api/exemplares/:id |
| 15 | PUT /api/exemplares/:id |
| 16 | DELETE /api/exemplares/:id |
| 17 | POST /api/reservas (leitorId, exemplarId) |
| 18 | POST /api/reservas/:id/cancelamento |
| 19 | POST /api/emprestimos (leitorId, exemplarId) |
| 20 | POST /api/emprestimos/:id/devolucao |
| 21 | GET /api/emprestimos?leitorId=&exemplarId=&situacao=; GET /api/emprestimos/:id |
| 22 | GET /api/reservas?leitorId=&exemplarId=&situacao=; GET /api/reservas/:id |
| 23 | GET /api/seed; POST /api/seed; CLI bun src/seed.ts |

### Formatos

- Livro: `{id,isbn,titulo,autorId,autor,dataCatalogacao,livrosDoAutor,totalExemplares,exemplaresDisponiveis}`. Cadastro/edição: `{isbn,titulo,autorId}`.
- Autor: `{id,nome,tipo,livrosNoAcervo}`; tipo `literatura|didatico`. Cadastro/edição: `{nome,tipo}`.
- Leitor: `{id,nome,cpf,email,telefone}`. Todos os campos textuais obrigatórios; CPF único, normalizado em 11 dígitos e com verificadores válidos.
- Exemplar: `{id,livroId,numeroRegistro,localizacao,estadoConservacao,dataCatalogacao,situacao,titulo,isbn}`. Cadastro `{livroId,localizacao,estadoConservacao}`; edição `{localizacao,estadoConservacao}`. `situacao`: `disponivel|reservado|emprestado`. Registro gerado no servidor.
- Reserva: `{id,leitorId,exemplarId,dataReserva,dataLimiteRetirada,dataExpiracao,situacao,leitorNome,leitorCpf,livroTitulo,numeroRegistro}`. `situacao`: `ativa|cancelada|atendida|expirada`. Data limite inclusiva = criação + 6 dias; expiração exclusiva = criação + 7 dias.
- Empréstimo: `{id,leitorId,exemplarId,dataEmprestimo,dataPrevistaDevolucao,dataDevolucao,situacao,diasDeAtraso,leitorNome,leitorCpf,livroTitulo,numeroRegistro}`. `situacao`: `em_aberto|atrasado|devolvido`; `dataDevolucao` nula enquanto aberto.
- Datas ISO `YYYY-MM-DD`, calculadas pelo servidor/relógio injetável. Exibição brasileira no frontend.

## Regras confirmadas

- Livro é bibliográfico; exemplar é físico. Preservar a carga anterior migrando cada registro físico para um exemplar, conservando número e data. Não apagar dados existentes.
- Livro: ISBN-13 válido/normalizado, único; título obrigatório; autor existente; título não repetido para mesmo autor. Até 5 registros bibliográficos por autor de literatura e 10 por didático.
- Reserva criada apenas para hoje, exclusivamente em exemplar disponível. Máximo 2 ativas por leitor, 1 por exemplar. Bloqueia imediatamente e expira depois de 7 dias. Canceladas/atendidas/expiradas não contam. Validar inclusive concorrência.
- Máximo 3 empréstimos abertos por leitor; prazo fixo de 14 dias corridos. Exemplar disponível ou reservado para o próprio leitor; atender reserva atomicamente. Recusar segundo empréstimo aberto do mesmo exemplar. Devolução uma única vez, libera exemplar.
- Exclusão física só sem vínculos: autor sem livros; livro sem exemplares; leitor e exemplar sem qualquer histórico de reserva/empréstimo, mesmo encerrado.
- Todas as escritas devem ocorrer em transação com o mesmo advisory lock `pg_advisory_xact_lock(22001)` para tornar verificações e alterações atômicas nesta versão de aula.

## Interface

Preservar a identidade visual simples existente. Cada UC tem página acessível pelo menu com formulário/filtros, feedback e resultado. Nenhum cadastro exige digitar ID interno: seleções podem consultar endpoints de busca. Campos de ID por URL/seleção de resultado são aceitáveis para ações contextualizadas.

## UC23 · Seed de demonstração

O catálogo versionado contém 50 autores reais e 1–5 livros reais por autor, cada
um com 1–10 exemplares. Os links e ISBNs estão em `backend/src/seed/catalogo.json`.
Leitores e contatos são fictícios. A fotografia inicial tem 120 empréstimos
devolvidos, 30 no prazo, 30 atrasados, 20 reservas ativas, 10 canceladas e 10
expiradas. São 60 empréstimos não devolvidos no total. A carga é manual, atômica
e idempotente, preserva dados anteriores e guarda a data de referência.
