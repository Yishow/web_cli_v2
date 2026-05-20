export interface TerminalViewport {
  cols: number;
  rows: number;
}

interface ResizeSocketLike {
  readyState: number;
  send: (frame: string) => void;
}

const OPEN_WEBSOCKET_STATE = 1;

export function buildResizeControlMessage(viewport: TerminalViewport): string {
  return `\x1b[RESIZE:${viewport.cols};${viewport.rows}]`;
}

export function sendResizeControlMessage(
  socket: ResizeSocketLike | null,
  viewport: TerminalViewport | null,
): boolean {
  if (
    !socket ||
    socket.readyState !== OPEN_WEBSOCKET_STATE ||
    !viewport ||
    viewport.cols < 1 ||
    viewport.rows < 1
  ) {
    return false;
  }

  socket.send(buildResizeControlMessage(viewport));
  return true;
}
