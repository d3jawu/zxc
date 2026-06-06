import { serve } from "bun";
import type { ServerWebSocket, WebSocketHandler } from "bun";
import { join } from "path";
import { readFileSync } from "fs";

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function getMimeType(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return mimeTypes[ext] || "application/octet-stream";
}

const frontendDir = join(import.meta.dir, "frontend");

let ws: ServerWebSocket<undefined>;

const wsServer: WebSocketHandler<undefined> = {
  open(_ws: ServerWebSocket<undefined>) {
    console.log("WebSocket connection opened");
    ws = _ws;
  },
  message(
    ws: ServerWebSocket<undefined>,
    message: string | Buffer<ArrayBuffer>,
  ) {
    console.log("Received:", message);
    ws.send(
      JSON.stringify({
        type: "echo",
        data:
          typeof message === "string"
            ? message
            : new TextDecoder().decode(message),
      }),
    );
  },
  close(ws: ServerWebSocket<undefined>, code: number, reason: string) {
    console.log("WebSocket connection closed");
  },
};

serve({
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      server.upgrade(req);
      return;
    }
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    filePath = join(frontendDir, filePath);

    try {
      const file = readFileSync(filePath);
      return new Response(file, {
        headers: { "content-type": getMimeType(filePath) },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
  port: 3000,
  websocket: wsServer,
});

export { ws };
