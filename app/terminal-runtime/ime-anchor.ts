interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AnchorBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getImeAnchorBox(cursorRect: RectLike, terminalRect: RectLike): AnchorBox {
  const maxLeft = Math.max(Math.floor(terminalRect.width) - 1, 0);
  const maxTop = Math.max(Math.floor(terminalRect.height) - 1, 0);

  return {
    left: clamp(Math.floor(cursorRect.left - terminalRect.left), 0, maxLeft),
    top: clamp(Math.floor(cursorRect.top - terminalRect.top), 0, maxTop),
    width: 1,
    height: 1,
  };
}

export function attachImeCompositionAnchor(terminalElement: HTMLElement): () => void {
  let frameId: number | null = null;

  const sync = () => {
    const textarea = terminalElement.querySelector("textarea");
    const cursor = terminalElement.querySelector(".term-cursor");

    if (!(textarea instanceof HTMLTextAreaElement) || !(cursor instanceof HTMLElement)) {
      return;
    }

    const anchor = getImeAnchorBox(
      cursor.getBoundingClientRect(),
      terminalElement.getBoundingClientRect(),
    );

    textarea.style.left = `${anchor.left}px`;
    textarea.style.top = `${anchor.top}px`;
    textarea.style.width = `${anchor.width}px`;
    textarea.style.height = `${anchor.height}px`;
  };

  const scheduleSync = () => {
    if (frameId !== null) {
      return;
    }

    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      sync();
    });
  };

  const mutationObserver = new MutationObserver(scheduleSync);
  mutationObserver.observe(terminalElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          scheduleSync();
        });

  resizeObserver?.observe(terminalElement);
  terminalElement.addEventListener("click", scheduleSync);
  terminalElement.addEventListener("focusin", scheduleSync);
  window.addEventListener("resize", scheduleSync);

  scheduleSync();

  return () => {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }

    mutationObserver.disconnect();
    resizeObserver?.disconnect();
    terminalElement.removeEventListener("click", scheduleSync);
    terminalElement.removeEventListener("focusin", scheduleSync);
    window.removeEventListener("resize", scheduleSync);
  };
}
