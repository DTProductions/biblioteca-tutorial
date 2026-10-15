/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, enviar } from "../api.ts";

export type PaginaCasoUso = { id: string; titulo: string; caminho: string; Componente: ComponentType };

/** Ignora respostas antigas quando a URL muda ou a página é desmontada. */
export function useDados<T>(caminho: string | null, revisao = 0) {
  const [resultado, setResultado] = useState<{ caminho: string | null; revisao: number; dados: T | null; erro: string } | null>(null);
  useEffect(() => {
    if (!caminho) return;
    let ignorar = false;
    api<T>(caminho).then(
      (dados) => { if (!ignorar) setResultado({ caminho, revisao, dados, erro: "" }); },
      (erro: Error) => { if (!ignorar) setResultado({ caminho, revisao, dados: null, erro: erro.message }); },
    );
    return () => { ignorar = true; };
  }, [caminho, revisao]);
  const atual = resultado?.caminho === caminho && resultado?.revisao === revisao;
  return { dados: atual ? resultado.dados : null, erro: atual ? resultado.erro : "", carregando: Boolean(caminho) && !atual };
}

export function Pagina({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return <section>
    <title>{titulo} · Biblioteca</title>
    <div className="cabecalho-pagina"><h1>{titulo}</h1><p>{descricao}</p></div>
    {children}
  </section>;
}

export function Avisos({ erro = "", sucesso = "" }: { erro?: string; sucesso?: string }) {
  return <>
    {erro && <p className="erro" role="alert">{erro}</p>}
    {sucesso && <p className="sucesso" role="status">{sucesso}</p>}
  </>;
}

export function Situacao({ valor }: { valor: string }) {
  const rotulos: Record<string, string> = { disponivel: "Disponível", reservado: "Reservado", emprestado: "Emprestado", ativa: "Ativa", cancelada: "Cancelada", atendida: "Atendida", expirada: "Expirada", em_aberto: "Em aberto", atrasado: "Atrasado", devolvido: "Devolvido" };
  return <span className={`situacao situacao-${valor}`}>{rotulos[valor] ?? valor}</span>;
}

export function Campo({ nome, titulo, children, dica }: { nome: string; titulo: string; children: ReactNode; dica?: string }) {
  return <div className="campo"><label htmlFor={nome}>{titulo}</label>{children}{dica && <small id={`${nome}-dica`}>{dica}</small>}</div>;
}

export function Seletor<T extends { id: number }>({ nome, titulo, itens, rotulo, valor, padrao = "", aoMudar, obrigatorio = true, vazio = "Selecione uma opção" }: {
  nome: string; titulo: string; itens: T[]; rotulo: (item: T) => string; valor?: string; padrao?: string; aoMudar?: (valor: string) => void; obrigatorio?: boolean; vazio?: string;
}) {
  return <Campo nome={nome} titulo={titulo}>
    <select id={nome} name={nome} required={obrigatorio} value={valor} onChange={aoMudar ? (e) => aoMudar(e.target.value) : undefined} defaultValue={valor === undefined ? padrao : undefined}>
      <option value="">{vazio}</option>
      {itens.map((item) => <option key={item.id} value={item.id}>{rotulo(item)}</option>)}
    </select>
  </Campo>;
}

export function Carregamento({ carregando, erro }: { carregando: boolean; erro: string }) {
  return <>{carregando && <p className="dica" role="status">Carregando…</p>}<Avisos erro={erro} /></>;
}

export function Tabela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="resultado-busca" role="region" aria-label={titulo} tabIndex={0}><table>{children}</table></div>;
}

/** O termo fica na URL: recarregar ou voltar preserva a consulta. */
export function Busca({ dica, titulo = "Termo de busca" }: { dica: string; titulo?: string }) {
  const [params, setParams] = useSearchParams();
  const termo = params.get("q") ?? "";
  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const q = String(new FormData(evento.currentTarget).get("q") ?? "").trim();
    setParams(q ? { q } : {});
  }
  return <form className="busca" onSubmit={buscar}>
    <Campo nome="q" titulo={titulo}><input key={termo} id="q" name="q" defaultValue={termo} placeholder={dica} /></Campo>
    <button type="submit">Buscar</button>
  </form>;
}

export function Acoes({ editar, excluir }: { editar?: string; excluir?: string }) {
  return <span className="acoes">{editar && <Link to={editar}>Editar</Link>}{excluir && <Link to={excluir}>Excluir</Link>}</span>;
}

/** Edição sempre escolhe um registro existente; nenhum ID precisa ser digitado. */
export function FormularioRegistro<T extends { id: number }>({ endpoint, editar = false, rotulo, campos, montar, sucesso, retorno, acao, aviso }: {
  endpoint: string; editar?: boolean; rotulo: (item: T) => string; campos: (item: T | null) => ReactNode; montar: (dados: FormData) => unknown; sucesso: (item: T) => string; retorno: string; acao: string; aviso?: string;
}) {
  const [params, setParams] = useSearchParams();
  const id = params.get("id") ?? "";
  const [revisao, setRevisao] = useState(0);
  const consulta = useDados<T[]>(editar ? endpoint : null, revisao);
  const escolhido = consulta.dados?.find((item) => String(item.id) === id) ?? null;
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function gravar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    setEnviando(true); setErro(""); setMensagem("");
    try {
      const item = await enviar<T>(editar ? `${endpoint}/${id}` : endpoint, editar ? "PUT" : "POST", montar(dados));
      setMensagem(sucesso(item));
      if (editar) setRevisao((valor) => valor + 1); else formulario.reset();
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  return <>
    {editar && <>
      <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
      {consulta.dados && <div className="selecao-registro"><Seletor nome="registroSelecionado" titulo="Registro para editar" itens={consulta.dados} rotulo={rotulo} valor={id} aoMudar={(valor) => { setParams(valor ? { id: valor } : {}); setErro(""); setMensagem(""); }} />{!consulta.dados.length && <p className="dica">Nenhum registro cadastrado.</p>}</div>}
    </>}
    {(!editar || escolhido) && <form key={`${id}-${revisao}`} className="cadastro" onSubmit={gravar}>
      {campos(escolhido)}
      {aviso && <p className="nota">{aviso}</p>}
      <button disabled={enviando} type="submit">{enviando ? "Salvando…" : acao}</button>
    </form>}
    <Avisos erro={erro} sucesso={mensagem} />
    <p className="rodape-formulario"><Link to={retorno}>Voltar à consulta</Link></p>
  </>;
}

export function ExclusaoRegistro<T extends { id: number }>({ endpoint, rotulo, retorno, aviso }: { endpoint: string; rotulo: (item: T) => string; retorno: string; aviso: string }) {
  const [params, setParams] = useSearchParams();
  const id = params.get("id") ?? "";
  const [revisao, setRevisao] = useState(0);
  const consulta = useDados<T[]>(endpoint, revisao);
  const escolhido = consulta.dados?.find((item) => String(item.id) === id);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function excluir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true); setErro(""); setMensagem("");
    try {
      await api<void>(`${endpoint}/${id}`, { method: "DELETE" });
      setMensagem("Registro excluído com sucesso."); setParams({}); setRevisao((valor) => valor + 1);
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  return <>
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {consulta.dados && <div className="selecao-registro"><Seletor nome="registroSelecionado" titulo="Registro para excluir" itens={consulta.dados} rotulo={rotulo} valor={id} aoMudar={(valor) => { setParams(valor ? { id: valor } : {}); setErro(""); setMensagem(""); }} />{!consulta.dados.length && <p className="dica">Nenhum registro cadastrado.</p>}</div>}
    {escolhido && <form key={id} className="cadastro" onSubmit={excluir}>
      <p className="nota">{aviso}</p>
      <label className="confirmacao"><input type="checkbox" name="confirmacao" required /> Confirmo a exclusão de {rotulo(escolhido)}.</label>
      <button className="perigo" type="submit" disabled={enviando}>{enviando ? "Excluindo…" : "Excluir definitivamente"}</button>
    </form>}
    <Avisos erro={erro} sucesso={mensagem} />
    <p className="rodape-formulario"><Link to={retorno}>Voltar à consulta</Link></p>
  </>;
}
