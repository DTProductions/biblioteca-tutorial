// ANTES da fila: o pedido é preparado dentro da requisição.
// O navegador só recebe a resposta quando o lanche fica pronto.
// Rode com:  bun sem-fila.ts

const PREP_MS = 3000; // quanto demora preparar um lanche

type Order = { senha: number; item: string; status: string; worker: string };

// os pedidos moram na memória deste processo: reiniciou, perdeu
const orders: Order[] = [];

Bun.serve({
  port: 3300,
  routes: {
    // a página
    "/": () => new Response(Bun.file(new URL("./index.html", import.meta.url))),

    "/pedidos": {
      // GET: os últimos pedidos (ainda não existe fila para mostrar)
      GET: () => Response.json({ fila: null, pedidos: orders.slice(-12).reverse() }),

      // POST: anota o pedido E prepara o lanche, tudo antes de responder
      POST: async (req) => {
        const { item } = await req.json();
        // se o trabalho falha, a requisição falha junto
        if (item === "pedra") return Response.json({ error: "Não sei fazer sopa de pedra" }, { status: 500 });

        const order = { senha: orders.length + 1, item, status: "em preparo", worker: "o próprio servidor" };
        orders.push(order);

        // O trabalho lento. sleepSync imita um cálculo pesado: enquanto ele
        // roda, este processo não atende mais ninguém, nem para abrir a página.
        Bun.sleepSync(PREP_MS);

        order.status = "pronto";
        return Response.json({ senha: order.senha }, { status: 201 });
      },
    },
  },
});

console.log("Sem fila em http://localhost:3300");
