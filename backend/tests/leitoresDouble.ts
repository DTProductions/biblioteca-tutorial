import type { DadosLeitor, Leitor } from "../src/modules/leitores/domain/Leitor";
import type { RepositorioLeitores } from "../src/modules/leitores/domain/RepositorioLeitores";
import { NotFound } from "../src/shared/errors";

export class LeitoresMemoria implements RepositorioLeitores {
  readonly itens: Leitor[] = [];
  async buscar(q = "") { return this.itens.filter(l => `${l.nome} ${l.cpf} ${l.email}`.toLowerCase().includes(q.toLowerCase())); }
  async obter(id: number) {
    const leitor = this.itens.find(l => l.id === id);
    if (!leitor) throw new NotFound("Leitor não encontrado.");
    return leitor;
  }
  async existeCpf(cpf: string, excetoId: number | null = null) { return this.itens.some(l => l.cpf === cpf && l.id !== excetoId); }
  async inserir(dados: DadosLeitor) { const leitor = { ...dados, id: this.itens.length + 1 }; this.itens.push(leitor); return leitor; }
  async alterar(id: number, dados: DadosLeitor) { const leitor = await this.obter(id); Object.assign(leitor, dados); return leitor; }
  async remover(id: number) { this.itens.splice(this.itens.findIndex(l => l.id === id), 1); }
}

export const ana = { nome: "Ana Silva", cpf: "52998224725", email: "ana@exemplo.com", telefone: "27999991234" };
export const bruno = { nome: "Bruno Souza", cpf: "11144477735", email: "bruno@exemplo.com", telefone: "27999994321" };
