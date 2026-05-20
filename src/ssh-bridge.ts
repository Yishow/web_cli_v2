import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import { WebSocket } from "ws";

import { parseResizeMessage } from "./pty-client-message";
import { encodeSshErrorControlMessage, SSH_READY_CONTROL } from "./ssh-control-message";
import { parseSshConnectMessage } from "./ssh-client-message";

function sendControlMessage(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

function formatSshConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const errorWithLevel = error as Error & { level?: string };

  if (errorWithLevel.level === "client-authentication") {
    return `SSH 驗證失敗：${message}`;
  }

  return `SSH 連線失敗：${message}`;
}

export function handleSSHConnection(ws: WebSocket) {
  let sshClient: Client | null = null;
  let shellStream: ClientChannel | null = null;
  let connectReceived = false;
  let latestResize: { cols: number; rows: number } | null = null;
  let bufferedInput: string[] = [];

  const cleanup = () => {
    bufferedInput = [];
    shellStream?.end();
    shellStream = null;
    sshClient?.end();
    sshClient = null;
  };

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");

    if (!connectReceived) {
      connectReceived = true;
      const parsed = parseSshConnectMessage(input);

      if (!parsed.ok) {
        sendControlMessage(ws, encodeSshErrorControlMessage(parsed.error));
        ws.close();
        return;
      }

      sshClient = new Client();
      const connectConfig: ConnectConfig = {
        host: parsed.value.host,
        port: parsed.value.port,
        username: parsed.value.username,
        tryKeyboard: false,
      };

      if (parsed.value.authMethod === "password") {
        connectConfig.password = parsed.value.password;
      } else {
        connectConfig.privateKey = parsed.value.privateKey;
      }

      sshClient.on("ready", () => {
        if (!sshClient) {
          return;
        }

        const shellWindow = latestResize
          ? {
              term: "xterm-256color",
              cols: latestResize.cols,
              rows: latestResize.rows,
            }
          : {
              term: "xterm-256color",
              cols: 120,
              rows: 36,
            };

        sshClient.shell(shellWindow, (error, stream) => {
          if (error) {
            sendControlMessage(ws, encodeSshErrorControlMessage(`SSH shell 開啟失敗：${error.message}`));
            sshClient?.end();
            return;
          }

          shellStream = stream;
          sendControlMessage(ws, SSH_READY_CONTROL);

          stream.on("data", (data: Buffer | string) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data.toString());
            }
          });

          stream.on("close", () => {
            shellStream = null;
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          });

          for (const pendingInput of bufferedInput) {
            stream.write(pendingInput);
          }

          bufferedInput = [];
        });
      });

      sshClient.on("error", (error) => {
        sendControlMessage(ws, encodeSshErrorControlMessage(formatSshConnectionError(error)));
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      sshClient.on("close", () => {
        shellStream = null;
        sshClient = null;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      sshClient.connect(connectConfig);
      return;
    }

    const resize = parseResizeMessage(input);

    if (resize) {
      latestResize = resize;
      shellStream?.setWindow(resize.rows, resize.cols, 0, 0);
      return;
    }

    if (shellStream) {
      shellStream.write(input);
      return;
    }

    bufferedInput.push(input);
  });

  ws.on("close", () => {
    cleanup();
  });
}
