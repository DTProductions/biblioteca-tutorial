import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import BuscarLivros from "./pages/BuscarLivros.tsx";
import CadastrarLivro from "./pages/CadastrarLivro.tsx";
import type { PaginaCasoUso } from "./components/biblioteca.tsx";

// Cada aluno acrescenta seu arquivo ucXX.tsx; não há menu ou roteador para disputar.
const modulos = import.meta.glob<{ default: PaginaCasoUso }>("./use-cases/uc[0-9][0-9].tsx", { eager: true });
const paginas = Object.values(modulos).map((modulo) => modulo.default).sort((a, b) => a.id.localeCompare(b.id));
const grupos = [
  { caminho: "/livros", titulo: "Livros" },
  { caminho: "/autores", titulo: "Autores" },
  { caminho: "/leitores", titulo: "Leitores" },
  { caminho: "/exemplares", titulo: "Exemplares" },
  { caminho: "/reservas", titulo: "Reservas" },
  { caminho: "/emprestimos", titulo: "Empréstimos" },
];

export default function App() {
  const localizacao = useLocation();
  const caminhoAtual = localizacao.pathname === "/" || localizacao.pathname === "/cadastrar" ? "/livros" : localizacao.pathname;
  const grupoAtual = grupos.find((grupo) => caminhoAtual.startsWith(grupo.caminho));
  const atividades = paginas.filter((pagina) => pagina.caminho.startsWith(grupoAtual?.caminho ?? "/livros"));
  const temBuscaLivros = paginas.some((pagina) => pagina.id === "uc02");
  const temCadastroLivro = paginas.some((pagina) => pagina.id === "uc01");
  return (
    <>
      <a className="pular-conteudo" href="#conteudo">Ir para o conteúdo</a>
      <header className="topo">
        <div className="identidade"><Link className="marca" to="/">Biblioteca</Link><span>Acervo e circulação</span></div>
        <nav aria-label="Áreas da biblioteca">
          {grupos.filter((grupo) => grupo.caminho === "/livros" || paginas.some((pagina) => pagina.caminho.startsWith(grupo.caminho))).map((grupo) => {
            const inicio = paginas.find((pagina) => pagina.caminho === grupo.caminho)?.caminho ?? paginas.find((pagina) => pagina.caminho.startsWith(grupo.caminho))?.caminho ?? "/";
            return <Link key={grupo.caminho} to={inicio} className={grupoAtual?.caminho === grupo.caminho ? "active" : ""} aria-current={grupoAtual?.caminho === grupo.caminho ? "true" : undefined}>{grupo.titulo}</Link>;
          })}
        </nav>
      </header>
      <div className="faixa-atividades">
        <nav className="atividades" aria-label={`Atividades de ${grupoAtual?.titulo ?? "livros"}`}>
          {atividades.map((pagina) => <NavLink key={pagina.id} to={pagina.caminho} end>{pagina.titulo}</NavLink>)}
          {!temBuscaLivros && grupoAtual?.caminho === "/livros" && <NavLink to="/" end>Buscar livros</NavLink>}
          {!temCadastroLivro && grupoAtual?.caminho === "/livros" && <NavLink to="/cadastrar">Cadastrar livro</NavLink>}
        </nav>
      </div>
      <main className="conteudo" id="conteudo">
        <Routes>
          {paginas.map(({ id, caminho, Componente }) => <Route key={id} path={caminho} element={<Componente />} />)}
          <Route path="/" element={temBuscaLivros ? <Navigate to={`/livros${localizacao.search}`} replace /> : <BuscarLivros />} />
          <Route path="/cadastrar" element={temCadastroLivro ? <Navigate to={`/livros/cadastrar${localizacao.search}`} replace /> : <CadastrarLivro />} />
          <Route path="*" element={<><h1>Página não encontrada</h1><p>Use o menu para escolher uma atividade disponível.</p><Link to="/">Voltar ao acervo</Link></>} />
        </Routes>
      </main>
      <footer className="rodape">Biblioteca · Gestão do acervo e atendimento ao leitor</footer>
    </>
  );
}
