import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pasta = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2]?.toLowerCase();
const somenteVerificar = process.argv.includes("--verificar");
const manifesto = JSON.parse(readFileSync(resolve(pasta, "manifesto.json"), "utf8"));
if (!id || !/^uc(?:0[1-9]|1[0-9]|2[0-2])$/.test(id) || !manifesto.casos[id]) {
  console.error("Uso: bun .docs/use-cases/preparar.ts uc05 [--verificar]");
  process.exit(1);
}

function git(args: string[], aceitarFalha = false): string {
  const resultado = spawnSync("git", args, { encoding: "utf8" });
  if (resultado.status !== 0 && !aceitarFalha) {
    console.error(resultado.stderr || resultado.stdout || "Não foi possível executar Git.");
    process.exit(1);
  }
  return resultado.status === 0 ? resultado.stdout.trim() : "";
}

const raiz = git(["rev-parse", "--show-toplevel"]);
process.chdir(raiz);
const origem = git(["remote", "get-url", "origin"]);
const central = "https://github.com/maroquio/biblioteca-tutorial.git";
if (!somenteVerificar && /github\.com[:/]maroquio\/biblioteca-tutorial(?:\.git)?$/.test(origem)) {
  console.error("origin aponta para o professor. Clone seu fork pessoal antes de criar a atividade.");
  process.exit(1);
}
const upstream = git(["remote", "get-url", "upstream"], true);
if (!upstream) git(["remote", "add", "upstream", central]);
else if (!/github\.com[:/]maroquio\/biblioteca-tutorial(?:\.git)?$/.test(upstream)) {
  console.error("O remote upstream não aponta para maroquio/biblioteca-tutorial. Confira git remote -v.");
  process.exit(1);
}
const base = "saas-evolution/fase01";
git(["fetch", "upstream", `refs/heads/${base}:refs/remotes/upstream/${base}`]);

const faltantes: string[] = [];
const visitados = new Set<string>();
function verificar(caso: string) {
  for (const requisito of manifesto.casos[caso].prerequisitos as string[]) {
    if (visitados.has(requisito)) continue;
    visitados.add(requisito);
    verificar(requisito);
    for (const caminho of [`backend/src/use-cases/${requisito}.ts`, `frontend/src/use-cases/${requisito}.tsx`]) {
      const resultado = spawnSync("git", ["cat-file", "-e", `upstream/${base}:${caminho}`], { encoding: "utf8" });
      if (resultado.status !== 0 && !faltantes.includes(requisito)) faltantes.push(requisito);
    }
  }
}
verificar(id);
if (faltantes.length) {
  console.error(`Atividade bloqueada. Aguarde o professor integrar na ${base}:`);
  for (const requisito of faltantes) console.error(`  ${requisito.toUpperCase()} — ${manifesto.casos[requisito].titulo}`);
  console.error("Não crie a branch a partir de uma branch de outro aluno. Repita este comando após os merges.");
  process.exit(2);
}
console.log(`Pré-requisitos de ${id.toUpperCase()} integrados no repositório central.`);
if (somenteVerificar) process.exit(0);
if (git(["status", "--porcelain"])) {
  console.error("Há alterações locais. Guarde seu trabalho antes de criar outra atividade.");
  process.exit(1);
}
git(["switch", "--no-track", "-c", id, `upstream/${base}`]);
console.log(`Branch ${id} criada a partir de upstream/${base}. Ao terminar: git push -u origin ${id}`);
