export interface VisualViewportHeightSource {
  innerHeight: number;
  visualViewport?: {
    height: number;
    offsetTop?: number;
  } | null;
}

export function readVisualViewportHeight(
  source: VisualViewportHeightSource,
): number {
  const visualHeight = source.visualViewport?.height;

  if (typeof visualHeight === "number" && visualHeight > 0) {
    return Math.round(visualHeight);
  }

  return source.innerHeight;
}

export function readVisualViewportOffsetTop(
  source: VisualViewportHeightSource,
): number {
  const offsetTop = source.visualViewport?.offsetTop;

  if (typeof offsetTop === "number" && offsetTop > 0) {
    return Math.round(offsetTop);
  }

  return 0;
}
