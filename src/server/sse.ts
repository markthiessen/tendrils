import { EventEmitter } from "node:events";
import type { FastifyReply } from "fastify";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emit(event: string, data: unknown): void {
  emitter.emit("sse", event, data);
}

export function subscribe(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const handler = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  emitter.on("sse", handler);

  reply.raw.on("close", () => {
    emitter.off("sse", handler);
  });
}
