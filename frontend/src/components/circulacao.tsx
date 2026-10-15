import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { enviar, formatarCpf, type Exemplar, type Leitor } from "../api.ts";
import { Avisos, Campo, Carregamento, Seletor, useDados } from "./biblioteca.tsx";

export function FiltrosCirculacao({ situacoes }: { situacoes: { valor: string; nome: string }[] }) {
  const [params, setParams] = useSearchParams();
  const leitores = useDados<Leitor[]>("/api/leitores");
  const exemplares = useDados<Exemplar[]>("/api/exemplares");
  function filtrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const novos = new URLSearchParams();
    for (const chave of ["leitorId", "exemplarId", "situacao"]) { const valor = String(dados.get(chave) ?? ""); if (valor) novos.set(chave, valor); }
    setParams(novos);
  }
  return <>
    <form className="filtros" onSubmit={filtrar} key={params.toString()}>
      {leitores.dados && <Seletor nome="leitorId" titulo="Leitor" itens={leitores.dados} rotulo={(leitor) => `${leitor.nome} · ${formatarCpf(leitor.cpf)}`} padrao={params.get("leitorId") ?? ""} obrigatorio={false} vazio="Todos os leitores" />}
      {exemplares.dados && <Seletor nome="exemplarId" titulo="Exemplar" itens={exemplares.dados} rotulo={(exemplar) => `${exemplar.numeroRegistro} · ${exemplar.titulo}`} padrao={params.get("exemplarId") ?? ""} obrigatorio={false} vazio="Todos os exemplares" />}
      <Campo nome="situacao" titulo="Situação"><select id="situacao" name="situacao" defaultValue={params.get("situacao") ?? ""}><option value="">Todas</option>{situacoes.map((situacao) => <option key={situacao.valor} value={situacao.valor}>{situacao.nome}</option>)}</select></Campo>
      <button type="submit">Filtrar</button>
    </form>
    <Avisos erro={leitores.erro || exemplares.erro} />
  </>;
}

/** Cancelamento e devolução trabalham com operações existentes, nunca com IDs digitados. */
export function AcaoCirculacao<T extends { id: number }>({ endpoint, sufixo, rotulo, detalhes, acao, sucesso, retorno, vazio }: {
  endpoint: string; sufixo: string; rotulo: (item: T) => string; detalhes: (item: T) => ReactNode; acao: string; sucesso: (item: T) => string; retorno: string; vazio: string;
}) {
  const [params, setParams] = useSearchParams();
  const id = params.get("id") ?? "";
  const [revisao, setRevisao] = useState(0);
  const consulta = useDados<T[]>(sufixo === "cancelamento" ? `${endpoint}?situacao=ativa` : endpoint, revisao);
  // Um empréstimo atrasado continua aberto e também precisa permitir devolução.
  const itens = consulta.dados?.filter((item) => sufixo === "cancelamento" || ("dataDevolucao" in item && item.dataDevolucao === null));
  const escolhido = itens?.find((item) => String(item.id) === id);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function executar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setEnviando(true); setErro(""); setMensagem("");
    try {
      const item = await enviar<T>(`${endpoint}/${id}/${sufixo}`, "POST");
      setMensagem(sucesso(item)); setParams({}); setRevisao((valor) => valor + 1);
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  return <>
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {itens && (itens.length ? <div className="selecao-registro"><Seletor nome="operacaoSelecionada" titulo={sufixo === "cancelamento" ? "Reserva ativa" : "Empréstimo em aberto"} itens={itens} rotulo={rotulo} valor={id} aoMudar={(valor) => { setParams(valor ? { id: valor } : {}); setErro(""); setMensagem(""); }} /></div> : <p className="vazio">{vazio}</p>)}
    {escolhido && <form className="cadastro" onSubmit={executar} key={id}>
      <div className="resumo-operacao">{detalhes(escolhido)}</div>
      <label className="confirmacao"><input type="checkbox" name="confirmacao" required /> Confirmo os dados desta operação.</label>
      <button type="submit" disabled={enviando}>{enviando ? "Registrando…" : acao}</button>
    </form>}
    <Avisos erro={erro} sucesso={mensagem} />
    <p className="rodape-formulario"><Link to={retorno}>Voltar à consulta</Link></p>
  </>;
}
