/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Exemplar, type Livro } from "../api.ts";
import { Campo, Carregamento, FormularioRegistro, Pagina, useDados } from "../components/biblioteca.tsx";

export function CamposExemplar({ exemplar }: { exemplar: Exemplar | null }) {
  const livros = useDados<Livro[]>(exemplar ? null : "/api/livros");
  return <>
    {!exemplar && <>
      <Carregamento carregando={livros.carregando} erro={livros.erro} />
      {livros.dados && <Campo nome="livroId" titulo="Livro"><select id="livroId" name="livroId" required defaultValue=""><option value="">Selecione o livro</option>{livros.dados.map((livro) => <option key={livro.id} value={livro.id}>{livro.titulo} · {livro.isbn}</option>)}</select>{!livros.dados.length && <small>Cadastre um livro antes de cadastrar o exemplar.</small>}</Campo>}
    </>}
    {exemplar && <p className="nota"><strong>{exemplar.numeroRegistro}</strong> · {exemplar.titulo}</p>}
    <Campo nome="localizacao" titulo="Localização" dica="Por exemplo: Estante A, prateleira 2."><input id="localizacao" name="localizacao" required defaultValue={exemplar?.localizacao} aria-describedby="localizacao-dica" /></Campo>
    <Campo nome="estadoConservacao" titulo="Estado de conservação"><input id="estadoConservacao" name="estadoConservacao" required placeholder="Bom, novo, desgastado…" defaultValue={exemplar?.estadoConservacao} /></Campo>
  </>;
}

function CadastrarExemplar() {
  return <Pagina titulo="Cadastrar exemplar" descricao="Registre uma cópia física de um livro. O número de registro será gerado automaticamente.">
    <FormularioRegistro<Exemplar> endpoint="/api/exemplares" rotulo={(exemplar) => exemplar.numeroRegistro} campos={(exemplar) => <CamposExemplar exemplar={exemplar} />} montar={(dados) => ({ livroId: Number(dados.get("livroId")), localizacao: String(dados.get("localizacao")), estadoConservacao: String(dados.get("estadoConservacao")) })} sucesso={(exemplar) => `Exemplar ${exemplar.numeroRegistro} de “${exemplar.titulo}” cadastrado.`} retorno="/exemplares" acao="Cadastrar exemplar" />
  </Pagina>;
}

export default { id: "uc13", titulo: "Cadastrar exemplar", caminho: "/exemplares/cadastrar", Componente: CadastrarExemplar };
