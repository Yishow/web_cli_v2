import type { ServerResponse } from "http";
import { execFileSync } from "child_process";

export interface TmuxSession {
  name: string;
  attached: boolean;
  created: number;
  windows: number;
}

type ExecFileSyncLike = (
  file: string,
  args: string[],
  options: { encoding: "utf-8"; timeout: number },
) => string;

export class InvalidSessionNameError extends Error {
  constructor(name: string) {
    super(`Invalid session name: ${name}`);
    this.name = "InvalidSessionNameError";
  }
}

export const SESSION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export function isValidSessionName(name: string): boolean {
  return SESSION_NAME_REGEX.test(name);
}

export function parseTmuxSessions(output: string): TmuxSession[] {
  const trimmed = output.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split("\n")
    .map((line) => {
      const [name, windows, created, attached] = line.split("\t");

      return {
        name,
        windows: Number.parseInt(windows, 10),
        created: Number.parseInt(created, 10),
        attached: attached === "1",
      };
    });
}

function isNoSessionsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const tmuxError = error as Error & { status?: number; stderr?: string };

  return tmuxError.status === 1 && (tmuxError.stderr?.includes("no server running") ?? false);
}

export function listSessions(run: ExecFileSyncLike = execFileSync): TmuxSession[] {
  try {
    const output = run(
      "tmux",
      ["list-sessions", "-F", "#{session_name}\t#{session_windows}\t#{session_created}\t#{session_attached}"],
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    );

    return parseTmuxSessions(output);
  } catch (error) {
    if (isNoSessionsError(error)) {
      return [];
    }

    throw error;
  }
}

export function killSession(name: string, run: ExecFileSyncLike = execFileSync): void {
  if (!isValidSessionName(name)) {
    throw new InvalidSessionNameError(name);
  }

  run("tmux", ["kill-session", "-t", name], {
    encoding: "utf-8",
    timeout: 5000,
  });
}

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
