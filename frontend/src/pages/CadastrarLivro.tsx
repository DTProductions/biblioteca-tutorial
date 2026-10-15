import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { cadastrarLivro, formatarData, type Livro } from "../api.ts";

export default function CadastrarLivro() {
  const [salvo, setSalvo] = useState<Livro | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);

    setEnviando(true);
    setErro("");
    setSalvo(null);

    try {
      const livro = await cadastrarLivro({
        isbn: String(dados.get("isbn")),
        titulo: String(dados.get("titulo")),
        autorId: Number(dados.get("autorId")),
      });

      setSalvo(livro);
      formulario.reset();
    } catch (e) {
      // as regras continuam no backend: aqui só mostramos o que ele respondeu
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <title>Cadastrar livro · Biblioteca</title>

      <h1>Cadastrar livro</h1>

      <form className="cadastro" onSubmit={cadastrar}>
        <label>
          ISBN
          <input name="isbn" required placeholder="9780321125217" />
        </label>

        <label>
          Título
          <input name="titulo" required />
        </label>

        <label>
          Autor (id)
          <input name="autorId" type="number" min="1" required />
          <small>
            Carga inicial: 1 Eric Evans · 2 Robert C. Martin · 3 Harper Lee · 4 Jane
            Austen
          </small>
        </label>

        <button type="submit" disabled={enviando}>
          {enviando ? "Cadastrando…" : "Cadastrar"}
        </button>
      </form>

      {erro !== "" && <p className="erro">{erro}</p>}

      {salvo !== null && (
        <div className="sucesso">
          <p>
            <strong>{salvo.titulo}</strong> entrou no catálogo em {formatarData(salvo.dataCatalogacao)}.
          </p>
          <Link to={`/?q=${salvo.isbn}`}>Ver no acervo</Link>
        </div>
      )}
    </section>
  );
}
