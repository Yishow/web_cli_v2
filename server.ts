import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { randomUUID } from "crypto";

import {
  InvalidSessionNameError,
  killSession,
  listSessions,
  sendJson,
} from "./src/tmux-sessions";
import {
  createPtyClientMessageState,
  handlePtyClientMessage,
} from "./src/pty-client-message";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "127.0.0.1";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

function handlePTYConnection(ws: WebSocket, sessionName?: string) {
  const id = randomUUID();
  const tmuxSession = sessionName || `webcli-${id.slice(0, 8)}`;

  let ptyProcess: pty.IPty | null = null;
  const messageState = createPtyClientMessageState();

  function spawnPTY(cols: number, rows: number) {
    try {
      // 使用 tmux -A 實現持久化：session 存在就 attach，不存在就建立
      ptyProcess = pty.spawn(
        "tmux",
        [
          "new-session",
          "-A",
          "-s",
          tmuxSession,
          "-c",
          process.env.HOME || "/",
        ],
        {
          name: "xterm-256color",
          cols,
          rows,
          cwd: process.env.HOME || "/",
          env: cleanEnv(),
        }
      );

      console.log(`[tmux] Spawned/attached session: ${tmuxSession}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to spawn tmux: ${msg}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`\r\n\x1b[31mFailed to start tmux: ${msg}\x1b[0m\r\n`);
        ws.close();
      }
      return;
    }

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    });
  }

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");
    const action = handlePtyClientMessage(messageState, input, ptyProcess !== null);

    if (action.type === "spawn") {
      spawnPTY(action.cols, action.rows);

      if (ptyProcess) {
        for (const bufferedInput of action.bufferedInput) {
          ptyProcess.write(bufferedInput);
        }
      }

      return;
    }

    if (action.type === "resize") {
      ptyProcess?.resize(action.cols, action.rows);
      return;
    }

    if (action.type === "write") {
      ptyProcess?.write(action.data);
    }
  });

  ws.on("close", () => {
    if (ptyProcess) {
      ptyProcess.kill();
    }
    console.log(`[tmux] Connection closed for session: ${tmuxSession}`);
  });

  // 第一次收到 resize 時才 spawn，避免尺寸錯誤
  // 這裡先不 spawn，等前端第一次 resize 再建立
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    const pathname = parsedUrl.pathname || "/";

    if (pathname === "/api/sessions" && req.method === "GET") {
      try {
        sendJson(res, 200, listSessions());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[api/sessions] Failed to list sessions:", message);
        sendJson(res, 500, { error: "Failed to list tmux sessions" });
      }
      return;
    }

    const deleteMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (deleteMatch && req.method === "DELETE") {
      const sessionName = decodeURIComponent(deleteMatch[1]);

      try {
        killSession(sessionName);
        sendJson(res, 200, { success: true, name: sessionName });
      } catch (error) {
        if (error instanceof InvalidSessionNameError) {
          sendJson(res, 400, { error: "Invalid session name" });
          return;
        }

        const tmuxError = error as Error & { status?: number };
        if (tmuxError?.status === 1) {
          sendJson(res, 404, { error: `Session "${sessionName}" not found` });
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error(`[api/sessions] Failed to kill "${sessionName}":`, message);
        sendJson(res, 500, { error: "Failed to kill tmux session" });
      }
      return;
    }

    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url || "/", true);

    if (pathname === "/api/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const sessionName = query.session as string | undefined;
        handlePTYConnection(ws, sessionName);
      });
    } else {
      app.getUpgradeHandler()(req, socket, head);
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> web_cli_v2 ready on http://${hostname}:${port}`);
    console.log(`> WebSocket endpoint: ws://${hostname}:${port}/api/terminal?session=xxx`);
  });
});