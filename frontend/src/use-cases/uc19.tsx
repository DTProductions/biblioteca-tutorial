/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { enviar, formatarCpf, formatarData, type Emprestimo, type Exemplar, type Leitor, type Reserva } from "../api.ts";
import { Avisos, Carregamento, Pagina, Seletor, useDados } from "../components/biblioteca.tsx";

function RegistrarEmprestimo() {
  const [params] = useSearchParams();
  const [leitorId, setLeitorId] = useState(params.get("leitorId") ?? "");
  const [exemplarId, setExemplarId] = useState(params.get("exemplarId") ?? "");
  const [revisao, setRevisao] = useState(0);
  const leitores = useDados<Leitor[]>("/api/leitores");
  const exemplares = useDados<Exemplar[]>("/api/exemplares", revisao);
  const reservas = useDados<Reserva[]>(leitorId ? `/api/reservas?leitorId=${leitorId}&situacao=ativa` : null, revisao);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState<Emprestimo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const opcoes = exemplares.dados?.filter((exemplar) => exemplar.situacao === "disponivel" || (exemplar.situacao === "reservado" && reservas.dados?.some((reserva) => reserva.exemplarId === exemplar.id))) ?? [];
  async function emprestar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setEnviando(true); setErro(""); setSalvo(null);
    try {
      setSalvo(await enviar<Emprestimo>("/api/emprestimos", "POST", { leitorId: Number(leitorId), exemplarId: Number(exemplarId) }));
      setExemplarId(""); setRevisao((valor) => valor + 1);
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  return <Pagina titulo="Registrar empréstimo" descricao="Associe um exemplar ao leitor. A devolução será prevista automaticamente para daqui a 14 dias corridos.">
    <Carregamento carregando={leitores.carregando || exemplares.carregando || reservas.carregando} erro={leitores.erro || exemplares.erro || reservas.erro} />
    {leitores.dados && exemplares.dados && (leitores.dados.length ? <form className="cadastro" onSubmit={emprestar}>
      <Seletor nome="leitorId" titulo="Leitor" itens={leitores.dados} rotulo={(leitor) => `${leitor.nome} · ${formatarCpf(leitor.cpf)}`} valor={leitorId} aoMudar={(valor) => { setLeitorId(valor); setExemplarId(""); setErro(""); }} />
      {leitorId && !reservas.carregando && !reservas.erro && <>
        <Seletor nome="exemplarId" titulo="Exemplar para empréstimo" itens={opcoes} rotulo={(exemplar) => `${exemplar.numeroRegistro} · ${exemplar.titulo}${exemplar.situacao === "reservado" ? " (reserva deste leitor)" : ""}`} valor={exemplarId} aoMudar={setExemplarId} />
        {!opcoes.length && <p className="dica">Não há exemplares disponíveis ou reservados para este leitor.</p>}
      </>}
      <p className="nota">Até três empréstimos em aberto por leitor. Uma reserva deste leitor será atendida automaticamente ao registrar o empréstimo.</p>
      <button type="submit" disabled={enviando || !leitorId || !exemplarId || reservas.carregando || Boolean(reservas.erro)}>{enviando ? "Registrando…" : "Registrar empréstimo"}</button>
    </form> : <p className="vazio">Cadastre um leitor antes de registrar um empréstimo.</p>)}
    <Avisos erro={erro} />
    {salvo && <div className="sucesso" role="status"><p>Empréstimo registrado para <strong>{salvo.leitorNome}</strong>: {salvo.numeroRegistro} · {salvo.livroTitulo}.</p><p>Devolução prevista: <strong>{formatarData(salvo.dataPrevistaDevolucao)}</strong>.</p><Link to={`/emprestimos?leitorId=${salvo.leitorId}`}>Consultar empréstimos do leitor</Link></div>}
  </Pagina>;
}

export default { id: "uc19", titulo: "Registrar empréstimo", caminho: "/emprestimos/registrar", Componente: RegistrarEmprestimo };
