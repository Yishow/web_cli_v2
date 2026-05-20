export type SshAuthMethod = "password" | "privateKey";

export interface SshModeConfig {
  host: string;
  port: string;
  username: string;
  authMethod: SshAuthMethod;
  password: string;
  privateKey: string;
}

export interface SshConnectPayload {
  type: "connect";
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  password?: string;
  privateKey?: string;
}

export function createEmptySshConfig(): SshModeConfig {
  return {
    host: "",
    port: "22",
    username: "",
    authMethod: "password",
    password: "",
    privateKey: "",
  };
}

export function buildSshConnectPayload(config: SshModeConfig): SshConnectPayload | null {
  const host = config.host.trim();
  const username = config.username.trim();
  const port = Number.parseInt(config.port, 10) || 22;

  if (!host || !username) {
    return null;
  }

  if (config.authMethod === "password") {
    if (!config.password) {
      return null;
    }

    return {
      type: "connect",
      host,
      port,
      username,
      authMethod: "password",
      password: config.password,
    };
  }

  if (!config.privateKey) {
    return null;
  }

  return {
    type: "connect",
    host,
    port,
    username,
    authMethod: "privateKey",
    privateKey: config.privateKey,
  };
}

export function clearSshCredentials(_config: SshModeConfig): SshModeConfig {
  return createEmptySshConfig();
}
