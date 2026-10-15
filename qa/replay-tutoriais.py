#!/usr/bin/env python3
"""Reconstitui cada tutorial a partir dos pacotes publicados, em uma base limpa.

Uso (PostgreSQL local de QA já iniciado):
  python3 qa/replay-tutoriais.py
  python3 qa/replay-tutoriais.py --casos uc01 uc13

REPLAY_DATABASE_URL aponta para um banco administrativo onde o usuário pode criar
bancos de testes. As dependências Bun devem estar instaladas em backend/frontend.
O script conserva cópias, bancos e logs para inspeção; nunca usa o banco da app.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
from urllib.parse import urlsplit, urlunsplit
import uuid


def utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--casos", nargs="+", help="Ex.: uc05 uc01; padrão: todos os 22")
    parser.add_argument("--saida", default="qa/evidencias/replay.json")
    parser.add_argument("--diretorio", help="Pasta para conservar as cópias independentes")
    parser.add_argument("--database-url", default=os.environ.get(
        "REPLAY_DATABASE_URL", "postgres://biblioteca:biblioteca@127.0.0.1:62311/postgres"))
    args = parser.parse_args()

    raiz = Path(__file__).resolve().parents[1]
    tutoriais = raiz / ".docs/use-cases"
    manifesto_path = tutoriais / "manifesto.json"
    manifesto = json.loads(manifesto_path.read_text())
    casos = args.casos or sorted(manifesto["casos"])
    if any(not re.fullmatch(r"uc(?:0[1-9]|1[0-9]|2[0-2])", caso) for caso in casos):
        parser.error("Casos devem estar entre uc01 e uc22.")
    for executavel in ("bun", "git", "psql"):
        if not shutil.which(executavel):
            parser.error(f"Executável necessário não encontrado: {executavel}")
    for projeto in ("backend", "frontend"):
        if not (raiz / projeto / "node_modules").is_dir():
            parser.error(f"Instale as dependências em {projeto}/ antes do replay.")

    saida = (raiz / args.saida).resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)
    logs = saida.parent / "replay-logs"
    logs.mkdir(exist_ok=True)
    trabalho = Path(args.diretorio).resolve() if args.diretorio else Path(tempfile.mkdtemp(prefix="biblioteca-tutoriais-"))
    trabalho.mkdir(parents=True, exist_ok=True)
    arquivo_git = subprocess.check_output(["git", "archive", manifesto["commitInicial"]], cwd=raiz)
    url = urlsplit(args.database_url)
    if url.scheme not in ("postgres", "postgresql"):
        parser.error("Use uma URL PostgreSQL de QA.")
    identificacao = dt.datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    evidencia = {
        "inicio": utc(), "fim": None, "commitInicial": manifesto["commitInicial"],
        "manifestoSha256": digest(manifesto_path), "diretorio": str(trabalho),
        "origemCodigo": "Exclusivamente .docs/use-cases/codigo.ts e pacotes/ucXX.json",
        "casos": [], "resumo": {},
    }

    def salvar() -> None:
        aprovados = sum(bool(c.get("aprovado")) for c in evidencia["casos"])
        evidencia["resumo"] = {"executados": len(evidencia["casos"]), "aprovados": aprovados,
                               "reprovados": len(evidencia["casos"]) - aprovados}
        temporario = saida.with_suffix(".json.tmp")
        temporario.write_text(json.dumps(evidencia, ensure_ascii=False, indent=2) + "\n")
        temporario.replace(saida)

    def fechamento(caso: str) -> list[str]:
        ordem: list[str] = []
        visitando: set[str] = set()
        visitados: set[str] = set()

        def visitar(atual: str) -> None:
            if atual in visitando:
                raise ValueError(f"Ciclo de pré-requisitos em {atual}")
            if atual in visitados:
                return
            visitando.add(atual)
            for anterior in manifesto["casos"][atual]["prerequisitos"]:
                visitar(anterior)
            visitando.remove(atual)
            visitados.add(atual)
            ordem.append(atual)

        visitar(caso)
        return ordem

    for caso in casos:
        destino = trabalho / caso
        destino.mkdir()
        # O arquivo foi produzido pelo git local e contém apenas o commit informado.
        # extractall sem filter mantém compatibilidade com o Python 3.9 do macOS.
        with tarfile.open(fileobj=io.BytesIO(arquivo_git)) as arquivo:
            arquivo.extractall(destino)
        for projeto in ("backend", "frontend"):
            (destino / projeto / "node_modules").symlink_to(raiz / projeto / "node_modules", target_is_directory=True)

        ordem = fechamento(caso)
        banco = f"replay_{identificacao}_{caso}_test"
        if not re.fullmatch(r"[a-z0-9_]+_test", banco) or len(banco) > 63:
            raise ValueError("Nome inseguro para banco de testes")
        env = dict(os.environ, DATABASE_URL=urlunsplit(url._replace(path="/" + banco, query="", fragment="")))
        registro = {"id": caso, "inicio": utc(), "fim": None, "fechamento": ordem,
                    "diretorio": str(destino), "banco": banco, "aprovado": False,
                    "pacotesSha256": {uc: digest(tutoriais / "pacotes" / f"{uc}.json") for uc in ordem},
                    "etapas": []}
        evidencia["casos"].append(registro)
        pasta_log = logs / caso
        pasta_log.mkdir(exist_ok=True)

        def executar(nome: str, comando: list[str], cwd: Path, ambiente=None) -> bool:
            inicio = time.monotonic()
            try:
                processo = subprocess.run(comando, cwd=cwd, env=ambiente, capture_output=True, text=True, timeout=180)
                codigo = processo.returncode
                texto = processo.stdout + processo.stderr
            except subprocess.TimeoutExpired as erro:
                codigo = 124
                texto = f"Tempo limite de 180 segundos: {erro}\n"
            caminho_log = pasta_log / f"{len(registro['etapas']) + 1:02d}-{nome}.log"
            caminho_log.write_text(texto)
            # A URL administrativa pode conter segredo: não a gravamos na evidência.
            comando_publico = ["<URL PostgreSQL QA>" if valor == args.database_url else valor for valor in comando]
            registro["etapas"].append({"nome": nome, "comando": comando_publico, "cwd": str(cwd),
                                      "codigoSaida": codigo, "duracaoSegundos": round(time.monotonic() - inicio, 3),
                                      "log": str(caminho_log.relative_to(raiz)) if caminho_log.is_relative_to(raiz) else str(caminho_log)})
            return codigo == 0

        print(f"{caso.upper()}: base limpa; fechamento {' → '.join(ordem)}", flush=True)
        instalado = True
        for anterior in ordem:
            if not executar(f"aplicar-{anterior}", ["bun", str(tutoriais / "codigo.ts"), anterior,
                                                    "--aplicar", "--raiz", str(destino)], raiz):
                instalado = False
                break
        if instalado:
            for anterior in ordem:
                executar(f"comparar-{anterior}", ["bun", str(tutoriais / "codigo.ts"), anterior,
                                                  "--raiz", str(destino)], raiz)
            criado = executar("criar-banco", ["psql", args.database_url, "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
                                               "-c", f'CREATE DATABASE "{banco}"'], raiz)
            executar("backend-typecheck", ["bun", "run", "typecheck"], destino / "backend", env)
            if criado:
                executar("backend-teste", ["bun", "test", f"tests/{caso}.test.ts"], destino / "backend", env)
            executar("frontend-build", ["bun", "run", "build"], destino / "frontend", env)
        registro["fim"] = utc()
        registro["aprovado"] = all(etapa["codigoSaida"] == 0 for etapa in registro["etapas"])
        salvar()
        falhas = [e["nome"] for e in registro["etapas"] if e["codigoSaida"]]
        print(f"{caso.upper()}: {'APROVADO' if registro['aprovado'] else 'FALHOU: ' + ', '.join(falhas)}", flush=True)

    evidencia["fim"] = utc()
    evidencia["manifestoInalteradoDuranteReplay"] = digest(manifesto_path) == evidencia["manifestoSha256"]
    evidencia["pacotesInalteradosDuranteReplay"] = all(
        digest(tutoriais / "pacotes" / f"{uc}.json") == sha
        for caso in evidencia["casos"] for uc, sha in caso["pacotesSha256"].items())
    salvar()
    print(json.dumps(evidencia["resumo"], ensure_ascii=False), flush=True)
    print(f"Evidência: {saida}", flush=True)
    return 0 if evidencia["resumo"]["reprovados"] == 0 and evidencia["manifestoInalteradoDuranteReplay"] and evidencia["pacotesInalteradosDuranteReplay"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
