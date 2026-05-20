export interface BrowserLocationLike {
  protocol: string;
  host: string;
}

export type TransportTarget =
  | {
      mode: "local";
      sessionName: string;
    }
  | {
      mode: "ssh";
    };

export function buildTerminalWebSocketUrl(
  location: BrowserLocationLike,
  sessionName: string,
): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/terminal?session=${encodeURIComponent(sessionName)}`;
}

export function buildTransportWebSocketUrl(
  location: BrowserLocationLike,
  target: TransportTarget,
): string {
  if (target.mode === "ssh") {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/api/ssh`;
  }

  return buildTerminalWebSocketUrl(location, target.sessionName);
}
