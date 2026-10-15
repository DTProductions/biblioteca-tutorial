/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Autor, type Livro } from "../api.ts";
import { Campo, Carregamento, FormularioRegistro, Pagina, useDados } from "../components/biblioteca.tsx";

export function CamposLivro({ livro }: { livro: Livro | null }) {
  const autores = useDados<Autor[]>("/api/autores");
  return <>
    <Campo nome="isbn" titulo="ISBN-13" dica="Informe os 13 dígitos, com ou sem hífens."><input id="isbn" name="isbn" required defaultValue={livro?.isbn} aria-describedby="isbn-dica" /></Campo>
    <Campo nome="titulo" titulo="Título"><input id="titulo" name="titulo" required defaultValue={livro?.titulo} /></Campo>
    <Carregamento carregando={autores.carregando} erro={autores.erro} />
    {autores.dados && <Campo nome="autorId" titulo="Autor"><select id="autorId" name="autorId" required defaultValue={livro?.autorId ?? ""}>
      <option value="">Selecione o autor</option>
      {autores.dados.map((autor) => <option key={autor.id} value={autor.id}>{autor.nome} · {autor.tipo === "literatura" ? "Literatura" : "Didático"}</option>)}
    </select>{!autores.dados.length && <small>Cadastre um autor antes de cadastrar o livro.</small>}</Campo>}
  </>;
}

function CadastrarLivro() {
  return <Pagina titulo="Cadastrar livro" descricao="Registre a edição no catálogo. As cópias físicas serão cadastradas como exemplares.">
    <FormularioRegistro<Livro> endpoint="/api/livros" rotulo={(livro) => livro.titulo} campos={(livro) => <CamposLivro livro={livro} />} montar={(dados) => ({ isbn: String(dados.get("isbn")), titulo: String(dados.get("titulo")), autorId: Number(dados.get("autorId")) })} sucesso={(livro) => `Livro “${livro.titulo}” cadastrado no catálogo.`} retorno="/livros" acao="Cadastrar livro" aviso="Limite por autor: 5 títulos de literatura ou 10 títulos didáticos. A quantidade de exemplares não altera esse limite." />
  </Pagina>;
}

export default { id: "uc01", titulo: "Cadastrar livro", caminho: "/livros/cadastrar", Componente: CadastrarLivro };
