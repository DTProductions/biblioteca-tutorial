#!/usr/bin/env python3
"""Coleta obras/edições da Open Library, sem sintetizar ISBNs ou atribuições.

Requer rede; respeita no máximo duas requisições por segundo, identificadas.
Reexecutar pode mudar a seleção se o catálogo colaborativo tiver sido alterado.
"""
import concurrent.futures
import datetime
import json
from pathlib import Path
import re
import threading
import time
import unicodedata
import urllib.parse
import urllib.request

AUTORES = [
    ("Machado de Assis", []), ("José de Alencar", []), ("Clarice Lispector", []),
    ("Jorge Amado", []), ("Graciliano Ramos", []), ("Rachel de Queiroz", []),
    ("Cecília Meireles", []), ("Carlos Drummond de Andrade", []),
    ("João Guimarães Rosa", ["Guimarães Rosa"]), ("Lima Barreto", []),
    ("Aluísio Azevedo", []), ("Monteiro Lobato", []), ("Manuel Bandeira", []),
    ("Érico Veríssimo", ["Erico Verissimo"]), ("Lygia Fagundes Telles", []),
    ("Rubem Fonseca", []), ("João Cabral de Melo Neto", []), ("Mário de Andrade", []),
    ("José Lins do Rego", []), ("Ariano Suassuna", []),
    ("Jane Austen", []), ("Charles Dickens", []), ("George Orwell", []),
    ("Virginia Woolf", []), ("William Shakespeare", []), ("Mark Twain", []),
    ("Ernest Hemingway", []), ("F. Scott Fitzgerald", []), ("John Steinbeck", []),
    ("Harper Lee", []), ("Toni Morrison", []), ("Agatha Christie", []),
    ("Arthur Conan Doyle", ["Sir Arthur Conan Doyle"]), ("Jules Verne", []),
    ("Victor Hugo", []), ("Gustave Flaubert", []), ("Alexandre Dumas", []),
    ("Émile Zola", []), ("Franz Kafka", []), ("Hermann Hesse", []),
    ("Thomas Mann", []), ("Leo Tolstoy", ["Lev Tolstoy", "Лев Николаевич Толстой", "Leo Nikolayevich Tolstoy"]),
    ("Fyodor Dostoevsky", ["Fyodor Dostoyevsky", "Фёдор Михайлович Достоевский"]),
    ("Anton Chekhov", ["Антон Павлович Чехов"]), ("Gabriel García Márquez", []),
    ("Isabel Allende", []), ("Mario Vargas Llosa", []), ("José Saramago", []),
    ("Fernando Pessoa", []), ("Eça de Queirós", ["Eça de Queiroz"]),
]
RESERVAS = [
    ("Mary Shelley", []), ("Bram Stoker", []), ("Oscar Wilde", []),
    ("H. G. Wells", ["Herbert George Wells"]), ("Robert Louis Stevenson", []),
    ("Louisa May Alcott", []), ("Charlotte Brontë", []), ("Emily Brontë", []),
    ("J. R. R. Tolkien", []), ("J. D. Salinger", []),
]
PASTA = Path(__file__).resolve().parent
UA = "BibliotecaTutorial/1.0 (+https://github.com/maroquio/biblioteca-tutorial; classroom catalog verification)"
trava = threading.Lock()
proxima = 0.0


def normalizar(texto):
    return re.sub(r"[^a-z0-9\u0400-\u04ff]", "", "".join(
        c for c in unicodedata.normalize("NFKD", texto.casefold()) if not unicodedata.combining(c)))


def isbn_valido(isbn):
    return bool(re.fullmatch(r"97[89]\d{10}", isbn)) and sum(
        int(n) * (1 if i % 2 == 0 else 3) for i, n in enumerate(isbn)) % 10 == 0


def obter(url):
    global proxima
    for tentativa in range(2):
        with trava:
            espera = max(0, proxima - time.monotonic())
            proxima = max(proxima, time.monotonic()) + 0.52
        if espera:
            time.sleep(espera)
        try:
            requisicao = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(requisicao, timeout=12) as resposta:
                return json.load(resposta)
        except Exception:
            if tentativa == 1:
                raise
            time.sleep(1.5)


def buscar(entrada):
    nome, variantes = entrada
    url = "https://openlibrary.org/search.json?" + urllib.parse.urlencode({
        "author": nome, "fields": "title,isbn,author_name,author_key,key", "limit": 25,
    })
    docs = obter(url).get("docs", [])
    permitidos = {normalizar(n) for n in [nome] + variantes}
    obras = []
    chave_autor = None
    for doc in docs:
        nomes, chaves = doc.get("author_name", []), doc.get("author_key", [])
        if len(nomes) != 1 or len(chaves) != 1 or normalizar(nomes[0]) not in permitidos:
            continue
        if chave_autor is not None and chaves[0] != chave_autor:
            continue
        isbns = [str(n) for n in doc.get("isbn", []) if isbn_valido(str(n))]
        if not isbns or not doc.get("key") or not doc.get("title"):
            continue
        chave_autor = chaves[0]
        # Prefere edições brasileiras quando o índice informa algum ISBN desse grupo.
        isbns.sort(key=lambda isbn: (not (isbn.startswith("97885") or isbn.startswith("97865")), isbn))
        obras.append({"titulo": doc["title"], "chave": doc["key"], "isbns": isbns})
        if len(obras) == 5:
            break
    return {"nome": nome, "chave": chave_autor, "obras": obras, "consulta": url}


def verificar_edicao(entrada):
    autor, obra, usados = entrada
    for isbn in obra["isbns"][:4]:
        if isbn in usados:
            continue
        url = f"https://openlibrary.org/isbn/{isbn}.json"
        try:
            edicao = obter(url)
        except Exception:
            continue
        chaves = {a.get("key", "").split("/")[-1] for a in edicao.get("authors", [])}
        obras_edicao = {o.get("key") for o in edicao.get("works", [])}
        if autor["chave"] not in chaves or obra["chave"] not in obras_edicao:
            continue
        if isbn not in edicao.get("isbn_13", []):
            continue
        titulo = edicao.get("title", "").strip()
        if not titulo:
            continue
        return {"titulo": titulo, "isbn": isbn, "fonte": "https://openlibrary.org" + obra["chave"]}, {
            "isbn": isbn, "edicao": "https://openlibrary.org" + edicao["key"], "consulta": url,
        }
    return None


def coletar_um(entrada):
    candidato = buscar(entrada)
    for obra in candidato["obras"]:
        resultado = verificar_edicao((candidato, obra, set()))
        if resultado:
            livro, prova = resultado
            return {"nome": candidato["nome"], "fonte": "https://openlibrary.org/authors/" + candidato["chave"], "livros": [livro]}, {"autor": candidato["nome"], "consulta": candidato["consulta"], "edicoes": [prova]}
    return None


def main():
    # Uma edição comprovada por autor prioriza a qualidade e o tempo de coleta.
    ambiguos = {"Jorge Amado", "Cecília Meireles", "Leo Tolstoy", "George Orwell", "João Cabral de Melo Neto"}
    entradas = [a for a in AUTORES if a[0] not in ambiguos] + RESERVAS[:5]
    autores, referencias, usados = [], [], set()

    def salvar():
        destino = PASTA / "catalogo.json"
        temporario = destino.with_suffix(".json.tmp")
        temporario.write_text(json.dumps({"fonte": "Open Library", "consultadoEm": "2026-10-15", "autores": sorted(autores, key=lambda a: normalizar(a["nome"]))}, ensure_ascii=False, indent=2) + "\n")
        temporario.replace(destino)
        (PASTA / "catalogo-verificacao.json").write_text(json.dumps({
            "consultadoEm": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "fontePrimaria": "https://openlibrary.org/dev/docs/api/search", "userAgent": UA,
            "criterios": ["autoria única na obra", "nome correspondente ao autor", "ISBN-13 válido e único", "ISBN confirmado na edição individual", "autor e obra presentes na mesma edição"],
            "autores": referencias,
        }, ensure_ascii=False, indent=2) + "\n")

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        tarefas = {pool.submit(coletar_um, entrada): entrada[0] for entrada in entradas}
        for tarefa in concurrent.futures.as_completed(tarefas):
            try:
                resultado = tarefa.result()
                if resultado:
                    autor, referencia = resultado
                    isbn = autor["livros"][0]["isbn"]
                    if isbn not in usados:
                        usados.add(isbn); autores.append(autor); referencias.append(referencia)
                        salvar()
                        print(f"VERIFICADO {len(autores):02d}/50: {autor['nome']} — {autor['livros'][0]['titulo']} — {isbn}", flush=True)
                else:
                    print("Sem edição inequívoca:", tarefas[tarefa], flush=True)
            except Exception as erro:
                print("Falha:", tarefas[tarefa], str(erro), flush=True)
    for entrada in RESERVAS[5:]:
        if len(autores) >= 50: break
        try:
            resultado = coletar_um(entrada)
            if resultado:
                autor, referencia = resultado
                isbn = autor["livros"][0]["isbn"]
                if isbn not in usados:
                    usados.add(isbn); autores.append(autor); referencias.append(referencia); salvar()
                    print(f"VERIFICADO {len(autores):02d}/50: {autor['nome']}", flush=True)
        except Exception as erro:
            print("Falha reserva:", entrada[0], str(erro), flush=True)
    if len(autores) != 50:
        raise RuntimeError(f"Catálogo incompleto: {len(autores)}; checkpoint preservado sem inventar dados.")
    print(f"CONCLUÍDO: {len(autores)} autores; {len(usados)} livros reais, ISBNs e edições confirmadas.", flush=True)


if __name__ == "__main__":
    main()
