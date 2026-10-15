import { AutoriaComoConsulta } from "./adapters/AutoriaComoConsulta";
import {
  BuscarLivro,
  CadastrarLivro,
  type LivroCatalogado,
  PostgresLivroRepository,
} from "./modules/acervo";
import { PostgresAutorRepository, ProjecaoDeLivros } from "./modules/autoria";
import type { Clock } from "./shared/Clock";
import { EventBus } from "./shared/EventBus";
import { AutorId } from "./shared/identifiers";

export type UseCases = {
  cadastrarLivro: CadastrarLivro;
  buscarLivro: BuscarLivro;
};

/**
 * Composition root: este é o ÚNICO lugar do sistema que sabe, ao mesmo tempo,
 * que existem casos de uso e que existe Postgres. Trocar de banco foi trocar
 * as duas linhas de `new Postgres...` daqui (depois de as ports virarem async).
 */
export function buildUseCases(now: Clock = () => new Date()): UseCases {
  const livros = new PostgresLivroRepository();
  const autores = new PostgresAutorRepository();
  const autoria = new AutoriaComoConsulta(autores);
  const bus = new EventBus();
  const projecao = new ProjecaoDeLivros(autores);

  bus.subscribe<LivroCatalogado>("LivroCatalogado", (event) =>
    projecao.registrarEntrada(new AutorId(event.autorId)),
  );

  return {
    cadastrarLivro: new CadastrarLivro(livros, autoria, now, bus),
    buscarLivro: new BuscarLivro(livros, autoria),
  };
}
