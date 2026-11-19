import { RedisClient } from "bun";

// 1. O cliente Redis do próprio Bun: nenhum pacote para instalar.
//    Aponta para a fila do compose.yaml desta pasta.
const queue = new RedisClient("redis://localhost:6400");

const STREAM = "pedidos"; // a fila: um stream do Redis
const GROUP = "workers"; // o grupo de workers que divide as mensagens
const DEAD = `${STREAM}:mortas`; // para onde vão as mensagens que ninguém conseguiu processar

// 2. Os números da fila. O Redis não tem console web: a página faz esse papel.
async function queueNumbers() {
  const total = await queue.send("XLEN", [STREAM]);
  const dead = await queue.send("XLEN", [DEAD]);
  // XINFO GROUPS devolve um mapa por grupo. Antes do primeiro worker não há
  // grupo: tudo o que foi publicado está aguardando.
  const [group] = total ? await queue.send("XINFO", ["GROUPS", STREAM]) : [];
  return {
    aguardando: group ? (group.lag ?? 0) : total, // publicadas e ainda não entregues
    pendentes: group ? group.pending : 0, // entregues a um worker e ainda não confirmadas
    mortas: dead, // desistimos delas
  };
}

Bun.serve({
  port: 3300,
  routes: {
    // a página
    "/": () => new Response(Bun.file(new URL("./index.html", import.meta.url))),

    "/pedidos": {
      // GET: os números da fila e os últimos pedidos
      GET: async () => {
        const last = Number((await queue.get("senha")) ?? 0);
        const pedidos = [];
        for (let senha = last; senha > Math.max(0, last - 12); senha--) {
          pedidos.push({ senha, ...(await queue.hgetall(`pedido:${senha}`)) });
        }
        return Response.json({ fila: await queueNumbers(), pedidos });
      },

      // POST: anota o pedido, publica na fila e responde na hora
      POST: async (req) => {
        const { item } = await req.json();
        if (typeof item !== "string" || !item.trim()) {
          return Response.json({ error: "Informe o item" }, { status: 400 });
        }

        // o estado do pedido fica onde o servidor e o worker enxergam
        const senha = await queue.incr("senha");
        await queue.send("HSET", [`pedido:${senha}`, "item", item.trim(), "status", "na fila"]);

        // XADD publica. A mensagem leva só a senha: o worker busca o resto
        // quando for trabalhar. MAXLEN ~ 1000 impede o stream de crescer sem fim.
        const message = JSON.stringify({ senha });
        const id = await queue.send("XADD", [STREAM, "MAXLEN", "~", "1000", "*", "dados", message]);

        // 202 Accepted: "recebi e vou fazer". Não é 201 "está feito".
        return Response.json({ senha, mensagem: id }, { status: 202 });
      },
    },
  },
});

console.log("Com fila em http://localhost:3300");
