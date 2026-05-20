export const MAX_RECONNECT_ATTEMPTS = 10;
export const RECONNECT_BASE_DELAY = 1000;
export const RECONNECT_MAX_DELAY = 30000;

export function getReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_DELAY * 2 ** (attempt - 1), RECONNECT_MAX_DELAY);
}

export function formatReconnectProgressMessage(attempt: number, delayMs: number): string {
  return `\r\n\x1b[33m[reconnecting... attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}, next in ${Math.round(delayMs / 1000)}s]\x1b[0m\r\n`;
}

export function formatReconnectedMessage(): string {
  return "\r\n\x1b[32m[reconnected ✓]\x1b[0m\r\n";
}

export function formatReconnectFailureMessage(): string {
  return '\r\n\x1b[31m[auto-reconnect failed after 10 attempts. Click "連線 / 重新連線" to retry manually]\x1b[0m\r\n';
}
