export interface PtyClientMessageState {
  bufferedInput: string[];
}

type SpawnAction = {
  type: "spawn";
  cols: number;
  rows: number;
  bufferedInput: string[];
};

type ResizeAction = {
  type: "resize";
  cols: number;
  rows: number;
};

type WriteAction = {
  type: "write";
  data: string;
};

type BufferAction = {
  type: "buffer";
};

export type PtyClientMessageAction = SpawnAction | ResizeAction | WriteAction | BufferAction;

export function createPtyClientMessageState(): PtyClientMessageState {
  return { bufferedInput: [] };
}

export function handlePtyClientMessage(
  state: PtyClientMessageState,
  input: string,
  hasPtyProcess: boolean,
): PtyClientMessageAction {
  const resize = parseResizeMessage(input);

  if (resize) {
    if (hasPtyProcess) {
      return {
        type: "resize",
        cols: resize.cols,
        rows: resize.rows,
      };
    }

    const bufferedInput = state.bufferedInput;
    state.bufferedInput = [];

    return {
      type: "spawn",
      cols: resize.cols,
      rows: resize.rows,
      bufferedInput,
    };
  }

  if (hasPtyProcess) {
    return {
      type: "write",
      data: input,
    };
  }

  state.bufferedInput = [...state.bufferedInput, input];
  return { type: "buffer" };
}

export function parseResizeMessage(input: string): { cols: number; rows: number } | null {
  const match = input.match(/\x1b\[RESIZE:(\d+);(\d+)\]/);

  if (!match) {
    return null;
  }

  return {
    cols: Number.parseInt(match[1], 10),
    rows: Number.parseInt(match[2], 10),
  };
}