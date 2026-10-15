import { ReservarExemplar } from "../src/modules/circulacao/domain/ReservarExemplar";
import { CancelarReserva } from "../src/modules/circulacao/domain/CancelarReserva";
import { expect, test } from "bun:test";
import { cenario } from "./circulacaoDouble";
import { api, exemplarDeTeste } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";

test("UC18 cancelar libera exemplar e vaga; não permite cancelamento repetido", async () => {
  const { criar } = cenario();
  const reservar = criar(ReservarExemplar);
  const cancelar = criar(CancelarReserva);
  const reserva = await reservar.executar(1, 1); await reservar.executar(1, 2);
  expect((await cancelar.executar(reserva.id)).situacao).toBe("cancelada");
  await expect(cancelar.executar(reserva.id)).rejects.toThrow("Somente reservas ativas");
  await reservar.executar(1, 3); await reservar.executar(2, 1);
});

test("UC18 API: cancelamento preserva ID e libera a cópia para outro leitor", async () => {
  const leitor = await leitorDeTeste(); const outro = await leitorDeTeste(); const exemplar = await exemplarDeTeste();
  const reserva = await (await api("POST", "/reservas", { leitorId: leitor.id, exemplarId: exemplar.id })).json();
  const resposta = await api("POST", `/reservas/${reserva.id}/cancelamento`);
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toMatchObject({ id: reserva.id, situacao: "cancelada" });
  expect((await api("POST", `/reservas/${reserva.id}/cancelamento`)).status).toBe(409);
  expect((await api("POST", "/reservas", { leitorId: outro.id, exemplarId: exemplar.id })).status).toBe(201);
  expect((await api("POST", "/reservas/2147483647/cancelamento")).status).toBe(404);
});

test("UC18 não cancela reserva expirada ou inexistente", async () => {
  const { criar, tempo } = cenario();
  const reservar = criar(ReservarExemplar);
  const cancelar = criar(CancelarReserva);
  const reserva = await reservar.executar(1, 1);
  tempo.agora = "2026-10-22T12:00:00Z";
  await expect(cancelar.executar(reserva.id)).rejects.toThrow("Somente reservas ativas");
  await expect(cancelar.executar(99)).rejects.toThrow("não encontrada");
});
