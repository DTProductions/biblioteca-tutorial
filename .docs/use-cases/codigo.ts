import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type Arquivo = { caminho: string; conteudo: string; sha256: string; hashBase: string | null; comum: boolean };
const pasta = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2]?.toLowerCase();
const aplicar = process.argv.includes("--aplicar");
const indiceRaiz = process.argv.indexOf("--raiz");
const raiz = resolve(indiceRaiz >= 0 ? process.argv[indiceRaiz + 1]! : resolve(pasta, "../.."));
if (!id || !/^uc(?:0[1-9]|1[0-9]|2[0-3])$/.test(id)) {
  console.error("Uso: bun .docs/use-cases/codigo.ts uc05 [--aplicar] [--raiz diretorio]");
  process.exit(1);
}
const pacote = JSON.parse(readFileSync(resolve(pasta, "pacotes", `${id}.json`), "utf8")) as { arquivos: Arquivo[] };
const hash = (texto: string) => createHash("sha256").update(texto).digest("hex");
let diferentes = 0;
const planos: { caminho: string; arquivo: Arquivo }[] = [];
for (const arquivo of pacote.arquivos) {
  const caminho = resolve(raiz, arquivo.caminho);
  if (!caminho.startsWith(raiz + sep) || !/^(backend|frontend)\//.test(arquivo.caminho) || hash(arquivo.conteudo) !== arquivo.sha256) {
    throw new Error(`Pacote inválido: ${arquivo.caminho}`);
  }
  const atual = existsSync(caminho) ? hash(readFileSync(caminho, "utf8")) : null;
  if (atual === arquivo.sha256) continue;
  diferentes++;
  if (!aplicar) console.log(`Diferente ou ausente: ${arquivo.caminho}`);
  else if (atual !== null && atual !== arquivo.hashBase) {
    console.error(`Preservado arquivo com alterações próprias: ${arquivo.caminho}. Compare o tutorial manualmente.`);
    process.exit(2);
  }
  planos.push({ caminho, arquivo });
}
// Só grava depois de conferir todos os arquivos. Nunca sobrescreve alterações próprias.
if (aplicar) {
  for (const { caminho, arquivo } of planos) {
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(caminho, arquivo.conteudo, "utf8");
  }
  console.log(`${id.toUpperCase()}: ${planos.length} arquivos copiados da referência validada.`);
} else if (diferentes) {
  console.log("Diferenças não significam necessariamente erro. Confira o código e execute os testes da atividade.");
  process.exit(1);
} else console.log(`${id.toUpperCase()}: código idêntico à referência validada.`);
