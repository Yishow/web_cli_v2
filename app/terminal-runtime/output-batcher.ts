const SYNC_OUTPUT_START = "\x1b[?2026h";
const SYNC_OUTPUT_END = "\x1b[?2026l";

interface OutputBatcherOptions {
  write: (data: string) => void;
  schedule: (flush: () => void) => () => void;
}

export interface TerminalOutputBatcher {
  enqueue: (data: string) => void;
  flush: () => void;
}

function flushPendingChunk(
  pendingChunk: string,
  scheduleFlush: () => void,
  append: (chunk: string) => void,
) {
  if (!pendingChunk) {
    return;
  }

  append(pendingChunk);
  scheduleFlush();
}

export function createTerminalOutputBatcher({
  write,
  schedule,
}: OutputBatcherOptions): TerminalOutputBatcher {
  let pending = "";
  let syncBuffer = "";
  let syncActive = false;
  let cancelScheduledFlush: (() => void) | null = null;

  const flush = () => {
    cancelScheduledFlush?.();
    cancelScheduledFlush = null;

    if (!pending) {
      return;
    }

    const chunk = pending;
    pending = "";
    write(chunk);
  };

  const scheduleFlush = () => {
    if (cancelScheduledFlush) {
      return;
    }

    cancelScheduledFlush = schedule(flush);
  };

  const appendPending = (chunk: string) => {
    pending += chunk;
  };

  const enqueue = (data: string) => {
    let cursor = 0;

    while (cursor < data.length) {
      if (syncActive) {
        const syncEndIndex = data.indexOf(SYNC_OUTPUT_END, cursor);

        if (syncEndIndex === -1) {
          syncBuffer += data.slice(cursor);
          return;
        }

        syncBuffer += data.slice(cursor, syncEndIndex);
        flushPendingChunk(syncBuffer, scheduleFlush, appendPending);
        syncBuffer = "";
        syncActive = false;
        cursor = syncEndIndex + SYNC_OUTPUT_END.length;
        continue;
      }

      const syncStartIndex = data.indexOf(SYNC_OUTPUT_START, cursor);

      if (syncStartIndex === -1) {
        flushPendingChunk(data.slice(cursor), scheduleFlush, appendPending);
        return;
      }

      flushPendingChunk(data.slice(cursor, syncStartIndex), scheduleFlush, appendPending);
      syncActive = true;
      cursor = syncStartIndex + SYNC_OUTPUT_START.length;
    }
  };

  return {
    enqueue,
    flush,
  };
}
