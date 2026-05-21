export interface VisualViewportHeightSource {
  innerHeight: number;
  visualViewport?: {
    height: number;
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
