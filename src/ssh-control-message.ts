const SSH_CONTROL_PREFIX = "\0SSH:";
const SSH_ERROR_PREFIX = `${SSH_CONTROL_PREFIX}ERROR:`;

export const SSH_READY_CONTROL = `${SSH_CONTROL_PREFIX}READY`;

export function encodeSshErrorControlMessage(message: string): string {
  return `${SSH_ERROR_PREFIX}${message}`;
}

export function parseSshControlMessage(
  input: string,
): { type: "ready" } | { type: "error"; message: string } | null {
  if (input === SSH_READY_CONTROL) {
    return { type: "ready" };
  }

  if (input.startsWith(SSH_ERROR_PREFIX)) {
    return {
      type: "error",
      message: input.slice(SSH_ERROR_PREFIX.length),
    };
  }

  return null;
}
