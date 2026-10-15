/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parametros, type Exemplar, type Livro } from "../api.ts";
import { Acoes, Campo, Carregamento, Pagina, Seletor, Situacao, Tabela, useDados } from "../components/biblioteca.tsx";

function BuscarExemplares() {
  const [params, setParams] = useSearchParams();
  const livros = useDados<Livro[]>("/api/livros");
  const filtros = { q: params.get("q") ?? "", livroId: params.get("livroId") ?? "", situacao: params.get("situacao") ?? "" };
  const consulta = useDados<Exemplar[]>(`/api/exemplares${parametros(filtros)}`);
  function filtrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const novos = new URLSearchParams();
    for (const chave of ["q", "livroId", "situacao"]) { const valor = String(dados.get(chave) ?? "").trim(); if (valor) novos.set(chave, valor); }
    setParams(novos);
  }
  return <Pagina titulo="Buscar exemplares" descricao="Localize cada cópia física e confira sua disponibilidade para reserva ou empréstimo.">
    <form className="filtros" onSubmit={filtrar} key={params.toString()}>
      <Campo nome="q" titulo="Registro, título ou ISBN"><input id="q" name="q" defaultValue={filtros.q} /></Campo>
      {livros.dados && <Seletor nome="livroId" titulo="Livro" itens={livros.dados} rotulo={(livro) => livro.titulo} padrao={filtros.livroId} obrigatorio={false} vazio="Todos os livros" />}
      <Campo nome="situacao" titulo="Situação"><select id="situacao" name="situacao" defaultValue={filtros.situacao}><option value="">Todas</option><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="emprestado">Emprestado</option></select></Campo>
      <button type="submit">Filtrar exemplares</button>
    </form>
    <Carregamento carregando={consulta.carregando} erro={consulta.erro || livros.erro} />
    {consulta.dados && (consulta.dados.length ? <Tabela titulo="Exemplares encontrados"><thead><tr><th>Registro / Livro</th><th>Localização</th><th>Conservação</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      {consulta.dados.map((exemplar) => <tr key={exemplar.id}><td><strong>{exemplar.numeroRegistro}</strong><small className="segunda-linha">{exemplar.titulo}</small></td><td>{exemplar.localizacao}</td><td>{exemplar.estadoConservacao}</td><td><Situacao valor={exemplar.situacao} /></td><td><span className="acoes"><Acoes editar={`/exemplares/editar?id=${exemplar.id}`} excluir={`/exemplares/excluir?id=${exemplar.id}`} />{exemplar.situacao === "disponivel" && <Link to={`/reservas/criar?exemplarId=${exemplar.id}`}>Reservar</Link>}</span></td></tr>)}
    </tbody></Tabela> : <p className="vazio">Nenhum exemplar encontrado para esses filtros.</p>)}
  </Pagina>;
}

export default { id: "uc14", titulo: "Buscar exemplares", caminho: "/exemplares", Componente: BuscarExemplares };
