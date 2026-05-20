import { execFileSync, spawn } from "node:child_process";

import {
  formatExistingDevServerMessage,
  formatPortConflictMessage,
  getPortProcessInfo,
  isPortAvailable,
  isProcessRunning,
  readNextDevLock,
} from "./dev-preflight";

const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const cwd = process.cwd();

async function main(): Promise<void> {
  const existingLock = readNextDevLock(cwd);
  if (existingLock && isProcessRunning(existingLock.pid)) {
    console.error(formatExistingDevServerMessage(existingLock));
    process.exit(1);
  }

  if (!(await isPortAvailable(port, host))) {
    console.error(formatPortConflictMessage(port, getPortProcessInfo(port)));
    process.exit(1);
  }

  execFileSync("bash", ["scripts/copy-ghostty-wasm.sh"], { stdio: "inherit" });

  const tsxCommand = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const child = spawn(tsxCommand, ["server.ts"], {
    env: process.env,
    stdio: "inherit",
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));

  child.on("error", (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

void main();
