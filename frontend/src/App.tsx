import { NavLink, Route, Routes } from "react-router-dom";
import BuscarLivros from "./pages/BuscarLivros.tsx";
import CadastrarLivro from "./pages/CadastrarLivro.tsx";

export default function App() {
  return (
    <>
      <header className="topo">
        <span className="marca">Biblioteca</span>
        <nav>
          <NavLink to="/" end>
            Buscar
          </NavLink>
          <NavLink to="/cadastrar">Cadastrar</NavLink>
        </nav>
      </header>

      <main className="conteudo">
        <Routes>
          <Route path="/" element={<BuscarLivros />} />
          <Route path="/cadastrar" element={<CadastrarLivro />} />
          <Route path="*" element={<p>Página não encontrada.</p>} />
        </Routes>
      </main>
    </>
  );
}
