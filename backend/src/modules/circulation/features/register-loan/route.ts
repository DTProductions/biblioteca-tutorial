import type { Hono } from "hono";
import { inTransaction } from "../../../../infrastructure/transaction";
import { parsePositiveId, readJsonBody } from "../../../../shared/http";
import { circulationDependencies } from "../../infrastructure/dependencies";
import { loanJson } from "../../infrastructure/json";
import { RegisterLoan } from "./RegisterLoan";

/**
 * UC19: registra um empréstimo.
 *
 * TODO (atividade): peça aqui o comprovante do empréstimo, com
 * scheduleLoanReceipt, de infrastructure/loanReceiptJob.ts. Antes, descubra
 * onde fica o COMMIT nesta rota: o comprovante só pode ser pedido depois dele.
 */
export function registerRoutes(api: Hono): void {
  api.post("/emprestimos", async c => {
    const body = await readJsonBody(c);
    const readerId = parsePositiveId(body["leitorId"], "Leitor");
    const copyId = parsePositiveId(body["exemplarId"], "Exemplar");
    const loan = await inTransaction(tx => new RegisterLoan(...circulationDependencies(tx)).execute(readerId, copyId));
    return c.json(loanJson(loan), 201);
  });
}
