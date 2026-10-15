#!/usr/bin/env python3
"""Gera os tutoriais a partir dos mesmos arquivos executados na referência."""
from __future__ import annotations

import hashlib
from functools import lru_cache
import html
import json
import re
import shlex
import subprocess
from pathlib import Path

PASTA = Path(__file__).resolve().parent
RAIZ = PASTA.parent.parent
BASE = "0920d3b990fbefb7441b099e7cde4b95700029e6"
TITULOS = [
    "Cadastrar livro", "Buscar livros", "Atualizar livro", "Excluir livro",
    "Cadastrar autor", "Buscar autores", "Atualizar autor", "Excluir autor",
    "Cadastrar leitor", "Buscar leitores", "Atualizar leitor", "Excluir leitor",
    "Cadastrar exemplar", "Buscar exemplares", "Atualizar exemplar", "Excluir exemplar",
    "Reservar exemplar", "Cancelar reserva de exemplar", "Registrar empréstimo",
    "Registrar devolução", "Consultar empréstimos", "Consultar reservas", "Popular biblioteca com seed",
]
CAMINHOS = [
    "/livros/cadastrar", "/livros", "/livros/editar", "/livros/excluir",
    "/autores/cadastrar", "/autores", "/autores/editar", "/autores/excluir",
    "/leitores/cadastrar", "/leitores", "/leitores/editar", "/leitores/excluir",
    "/exemplares/cadastrar", "/exemplares", "/exemplares/editar", "/exemplares/excluir",
    "/reservas/criar", "/reservas/cancelar", "/emprestimos/registrar",
    "/emprestimos/devolver", "/emprestimos", "/reservas", "/livros/seed",
]
FRONT_DEPS = {
    "uc01": ["uc06"], "uc02": ["uc01"], "uc03": ["uc01", "uc02", "uc06"],
    "uc04": ["uc02"], "uc05": [], "uc06": ["uc05"], "uc07": ["uc05", "uc06"],
    "uc08": ["uc06"], "uc09": [], "uc10": ["uc09"], "uc11": ["uc09", "uc10"],
    "uc12": ["uc10"], "uc13": ["uc02"], "uc14": ["uc02", "uc13"],
    "uc15": ["uc13", "uc14"], "uc16": ["uc14"], "uc17": ["uc10", "uc14"],
    "uc18": ["uc22"], "uc19": ["uc10", "uc14", "uc22"], "uc20": ["uc21"],
    "uc21": ["uc10", "uc14", "uc19"], "uc22": ["uc10", "uc14", "uc17"], "uc23": [],
}
COMUNS = [
    "backend/src/shared/validation.ts", "backend/src/infrastructure/transaction.ts",
    "backend/src/use-cases/types.ts", "backend/src/use-cases/loader.ts",
    "backend/src/server.ts", "backend/src/main.ts", "backend/scripts/check-boundaries.ts",
    "backend/tests/suporte-api.ts", "backend/tests/limpar-acervo-teste.ts",
    "backend/tests/cadastro.e2e.test.ts", "backend/tests/importacao.test.ts",
    "frontend/src/api.ts", "frontend/src/components/biblioteca.tsx",
    "frontend/src/components/circulacao.tsx", "frontend/src/App.tsx",
    "frontend/src/index.css", "frontend/src/pages/BuscarLivros.tsx",
    "frontend/src/pages/CadastrarLivro.tsx",
]

ESTILO = """
:root{--bg:#f6f7f9;--paper:#fff;--ink:#162235;--muted:#536174;--line:#dbe2eb;--blue:#1d4ed8;--code:#101a2c;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--ink);background:var(--bg);line-height:1.65;scroll-behavior:smooth}
*{box-sizing:border-box}body{margin:0}a{color:var(--blue);text-underline-offset:3px}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #e8a72b;outline-offset:4px}::selection{background:#c7dbff;color:#101a2c}.layout{display:grid;grid-template-columns:244px minmax(0,1fr);max-width:1500px;margin:auto}.nav{position:sticky;top:0;height:100vh;overflow:auto;padding:26px 16px;background:var(--paper);border-right:1px solid var(--line)}.nav strong{display:block;margin-bottom:16px}.nav a{display:block;padding:5px 8px;font-size:13px;text-decoration:none;border-radius:5px}.nav a[aria-current]{background:#e9efff;font-weight:700}.nav .indice{font-weight:700;margin-bottom:16px}.nav small{display:block;margin:20px 8px 6px;color:var(--muted)}main{min-width:0;padding:42px 44px 90px}.capa{padding:0 0 30px;border-bottom:1px solid var(--line);margin-bottom:32px}h1,h2,h3{line-height:1.25;text-wrap:balance}h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(30px,4vw,46px);margin:0 0 18px}h2{font-family:Georgia,'Times New Roman',serif;font-size:28px;margin:0 0 16px}h3{font-size:19px;margin:28px 0 12px}p,li{max-width:76ch}p{margin:0 0 16px}li{margin:6px 0}.meta{color:var(--muted);font-size:14px}.secao{margin:36px 0;padding:28px;background:var(--paper);border:1px solid var(--line);border-radius:12px}.nota{background:#edf3ff;padding:16px 20px;border:1px solid #ccdafa;border-radius:8px;margin:18px 0}.aviso{background:#fff8e8;border-color:#e9d9a7}.ok{background:#edf8f2;border-color:#b9dcc9}code{font:0.87em ui-monospace,'SF Mono',Menlo,Consolas,monospace;background:#edf0f5;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.bloco{margin:18px 0 24px;background:var(--code);border:1px solid #27354c;border-radius:8px;overflow:hidden}.barra{padding:9px 14px;color:#d2dff3;display:flex;gap:14px;align-items:center;justify-content:space-between;font-size:12px;border-bottom:1px solid #2b3b56}.barra span{overflow-wrap:anywhere}.barra button{cursor:pointer;border:1px solid #6c7c98;background:#22344f;color:#fff;padding:6px 12px;border-radius:5px;font:inherit;flex-shrink:0}.barra button:hover{background:#344f76}pre{margin:0;padding:18px;overflow:auto;tab-size:2;line-height:1.6}pre code{display:block;padding:0;background:none;color:#edf3fc;font-size:12.5px;white-space:pre;overflow-wrap:normal}.tabela{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{background:#edf1f7}.tag{display:inline-block;padding:2px 8px;border:1px solid var(--line);border-radius:5px;font-size:12px;margin:3px 5px 3px 0}.etapas{padding-left:22px}.etapas li{margin-bottom:12px}details>summary{cursor:pointer;font-weight:650;padding:12px 0}details[open]>summary{margin-bottom:12px}.checkboxes{list-style:none;padding-left:0}.checkboxes li{padding:6px 0}.checkboxes input{margin-right:9px;accent-color:var(--blue)}footer{color:var(--muted);font-size:13px;margin-top:36px}.ondas li{max-width:none}.grid-links{display:flex;flex-wrap:wrap;gap:9px}.grid-links a{padding:8px 12px;border:1px solid var(--line);border-radius:6px;background:white}.voltar{display:inline-block;margin-bottom:22px}
@media(max-width:900px){.layout{grid-template-columns:1fr}.nav{position:static;height:auto;max-height:230px;border-right:0;border-bottom:1px solid var(--line)}main{padding:28px 16px 70px}.secao{padding:20px 16px}.barra{align-items:flex-start}h2{font-size:25px}}@media print{.nav,.barra button{display:none}.layout{display:block}main{padding:0}.secao{border:0;padding:0;break-before:auto}pre{white-space:pre-wrap}pre code{white-space:pre-wrap;color:#111}.bloco{background:#f2f3f5;border-color:#bbb}.barra{color:#111}a{color:inherit}}
"""
SCRIPT = """
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const value=button.closest('.bloco').querySelector('code').textContent;try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value)}else{const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();if(!document.execCommand('copy'))throw new Error('copy');field.remove()}button.textContent='Copiado';setTimeout(()=>button.textContent='Copiar',1600)}catch{button.textContent='Selecione o código e copie'}}));
"""

def esc(valor):
    return html.escape(str(valor), quote=True)

def bloco(titulo, conteudo, caminho=None):
    atributo = f' data-source="{esc(caminho)}"' if caminho else ""
    return f'<div class="bloco"{atributo}><div class="barra"><span>{esc(titulo)}</span><button type="button" data-copy aria-label="Copiar {esc(titulo)}">Copiar</button></div><pre><code>{esc(conteudo)}</code></pre></div>'

def link_uc(id):
    return f'<a href="{id}.html">{id.upper()} — {esc(TITULOS[int(id[2:])-1])}</a>'

def nav(atual):
    links = []
    for i, titulo in enumerate(TITULOS, 1):
        id = f"uc{i:02}"
        corrente = ' aria-current="page"' if atual == id else ""
        links.append(f'<a href="{id}.html"{corrente}>{id.upper()} · {esc(titulo)}</a>')
    return '<aside class="nav"><strong>Biblioteca · casos de uso</strong><a class="indice" href="index.html">Índice e ordem de integração</a>' + ''.join(links) + '</aside>'

def pagina(titulo, corpo, atual="index"):
    return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(titulo) + ' · Biblioteca</title><style>' + ESTILO + '</style></head><body><div class="layout">' + nav(atual) + '<main>' + corpo + '<footer>TEES II · Ifes 2026.2. Base de integração: <code>saas-evolution/fase01</code>. Referência executável: <code>saas-evolution/fase01-teste</code>. Código completo reproduzido a partir dos arquivos da implementação de referência.</footer></main></div><script>' + SCRIPT + '</script></body></html>\n'

@lru_cache(maxsize=None)
def conteudo_arquivo(caminho):
    return (RAIZ / caminho).read_text(encoding="utf-8")

def arquivo_html(caminho):
    existente = subprocess.run(["git", "cat-file", "-e", f"{BASE}:{caminho}"], cwd=RAIZ, capture_output=True).returncode == 0
    verbo = "Atualize" if existente else "Crie"
    return f'<h3>{verbo} <code>{esc(caminho)}</code></h3><p>Copie o conteúdo integral abaixo para esse arquivo. Crie as pastas necessárias. Se o arquivo já estiver idêntico por uma atividade anterior, mantenha-o.</p>' + bloco(caminho, conteudo_arquivo(caminho), caminho)

@lru_cache(maxsize=None)
def pacote_arquivo(caminho, comum=False):
    codigo = conteudo_arquivo(caminho)
    original = subprocess.run(["git", "show", f"{BASE}:{caminho}"], cwd=RAIZ, capture_output=True)
    return {"caminho": caminho, "conteudo": codigo, "sha256": hashlib.sha256(codigo.encode()).hexdigest(), "hashBase": hashlib.sha256(original.stdout).hexdigest() if original.returncode == 0 else None, "comum": comum}

def carregar():
    casos = {}
    for arquivo in ["catalogo-manifest.json", "circulacao-manifest.json", "seed-manifest.json"]:
        casos.update(json.loads((PASTA / arquivo).read_text(encoding="utf-8")))
    assert set(casos) == {f"uc{i:02}" for i in range(1, len(TITULOS) + 1)}, "O manifesto deve conter todos os casos de uso"
    for id, caso in casos.items():
        caso["titulo"] = TITULOS[int(id[2:])-1]
        caso["caminho"] = CAMINHOS[int(id[2:])-1]
        caso["prerequisitos"] = sorted(set(caso["backendPrerequisites"]) | set(FRONT_DEPS[id]))
        caso["files"] = list(dict.fromkeys(caso["files"] + (["backend/src/importar.ts"] if id == "uc01" else []) + [f"frontend/src/use-cases/{id}.tsx"]))
    # A mudança de categoria e a exclusão precisam concorrer com cadastro já transacional.
    for id in ["uc07", "uc08"]:
        casos[id]["prerequisitos"] = sorted(set(casos[id]["prerequisitos"]) | {"uc01"})
    return dict(sorted(casos.items()))

def ondas(casos):
    feitas, resultado = set(), []
    while len(feitas) < len(casos):
        atuais = [id for id, caso in casos.items() if id not in feitas and set(caso["prerequisitos"]) <= feitas]
        assert atuais, "Dependência circular: " + str(set(casos) - feitas)
        resultado.append(atuais)
        feitas.update(atuais)
    return resultado

def comandos_teste(id):
    return f'''# Execute na raiz do repositório.
cd backend
bun install --frozen-lockfile
bun run typecheck
bun run verificar
cd ../frontend
bun install --frozen-lockfile
bun run lint
bun run build
cd ..

# Compila a interface e inicia aplicação + PostgreSQL.
docker compose -f infra/compose.yaml up -d --build

# Cria o banco exclusivo de testes se ainda não existir.
docker compose -f infra/compose.yaml exec -T db psql -U biblioteca -d postgres <<'SQL'
SELECT 'CREATE DATABASE biblioteca_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'biblioteca_test')
\\gexec
SQL

# A implementação deste caso é exercitada contra biblioteca_test.
docker compose -f infra/compose.yaml run --rm --build test bun test tests/{id}.test.ts'''

def gerar_caso(id, caso):
    numero = id.upper()
    dependencias = caso["prerequisitos"]
    links = '<ul>' + ''.join('<li>' + link_uc(requisito) + '</li>' for requisito in dependencias) + '</ul>' if dependencias else '<p><strong>Nenhum outro caso de uso.</strong> Esta atividade pode começar imediatamente após preparar o ambiente e o fork.</p>'
    corpo = f'<header class="capa"><h1>{numero} · {esc(caso["titulo"])}</h1><p>Implemente esta funcionalidade completa no banco, na API e na interface React. Entregue somente esta atividade, com seus testes, em uma branch <code>{id}</code> do seu fork pessoal.</p><p class="meta">Tela: <code>{esc(caso["caminho"])}</code> · PR: <code>seu-fork:{id}</code> → <code>maroquio/biblioteca-tutorial:saas-evolution/fase01</code></p></header>'
    corpo += '<section class="secao" id="prerequisitos"><h2>Pré-requisitos e momento de começar</h2>' + links
    corpo += '<div class="nota aviso"><strong>Aguarde a integração pelo professor.</strong> Um PR aberto ou aprovado ainda não basta: os pré-requisitos precisam estar na branch central <code>saas-evolution/fase01</code>. Nunca comece a partir da branch de outro aluno. O comando de preparação abaixo confere o código integrado no remoto central antes de criar sua branch.</div><p>Ambiente: Git, Bun 1.4 ou mais novo e Docker Desktop em execução. Os comandos de terminal usam shell compatível com Bash; no Windows, use Git Bash. Use os lockfiles existentes e o PostgreSQL do Compose.</p></section>'
    corpo += '<section class="secao" id="regras"><h2>Contrato e critérios de aceite</h2><ul>' + ''.join(f'<li>{esc(item)}</li>' for item in caso["criteria"]) + '</ul>'
    if int(id[2:]) in (17, 18, 19, 20, 21, 22):
        corpo += '<p>Reserva criada no dia 15 permite retirada nos dias 15 a 21 e expira no início do dia 22, no calendário de São Paulo. Reserva cancelada, atendida ou expirada deixa de ocupar uma das duas vagas do leitor. O empréstimo tem prazo de 14 dias corridos a partir da retirada e conta no limite de três até a devolução, mesmo se estiver atrasado.</p>'
    corpo += '<p>Respostas de erro usam <code>{"error":"mensagem"}</code>: <strong>400</strong> para entrada inválida, <strong>404</strong> para registro ausente e <strong>409</strong> para conflito de regra ou vínculo. Cadastros retornam <strong>201</strong>; atualizações e ações retornam <strong>200</strong>; exclusões retornam <strong>204</strong>.</p>'
    for exemplo in caso["apiExamples"]:
        comando = f'curl --fail-with-body -sS -X {exemplo["method"]} ' + shlex.quote('http://localhost:3000' + exemplo["path"])
        if "body" in exemplo:
            comando += " \\\n  -H 'Content-Type: application/json' \\\n  --data " + shlex.quote(json.dumps(exemplo["body"], ensure_ascii=False))
        corpo += bloco('Exemplo de requisição HTTP', comando)
    corpo += '<p>Nos exemplos de ação sobre um registro, substitua o identificador pelo devolvido no cadastro da sua base. O teste automatizado abaixo cria seus próprios registros e não depende de IDs fixos.</p></section>'
    corpo += '<section class="secao" id="branch"><h2>Preparar o fork e criar a branch</h2><ol class="etapas"><li>No GitHub, crie seu fork de <a href="https://github.com/maroquio/biblioteca-tutorial">maroquio/biblioteca-tutorial</a> e clone o fork usando o endereço exibido pelo GitHub. O remote <code>origin</code> deve apontar para seu fork.</li><li>Na primeira atividade, dentro da pasta clonada, obtenha a base de aula e seus tutoriais:</li></ol>'
    corpo += bloco('Terminal · primeira atividade', 'git fetch https://github.com/maroquio/biblioteca-tutorial.git saas-evolution/fase01\ngit switch --detach FETCH_HEAD')
    corpo += '<p>Agora execute a preparação da atividade. Ela configura <code>upstream</code>, atualiza a base, verifica todos os pré-requisitos transitivos e cria a branch sem configurar o repositório do professor como destino de push.</p>'
    corpo += bloco('Terminal · criar a branch correta', f'bun .docs/use-cases/preparar.ts {id}\ngit branch --show-current\ngit remote -v')
    corpo += f'<p>O nome exibido deve ser <code>{id}</code>. Se a preparação informar atividade bloqueada, aguarde os merges indicados e repita o comando. Se a branch já existir, preserve seu trabalho; atualize-a com <code>git fetch upstream</code> e <code>git merge upstream/saas-evolution/fase01</code>.</p></section>'
    corpo += '<section class="secao" id="base"><h2>Preparação compartilhada</h2><p>Estes arquivos são <strong>idênticos em todas as atividades</strong>. Eles preservam os dois casos legados enquanto as evoluções não são integradas e descobrem os novos arquivos automaticamente. Assim, dois PRs não precisam adicionar linhas ao mesmo registro central. Copie uma vez; se os pré-requisitos já trouxeram esta preparação, confira e mantenha o conteúdo existente.</p><p>A transação PostgreSQL usa um advisory lock compartilhado. A consulta de disponibilidade/limites e sua alteração ocorrem na mesma transação, incluindo requisições simultâneas de processos diferentes. Os testes legados recebem limpeza restrita a bancos cujo nome termina em <code>_test</code>.</p><details><summary>Mostrar todos os arquivos da preparação compartilhada</summary>'
    corpo += ''.join(arquivo_html(caminho) for caminho in COMUNS)
    corpo += '</details></section>'
    corpo += '<section class="secao" id="backend"><h2>Implementar domínio, persistência e API</h2><ol class="etapas">' + ''.join(f'<li>{esc(item)}</li>' for item in caso["steps"]) + '</ol><p>Crie os arquivos na ordem apresentada. Regras de negócio ficam no módulo responsável; os adapters de integração ficam fora dos módulos e traduzem suas consultas. O arquivo <code>backend/src/use-cases/' + id + '.ts</code> compõe as dependências e registra as rotas desta atividade.</p>'
    corpo += ''.join(arquivo_html(caminho) for caminho in caso["files"] if caminho.startswith('backend/') and '/tests/' not in caminho)
    corpo += '</section><section class="secao" id="frontend"><h2>Implementar a interface React</h2><p>Esta página usa os componentes e a função HTTP da preparação compartilhada. O App a encontra pelo nome <code>ucXX.tsx</code>. As consultas usadas nos seletores explicam os pré-requisitos de interface; não substitua seletores por IDs internos digitados pelo usuário.</p>'
    corpo += ''.join(arquivo_html(caminho) for caminho in caso["files"] if caminho.startswith('frontend/'))
    corpo += f'<p>Depois do build, abra <a href="http://localhost:3000{caso["caminho"]}">http://localhost:3000{esc(caso["caminho"])}</a>. Confirme envio, carregamento, resultado, entrada inválida e mensagem de erro. Recarregue a página diretamente para conferir a rota do navegador.</p></section>'
    corpo += '<section class="secao" id="testes"><h2>Escrever e executar os testes</h2><p>Os fixtures usam registros próprios e retornam os IDs reais criados durante o teste. As regras de datas e limites também são exercitadas com relógio ou repositórios controlados quando aplicável. Copie os arquivos completos:</p>'
    corpo += ''.join(arquivo_html(caminho) for caminho in caso["files"] if '/tests/' in caminho)
    corpo += bloco('Terminal · verificações e teste desta atividade', comandos_teste(id))
    corpo += '<p>Resultado esperado: typecheck, fronteiras, lint e build sem erros; todos os testes do arquivo desta atividade aprovados. O teste SQL usa <code>biblioteca_test</code>, separado do banco da aplicação. Ao remover o volume do Compose, recrie esse banco com o comando acima.</p>'
    corpo += bloco('Terminal · comparar com o código de referência', f'bun .docs/use-cases/codigo.ts {id}')
    corpo += '<p>A comparação é de conteúdo, não uma prova de comportamento: uma solução própria pode diferir e estar correta. Os testes e os critérios de aceite são a verificação funcional.</p></section>'
    if id == 'uc23':
        corpo += '<section class="secao"><h2>Executar e conferir o seed</h2><p>Depois de integrar os pré-requisitos, inicie o Compose e abra <code>/livros/seed</code>. Execute a carga uma vez e confira o resumo. Uma segunda execução deve informar que a carga já existe e preservar as contagens e alterações manuais posteriores.</p>'
        corpo += bloco('Terminal · executar manualmente pelo CLI', 'docker compose -f infra/compose.yaml exec -T app bun src/seed.ts')
        corpo += '<p>São 30 empréstimos abertos no prazo e outros 30 atrasados, portanto 60 não devolvidos. As reservas expiradas são registros históricos cuja data de expiração já passou; elas não bloqueiam exemplares nem consomem o limite do leitor. As datas são relativas ao dia da primeira execução no calendário de São Paulo.</p><p>O resumo é a fotografia da carga na data de referência: a passagem dos dias e operações manuais posteriores podem alterar a situação atual dos empréstimos e reservas. O seed preserva essas alterações e não é reexecutado automaticamente.</p><p>Os autores, títulos e ISBNs são documentados em <code>backend/src/seed/catalogo.json</code>, com links de origem na <a href="https://openlibrary.org/dev/docs/api/search">Open Library</a>. Os leitores e seus contatos são fictícios.</p></section>'
    corpo += '<section class="secao" id="pr"><h2>Revisar e solicitar o pull request</h2><ul class="checkboxes">' + ''.join(f'<li><label><input type="checkbox">{esc(item)}</label></li>' for item in caso["criteria"]) + '<li><label><input type="checkbox">Testes, build, lint e verificador de fronteiras aprovados.</label></li><li><label><input type="checkbox">Tela exercitada no navegador e arquivos temporários fora do commit.</label></li></ul>'
    corpo += bloco('Terminal · commit e push no fork', f'git status --short\ngit diff --check\ngit add backend/src backend/tests backend/scripts frontend/src\ngit diff --cached --stat\ngit commit -m "feat({id}): {caso["titulo"].lower()}"\ngit push -u origin {id}')
    corpo += f'<ol class="etapas"><li>Abra seu fork no GitHub e use <strong>Contribute → Open pull request</strong>.</li><li>Selecione base repository <code>maroquio/biblioteca-tutorial</code>, base <code>saas-evolution/fase01</code>, head repository <strong>seu fork</strong> e compare <code>{id}</code>.</li><li>Use o título <strong>{numero} — {esc(caso["titulo"])}</strong>. Na descrição, informe pré-requisitos integrados, arquivos alterados, regras implementadas, comandos executados e resultados dos testes. Inclua uma captura da tela.</li><li>Solicite a revisão do professor. Somente <code>maroquio</code> pode integrar na branch central; a autoria dos seus commits é preservada.</li><li>Se a base avançar e houver conflito, atualize sua branch com <code>git fetch upstream</code> e <code>git merge upstream/saas-evolution/fase01</code>, resolva os conflitos preservando os outros UCs, repita os testes e faça outro push para o fork.</li></ol>'
    corpo += '<p><a href="index.html">Voltar ao índice e às ondas de integração</a></p></section>'
    (PASTA / f'{id}.html').write_text(pagina(f'{numero} · {caso["titulo"]}', corpo, id), encoding='utf-8')
    arquivos = [pacote_arquivo(caminho, True) for caminho in COMUNS] + [pacote_arquivo(caminho) for caminho in caso['files'] if caminho not in COMUNS]
    (PASTA / 'pacotes' / f'{id}.json').write_text(json.dumps({'id': id, 'titulo': caso['titulo'], 'prerequisitos': dependencias, 'arquivos': arquivos}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    casos = carregar()
    fases = ondas(casos)
    (PASTA / 'pacotes').mkdir(exist_ok=True)
    for id, caso in casos.items():
        gerar_caso(id, caso)
    manifesto = {'base': 'saas-evolution/fase01', 'referencia': 'saas-evolution/fase01-teste', 'commitInicial': BASE, 'ondas': fases, 'casos': {id: {'titulo': caso['titulo'], 'caminho': caso['caminho'], 'prerequisitos': caso['prerequisitos'], 'arquivos': caso['files']} for id, caso in casos.items()}}
    (PASTA / 'manifesto.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    painel = PASTA / 'painel.html'
    dados_painel = [{'id': id, 'titulo': caso['titulo'], 'prerequisitos': caso['prerequisitos']} for id, caso in casos.items()]
    painel_html, alteracoes = re.subn(r'(<script id="dados-casos" type="application/json">).*?(</script>)', lambda trecho: trecho[1] + json.dumps(dados_painel, ensure_ascii=False, indent=2) + trecho[2], painel.read_text(encoding='utf-8'), count=1, flags=re.S)
    assert alteracoes == 1, 'O painel deve conter o bloco de dados dos casos de uso.'
    painel.write_text(painel_html, encoding='utf-8')
    corpo = '<header class="capa"><h1>Biblioteca · 23 casos de uso</h1><p>Tutoriais completos para implementar o sistema em equipe, com React, API Bun/Hono, PostgreSQL, testes e entrega por pull request.</p><p>Livro representa o registro bibliográfico; exemplar é a cópia física. Reservas bloqueiam um exemplar disponível por sete dias a partir de hoje; empréstimos duram 14 dias. Cada leitor pode manter duas reservas ativas e três empréstimos em aberto. O UC23 acrescenta um seed de catálogo e circulação para testes manuais.</p></header>'
    corpo += '<p><a href="painel.html"><strong>Abrir o painel de andamento da turma</strong></a> · 23 cards, pré-requisitos imediatos e estados editáveis; preparado para projeção em 1280 × 800.</p>'
    corpo += '<section class="secao"><h2>Como distribuir as atividades</h2><p>Distribua os UCs entre os alunos. Cada aluno trabalha em seu fork e envia uma branch <code>ucXX</code> para a base central <code>saas-evolution/fase01</code>. Os pré-requisitos incluem código e endpoints usados pela interface e pelos testes. A numeração identifica a atividade; ela não determina a ordem de implementação.</p><div class="nota aviso">Só inicie uma atividade quando todos os seus pré-requisitos estiverem integrados na base central pelo professor. O comando <code>bun .docs/use-cases/preparar.ts ucXX</code> verifica isso antes de criar a branch.</div><p>Os arquivos de preparação compartilhada são idênticos em todos os tutoriais e podem entrar pelo primeiro PR de qualquer frente. Cada UC acrescenta seu próprio ponto de composição, página e testes.</p><h3>Ondas possíveis de integração</h3><p>Dentro de cada onda, as atividades podem ser realizadas em paralelo. Uma atividade pode começar assim que seus próprios pré-requisitos forem integrados, mesmo se outras atividades da onda anterior estiverem pendentes.</p><ol class="ondas">'
    for fase in fases:
        corpo += '<li>' + ' · '.join(link_uc(id) for id in fase) + '</li>'
    corpo += '</ol></section><section class="secao"><h2>Todos os tutoriais</h2><div class="tabela"><table><thead><tr><th>UC</th><th>Atividade</th><th>Pré-requisitos diretos</th><th>Situação na base original</th></tr></thead><tbody>'
    for id, caso in casos.items():
        deps = ', '.join(f'<a href="{dep}.html">{dep.upper()}</a>' for dep in caso['prerequisitos']) or 'Nenhum'
        estado = 'Existente; será adaptado para livro bibliográfico' if id in ('uc01', 'uc02') else 'Novo'
        corpo += f'<tr><td>{id.upper()}</td><td><a href="{id}.html">{esc(caso["titulo"])}</a></td><td>{deps}</td><td>{estado}</td></tr>'
    corpo += '</tbody></table></div></section><section class="secao"><h2>Validação e referência do professor</h2><p>O código de cada arquivo é reproduzido integralmente nos HTMLs. Os pacotes JSON contêm os mesmos conteúdos e hashes para reproduzir cada atividade a partir da base original e testar o grafo de pré-requisitos.</p><p>A branch <code>saas-evolution/fase01-teste</code> contém a implementação completa. Ela é uma referência de execução; os alunos criam suas branches a partir de <code>saas-evolution/fase01</code>.</p><p><a href="validacao.html">Consultar o relatório de validação</a> · <a href="https://github.com/maroquio/biblioteca-tutorial/rules/25172303">Regra de proteção da branch central no GitHub</a></p><p>A importação CSV já existente é preservada e adaptada no UC01. Ela reutiliza o cadastro bibliográfico e não constitui um 23º caso de uso desta atividade.</p><h3>Documentação oficial consultada</h3><ul><li><a href="https://bun.sh/docs/api/sql">Bun SQL e transações</a></li><li><a href="https://hono.dev/docs/">Hono</a></li><li><a href="https://react.dev/reference/react">React</a></li><li><a href="https://playwright.dev/docs/intro">Playwright</a></li><li><a href="https://docs.github.com/en/rest/repos/rules">GitHub Rulesets</a></li></ul></section>'
    (PASTA / 'index.html').write_text(pagina('23 casos de uso', corpo), encoding='utf-8')
    print(f'Gerados {len(casos)} tutoriais, índice, manifesto e pacotes. Ondas: {len(fases)}.')

if __name__ == '__main__':
    main()
