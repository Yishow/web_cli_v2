import type { SshAuthMethod } from "../app/ssh-mode";

export interface SshConnectMessage {
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  password?: string;
  privateKey?: string;
}

export type SshConnectParseResult =
  | {
      ok: true;
      value: SshConnectMessage;
    }
  | {
      ok: false;
      error: string;
    };

export function parseSshConnectMessage(input: string): SshConnectParseResult {
  let payload: unknown;

  try {
    payload = JSON.parse(input);
  } catch {
    return {
      ok: false,
      error: "Invalid connection parameters",
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      error: "Missing required SSH connection fields",
    };
  }

  const record = payload as Record<string, unknown>;
  const host = typeof record.host === "string" ? record.host.trim() : "";
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const authMethod = record.authMethod;
  const port =
    typeof record.port === "number" && Number.isFinite(record.port) ? record.port : 22;

  if ((record.type !== "connect" && record.type !== undefined) || !host || !username) {
    return {
      ok: false,
      error: "Missing required SSH connection fields",
    };
  }

  if (authMethod === "password") {
    if (typeof record.password !== "string" || !record.password) {
      return {
        ok: false,
        error: "Missing required SSH connection fields",
      };
    }

    return {
      ok: true,
      value: {
        host,
        port,
        username,
        authMethod: "password",
        password: record.password,
      },
    };
  }

  if (authMethod === "privateKey") {
    if (typeof record.privateKey !== "string" || !record.privateKey) {
      return {
        ok: false,
        error: "Missing required SSH connection fields",
      };
    }

    return {
      ok: true,
      value: {
        host,
        port,
        username,
        authMethod: "privateKey",
        privateKey: record.privateKey,
      },
    };
  }

  return {
    ok: false,
    error: "Missing required SSH connection fields",
  };
}
