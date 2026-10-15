/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Leitor } from "../api.ts";
import { FormularioRegistro, Pagina } from "../components/biblioteca.tsx";
import { CamposLeitor, dadosLeitor } from "./uc09.tsx";

function AtualizarLeitor() {
  return <Pagina titulo="Atualizar leitor" descricao="Escolha o leitor e atualize seus dados cadastrais e de contato.">
    <FormularioRegistro<Leitor> endpoint="/api/leitores" editar rotulo={(leitor) => `${leitor.nome} · ${leitor.cpf}`} campos={(leitor) => <CamposLeitor leitor={leitor} />} montar={dadosLeitor} sucesso={(leitor) => `Leitor “${leitor.nome}” atualizado.`} retorno="/leitores" acao="Salvar alterações" />
  </Pagina>;
}

export default { id: "uc11", titulo: "Atualizar leitor", caminho: "/leitores/editar", Componente: AtualizarLeitor };
