import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

export interface PortProcessInfo {
  pid: string | null;
  command: string | null;
}

export interface NextDevLockInfo {
  pid: number;
  port: number;
  hostname: string;
  appUrl: string;
  startedAt: number;
}

export async function isPortAvailable(port: number, host = "127.0.0.1"): Promise<boolean> {
  return await new Promise<boolean>((resolve, reject) => {
    const server = createServer();

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.listen(port, host, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(true);
      });
    });
  });
}

export function parseSsProcess(output: string): PortProcessInfo {
  return {
    pid: output.match(/pid=(\d+)/)?.[1] ?? null,
    command: output.match(/\(\("([^"]+)"/)?.[1] ?? null,
  };
}

export function parseNextDevLock(contents: string): NextDevLockInfo | null {
  try {
    const parsed = JSON.parse(contents) as Partial<NextDevLockInfo>;

    if (
      typeof parsed.pid !== "number" ||
      typeof parsed.port !== "number" ||
      typeof parsed.hostname !== "string" ||
      typeof parsed.appUrl !== "string" ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }

    return {
      pid: parsed.pid,
      port: parsed.port,
      hostname: parsed.hostname,
      appUrl: parsed.appUrl,
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export function readNextDevLock(cwd: string): NextDevLockInfo | null {
  const lockPath = join(cwd, ".next", "dev", "lock");
  if (!existsSync(lockPath)) {
    return null;
  }

  return parseNextDevLock(readFileSync(lockPath, "utf8"));
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getPortProcessInfo(port: number): PortProcessInfo {
  try {
    const output = execFileSync("ss", ["-ltnp", `( sport = :${port} )`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return parseSsProcess(output);
  } catch {
    return { pid: null, command: null };
  }
}

export function formatPortConflictMessage(port: number, processInfo: PortProcessInfo): string {
  if (processInfo.pid && processInfo.command) {
    return `Port ${port} is already in use by PID ${processInfo.pid} (${processInfo.command}).\nStop that process or run PORT=<other-port> pnpm dev.`;
  }

  return `Port ${port} is already in use.\nStop the existing listener or run PORT=<other-port> pnpm dev.`;
}

export function formatExistingDevServerMessage(lockInfo: NextDevLockInfo): string {
  return `Another dev server for this repo is already running at ${lockInfo.appUrl} (PID ${lockInfo.pid}).\nStop that process before starting a new pnpm dev session.`;
}
