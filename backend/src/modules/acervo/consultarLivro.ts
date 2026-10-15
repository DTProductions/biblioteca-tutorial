import { sql } from "../../infrastructure/postgres";
import { diaDoCatalogo } from "./domain/dadosDoLivro";
import { livroDoCatalogo, obterLivro, type IntegracaoDoCatalogo, type LivroDoCatalogo } from "./catalogo";

/** UC02 também oferece a leitura individual por identidade bibliográfica. */
export async function consultarLivro(id: number, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<LivroDoCatalogo> {
  return livroDoCatalogo(sql, await obterLivro(sql, id), integracao, diaDoCatalogo(agora));
}
