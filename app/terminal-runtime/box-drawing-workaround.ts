function isBoxDrawingCodePoint(codePoint: number): boolean {
  return codePoint >= 0x2500 && codePoint <= 0x257f;
}

export function splitBoxDrawingSegments(text: string): Array<{ text: string; box: boolean }> {
  const segments: Array<{ text: string; box: boolean }> = [];
  let current = "";
  let currentBox: boolean | null = null;

  for (const char of text) {
    const box = isBoxDrawingCodePoint(char.codePointAt(0) ?? 0);

    if (currentBox === null || currentBox === box) {
      current += char;
      currentBox = box;
      continue;
    }

    segments.push({ text: current, box: currentBox });
    current = char;
    currentBox = box;
  }

  if (current && currentBox !== null) {
    segments.push({ text: current, box: currentBox });
  }

  return segments;
}

function normalizeBoxDrawingSpans(rowElement: HTMLElement): void {
  for (const child of Array.from(rowElement.children)) {
    if (!(child instanceof HTMLSpanElement)) {
      continue;
    }

    const text = child.textContent ?? "";
    const segments = splitBoxDrawingSegments(text);

    if (!segments.some((segment) => segment.box)) {
      continue;
    }

    const fragment = document.createDocumentFragment();

    for (const segment of segments) {
      const span = document.createElement("span");
      span.className = child.className;
      span.style.cssText = child.style.cssText;
      span.textContent = segment.text;

      if (segment.box) {
        span.classList.add("term-box-drawing");
      }

      fragment.appendChild(span);
    }

    child.replaceWith(fragment);
  }
}

type RendererWithRowBuilder = {
  _buildRowContent?: (rowElement: HTMLElement, ...args: unknown[]) => void;
  __boxDrawingPatched?: boolean;
};

export function patchBoxDrawingRendererWorkaround(terminal: unknown): void {
  const renderer =
    typeof terminal === "object" && terminal && "renderer" in terminal
      ? (terminal as { renderer?: RendererWithRowBuilder }).renderer
      : undefined;

  if (!renderer || renderer.__boxDrawingPatched || !renderer._buildRowContent) {
    return;
  }

  const originalBuildRowContent = renderer._buildRowContent.bind(renderer);
  renderer._buildRowContent = (rowElement, ...args) => {
    originalBuildRowContent(rowElement, ...args);
    normalizeBoxDrawingSpans(rowElement);
  };
  renderer.__boxDrawingPatched = true;
}
