import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { buscarLivros, formatarData, type Livro } from "../api.ts";

/** A resposta da API, junto com o termo que a produziu. */
type Resultado = {
  termo: string;
  livros: Livro[];
  erro: string;
};

export default function BuscarLivros() {
  // o termo mora na URL (/?q=...): recarregar a página repete a busca
  const [params, setParams] = useSearchParams();
  const termo = params.get("q") ?? "";

  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (termo === "") return;

    // se o termo mudar antes da resposta chegar, a resposta antiga é ignorada
    let ignorar = false;

    buscarLivros(termo)
      .then((livros) => {
        if (!ignorar) setResultado({ termo, livros, erro: "" });
      })
      .catch((e: Error) => {
        if (!ignorar) setResultado({ termo, livros: [], erro: e.message });
      });

    return () => {
      ignorar = true;
    };
  }, [termo]);

  // ainda não chegou resposta para o termo que está na URL
  const carregando = resultado?.termo !== termo;

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const q = String(new FormData(evento.currentTarget).get("q")).trim();

    setParams(q === "" ? {} : { q });
  }

  return (
    <section>
      {/* React 19: <title> dentro do componente vai parar no <head> */}
      <title>Buscar livros · Biblioteca</title>

      <h1>Buscar livros</h1>

      <form className="busca" onSubmit={buscar}>
        <input
          // key: quando a URL muda (menu, voltar), o campo recomeça com o termo dela
          key={termo}
          name="q"
          defaultValue={termo}
          placeholder="ISBN, título ou nome do autor"
          aria-label="Termo de busca"
        />
        <button type="submit">Buscar</button>
      </form>

      {termo === "" ? (
        <p className="dica">Digite um ISBN, parte do título ou o nome do autor.</p>
      ) : carregando ? (
        <p className="dica">Buscando…</p>
      ) : resultado.erro !== "" ? (
        <p className="erro">{resultado.erro}</p>
      ) : resultado.livros.length === 0 ? (
        <p className="dica">Nenhum livro encontrado para “{termo}”.</p>
      ) : (
        <div
          className="resultado-busca"
          role="region"
          aria-label="Livros encontrados"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>ISBN</th>
                <th>Título</th>
                <th>Autor</th>
                <th>Catalogado em</th>
              </tr>
            </thead>
            <tbody>
              {resultado.livros.map((livro) => (
                <tr key={livro.id}>
                  <td>{livro.numeroRegistro}</td>
                  <td>{livro.isbn}</td>
                  <td>{livro.titulo}</td>
                  <td>{livro.autor}</td>
                  <td>{formatarData(livro.dataCatalogacao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
