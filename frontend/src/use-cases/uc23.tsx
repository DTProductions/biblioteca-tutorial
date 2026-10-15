/* oxlint-disable react/only-export-components -- Metadados e componente são descobertos pelo App. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { enviar, formatarData } from "../api.ts";
import { Avisos, Carregamento, Pagina, Tabela, useDados } from "../components/biblioteca.tsx";

type ResumoSeed = {
  autores: number;
  livros: number;
  exemplares: number;
  leitores: number;
  emprestimosDevolvidos: number;
  emprestimosEmDia: number;
  emprestimosAtrasados: number;
  reservasAtivas: number;
  reservasCanceladas: number;
  reservasExpiradas: number;
};
type SeedExecutado = { executado: true; resumo: ResumoSeed; dataReferencia: string };
type EstadoSeed = { executado: false } | SeedExecutado;
type ResultadoSeed = { criado: boolean; resumo: ResumoSeed; dataReferencia: string };
const contagens: { chave: keyof ResumoSeed; titulo: string }[] = [
  { chave: "autores", titulo: "Autores" },
  { chave: "livros", titulo: "Livros" },
  { chave: "exemplares", titulo: "Exemplares" },
  { chave: "leitores", titulo: "Leitores" },
  { chave: "emprestimosDevolvidos", titulo: "Empréstimos devolvidos" },
  { chave: "emprestimosEmDia", titulo: "Empréstimos em dia" },
  { chave: "emprestimosAtrasados", titulo: "Empréstimos atrasados" },
  { chave: "reservasAtivas", titulo: "Reservas ativas" },
  { chave: "reservasCanceladas", titulo: "Reservas canceladas" },
  { chave: "reservasExpiradas", titulo: "Reservas expiradas" },
];

function GerarDadosDeExemplo() {
  const consulta = useDados<EstadoSeed>("/api/seed");
  const [resultado, setResultado] = useState<ResultadoSeed | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const estado: EstadoSeed | null = resultado ? { executado: true, resumo: resultado.resumo, dataReferencia: resultado.dataReferencia } : consulta.dados;
  async function executar() {
    setEnviando(true); setErro("");
    try { setResultado(await enviar<ResultadoSeed>("/api/seed", "POST")); }
    catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  return <Pagina titulo="Gerar dados de exemplo" descricao="Prepare uma biblioteca de demonstração para explorar o catálogo, as reservas e os empréstimos.">
    <p>O conjunto inclui 50 autores reais, até cinco livros reais por autor e de um a dez exemplares por livro. Leitores e seus dados de contato são sintéticos.</p>
    <p>São gerados 120 empréstimos devolvidos, 30 em dia e 30 atrasados, além de 20 reservas ativas, dez canceladas e dez expiradas.</p>
    <p className="nota">Os dados existentes são preservados. Executar novamente consulta o mesmo conjunto, sem duplicar registros nem reiniciar a biblioteca. As situações e contagens referem-se à data em que os exemplos foram gerados.</p>
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {estado && <>
      <p>{estado.executado ? "Os dados de exemplo já foram gerados nesta biblioteca." : "Os dados de exemplo ainda não foram gerados nesta biblioteca."}</p>
      <button type="button" onClick={executar} disabled={enviando}>{enviando ? "Gerando dados de exemplo…" : "Executar seed"}</button>
    </>}
    <Avisos erro={erro} sucesso={!enviando && resultado ? (resultado.criado ? "Dados de exemplo gerados com sucesso." : "Os dados de exemplo já existem. Nenhum registro foi duplicado.") : ""} />
    {estado?.executado && <div style={{ marginTop: "2rem", maxWidth: "640px" }}>
      <h2>Dados gerados</h2>
      <p>Data de referência: <strong>{formatarData(estado.dataReferencia)}</strong>.</p>
      <Tabela titulo="Resumo dos dados de exemplo"><thead><tr><th>Registros</th><th>Quantidade</th></tr></thead><tbody>
        {contagens.map(({ chave, titulo }) => <tr key={chave} data-contagem={chave}><td>{titulo}</td><td>{estado.resumo[chave]}</td></tr>)}
      </tbody></Tabela>
      <p className="rodape-formulario acoes"><Link to="/livros">Consultar livros</Link><Link to="/leitores">Consultar leitores</Link><Link to="/emprestimos">Consultar empréstimos</Link><Link to="/reservas">Consultar reservas</Link></p>
    </div>}
  </Pagina>;
}

export default { id: "uc23", titulo: "Gerar dados de exemplo", caminho: "/livros/seed", Componente: GerarDadosDeExemplo };
