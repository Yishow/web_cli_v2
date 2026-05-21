import type React from "react";

export const rootHydrationProps = {
  suppressHydrationWarning: true,
} as const;

export function HydrationSafeInput(
  props: React.ComponentPropsWithoutRef<"input">,
) {
  return <input suppressHydrationWarning {...props} />;
}

export function HydrationSafeTextarea(
  props: React.ComponentPropsWithoutRef<"textarea">,
) {
  return <textarea suppressHydrationWarning {...props} />;
}
