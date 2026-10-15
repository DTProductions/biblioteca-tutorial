/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Leitor } from "../api.ts";
import { Campo, FormularioRegistro, Pagina } from "../components/biblioteca.tsx";

export function CamposLeitor({ leitor }: { leitor: Leitor | null }) {
  return <>
    <Campo nome="nome" titulo="Nome completo"><input id="nome" name="nome" required autoComplete="name" defaultValue={leitor?.nome} /></Campo>
    <Campo nome="cpf" titulo="CPF" dica="CPF único, com ou sem pontuação."><input id="cpf" name="cpf" required inputMode="numeric" defaultValue={leitor?.cpf} aria-describedby="cpf-dica" /></Campo>
    <Campo nome="email" titulo="E-mail"><input id="email" name="email" type="email" required autoComplete="email" defaultValue={leitor?.email} /></Campo>
    <Campo nome="telefone" titulo="Telefone"><input id="telefone" name="telefone" type="tel" required autoComplete="tel" defaultValue={leitor?.telefone} /></Campo>
  </>;
}

export function dadosLeitor(dados: FormData) {
  return { nome: String(dados.get("nome")), cpf: String(dados.get("cpf")), email: String(dados.get("email")), telefone: String(dados.get("telefone")) };
}

function CadastrarLeitor() {
  return <Pagina titulo="Cadastrar leitor" descricao="Informe os dados obrigatórios para identificar o leitor nas reservas e nos empréstimos.">
    <FormularioRegistro<Leitor> endpoint="/api/leitores" rotulo={(leitor) => leitor.nome} campos={(leitor) => <CamposLeitor leitor={leitor} />} montar={dadosLeitor} sucesso={(leitor) => `Leitor “${leitor.nome}” cadastrado.`} retorno="/leitores" acao="Cadastrar leitor" />
  </Pagina>;
}

export default { id: "uc09", titulo: "Cadastrar leitor", caminho: "/leitores/cadastrar", Componente: CadastrarLeitor };
