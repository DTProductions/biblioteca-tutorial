#!/usr/bin/env python3
"""Publica somente resultados realmente presentes nos arquivos de evidência."""
import importlib.util
import json
from pathlib import Path
import xml.etree.ElementTree as ET

PASTA = Path(__file__).resolve().parent
RAIZ = PASTA.parent.parent
spec = importlib.util.spec_from_file_location("gerador", PASTA / "gerar.py")
gerador = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gerador)

def ler(nome):
    caminho = RAIZ / "qa" / "evidencias" / nome
    return json.loads(caminho.read_text(encoding="utf-8")) if caminho.exists() else None

linhas = []
junit = RAIZ / "qa/evidencias/backend.junit.xml"
if junit.exists():
    raiz = ET.parse(junit).getroot()
    testes = raiz.findall(".//testcase")
    falhas = sum(1 for teste in testes if teste.find("failure") is not None or teste.find("error") is not None)
    linhas.append(("Backend · Bun", f"{len(testes)} testes; {falhas} falhas", "Aprovado" if not falhas else "Falhou"))
else:
    linhas.append(("Backend · Bun", "Execução final em andamento", "Em verificação"))

playwright = ler("playwright.json")
def testes_da_suite(suite):
    testes = [teste for spec in suite.get("specs", []) for teste in spec.get("tests", [])]
    for filha in suite.get("suites", []):
        testes.extend(testes_da_suite(filha))
    return testes

for arquivo, nome, evidencia in [("interface.spec.ts", "Chromium · UC01–UC22", playwright), ("documentos.spec.ts", "Chromium · 23 tutoriais e cópia", ler("documentos-uc23.json")), ("regras.spec.ts", "Chromium/API · datas e concorrência", playwright), ("painel.spec.ts", "Chromium · painel de 23 casos", ler("painel-uc23.json")), ("seed.spec.ts", "Chromium · execução e repetição do seed", ler("seed.json"))]:
    suites = [suite for suite in evidencia.get("suites", []) if suite.get("file") == arquivo] if evidencia else []
    if suites:
        testes = [teste for suite in suites for teste in testes_da_suite(suite)]
        estatisticas = {situacao: sum(teste.get("status") == situacao for teste in testes) for situacao in ["expected", "unexpected", "flaky", "skipped"]}
        falhas = estatisticas.get("unexpected", 0)
        completo = not falhas and estatisticas["expected"] == len(testes) and bool(testes)
        linhas.append((nome, f"{estatisticas['expected']} testes aprovados; {falhas} falhas", "Aprovado" if completo else "Falhou"))
    else:
        linhas.append((nome, "Resultado final ainda não publicado", "Em verificação"))

replay = ler("replay.json")
replay_uc23 = ler("replay-uc23.json")
if replay and replay_uc23 and replay_uc23.get("fim"):
    combinados = {caso["id"]: caso for caso in replay["casos"] + replay_uc23["casos"]}
    replay = {**replay, "casos": [combinados[id] for id in sorted(combinados)]}
if replay:
    aprovados = sum(bool(caso.get("aprovado")) for caso in replay["casos"])
    completo = aprovados == 23 and len(replay["casos"]) == 23 and bool(replay.get("fim"))
    linhas.append(("Reprodução isolada dos tutoriais", f"{aprovados}/23 atividades aprovadas", "Aprovado" if completo else "Em verificação"))

corpo = '<header class="capa"><h1>Relatório de validação</h1><p>Resultados da implementação de referência na branch <code>saas-evolution/fase01-teste</code>. Os dados abaixo são derivados dos relatórios gerados pelas ferramentas.</p></header>'
corpo += '<section class="secao"><h2>Resultados registrados</h2><div class="tabela"><table><thead><tr><th>Verificação</th><th>Resultado</th><th>Situação</th></tr></thead><tbody>'
for nome, resultado, situacao in linhas:
    corpo += f'<tr><td>{gerador.esc(nome)}</td><td>{gerador.esc(resultado)}</td><td>{gerador.esc(situacao)}</td></tr>'
corpo += '</tbody></table></div></section><section class="secao"><h2>Como os tutoriais foram reproduzidos</h2><p>Para cada UC, foi criado um diretório limpo a partir do commit original <code>0920d3b</code>, aplicados somente os pacotes dos seus pré-requisitos transitivos e o próprio pacote, sem copiar os fontes diretamente do workspace.</p><p>Em cada uma das 23 cópias foram executados: conferência dos códigos e hashes, typecheck do backend, teste próprio do UC contra um banco PostgreSQL exclusivo e build do frontend. Isso verifica se um aluno consegue implementar sua atividade sem depender de arquivos de outro caso ainda não integrado.</p>'
corpo += gerador.bloco('Professor · reproduzir os 23 casos', 'python3 qa/replay-tutoriais.py')
corpo += '<p>O script lê a configuração de conexão em seu próprio cabeçalho e aceita os argumentos documentados em <code>--help</code>. Execute contra um PostgreSQL de validação; ele cria bancos exclusivos cujo nome termina em <code>_test</code>.</p></section>'
corpo += '<section class="secao"><h2>Verificação no navegador</h2><p>Os testes Playwright usam Chromium real e dados persistidos no PostgreSQL: cadastram, buscam, editam e excluem; reservam, cancelam, emprestam e devolvem; conferem limites e preservação do histórico. A documentação é aberta por HTTP para conferir todos os blocos de código, o botão de cópia e o layout em desktop e celular.</p>'
corpo += gerador.bloco('Professor · executar Playwright no ambiente isolado', 'docker compose -p biblioteca-uc22-validacao -f infra/compose.yaml -f qa/compose.yaml up -d --build\ncd qa\nbun install --frozen-lockfile\nbunx playwright install chromium\nPLAYWRIGHT_JSON_OUTPUT_NAME=evidencias/playwright.json bun run test -- interface.spec.ts regras.spec.ts')
corpo += '<p>Os testes de documentação usam um servidor HTTP local na porta 62312, servido na raiz do repositório. Os testes de regras que alteram datas exigem a URL do banco de validação, conforme o arquivo de teste. Nenhum teste de escrita deve apontar para o banco de uso real da biblioteca.</p></section>'
corpo += '<section class="secao"><h2>Proteção da branch de integração</h2><p>A regra está ativa para <code>refs/heads/saas-evolution/fase01</code>. A única exceção de atualização é a conta <code>maroquio</code>, ID 1246222. O GitHub verifica a conta autenticada que faz push ou merge; a autoria dos commits dos alunos é preservada.</p><p><a href="https://github.com/maroquio/biblioteca-tutorial/rules/25172303">Consultar a regra ativa no GitHub</a> · <a href="github-protection.json">Resposta de verificação da API</a></p></section>'
if replay:
    corpo += '<section class="secao"><h2>Resultado por atividade</h2><div class="tabela"><table><thead><tr><th>UC</th><th>Atividades presentes na cópia</th><th>Resultado</th></tr></thead><tbody>'
    for caso in replay['casos']:
        corpo += f'<tr><td><a href="{caso["id"]}.html">{caso["id"].upper()}</a></td><td>{gerador.esc(", ".join(caso["fechamento"]))}</td><td>{"Aprovado" if caso.get("aprovado") else "Falhou"}</td></tr>'
    corpo += '</tbody></table></div></section>'
corpo += '<p><a href="index.html">Voltar ao índice dos 23 tutoriais</a></p>'
(PASTA / 'validacao.html').write_text(gerador.pagina('Validação dos tutoriais', corpo), encoding='utf-8')
print('Relatório de validação atualizado com as evidências disponíveis.')
