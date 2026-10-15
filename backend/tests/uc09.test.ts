import { expect, test } from "bun:test";
import { normalizarCpf, validarDadosLeitor } from "../src/modules/leitores/domain/Leitor";
import { CadastrarLeitor } from "../src/modules/leitores/domain/CadastrarLeitor";
import { LeitoresMemoria } from "./leitoresDouble";
import { api, nomeDeTeste } from "./suporte-api";
import { cpfDeTeste } from "./leitoresApiFixture";

const leitor = { nome: " Ana Silva ", cpf: "529.982.247-25", email: " ANA@EXEMPLO.COM ", telefone: "(27) 99999-1234" };

test("UC09 normaliza CPF, e-mail, nome e telefone", () => {
  expect(validarDadosLeitor(leitor)).toEqual({ nome: "Ana Silva", cpf: "52998224725", email: "ana@exemplo.com", telefone: "27999991234" });
});

test("UC09 rejeita CPF com checksum inválido ou dígitos repetidos", () => {
  for (const cpf of ["52998224726", "11111111111", "00000000000", "abc52998224725", "5299822472"]) {
    expect(() => normalizarCpf(cpf)).toThrow("CPF inválido");
  }
});

test("UC09 exige todos os campos e valida contatos", () => {
  for (const campo of ["nome", "cpf", "email", "telefone"]) expect(() => validarDadosLeitor({ ...leitor, [campo]: " " })).toThrow("obrigatório");
  expect(() => validarDadosLeitor({ ...leitor, email: "sem-arroba" })).toThrow("E-mail inválido");
  expect(() => validarDadosLeitor({ ...leitor, telefone: "123" })).toThrow("Telefone inválido");
  expect(() => validarDadosLeitor(null)).toThrow();
});

test("UC09 impede CPF duplicado com ou sem máscara", async () => {
  const repositorio = new LeitoresMemoria();
  const cadastrar = new CadastrarLeitor(repositorio);
  await cadastrar.executar(leitor);
  await expect(cadastrar.executar({ ...leitor, cpf: "52998224725" })).rejects.toThrow("Já existe");
  expect(repositorio.itens).toHaveLength(1);
});

test("UC09 API: valida campos, normaliza CPF e rejeita duplicidade", async () => {
  const cpf = cpfDeTeste();
  const dados = { nome: nomeDeTeste("Ana"), cpf: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`, email: "ANA@EXEMPLO.COM", telefone: "(27)99999-1234" };
  const resposta = await api("POST", "/leitores", dados);
  expect(resposta.status).toBe(201);
  expect(await resposta.json()).toMatchObject({ nome: dados.nome, cpf, email: "ana@exemplo.com", telefone: "27999991234" });
  expect((await api("POST", "/leitores", { ...dados, cpf })).status).toBe(409);
  expect((await api("POST", "/leitores", { ...dados, cpf: "11111111111" })).status).toBe(400);
  for (const campo of ["nome", "cpf", "email", "telefone"]) expect((await api("POST", "/leitores", { ...dados, [campo]: "" })).status).toBe(400);
});
