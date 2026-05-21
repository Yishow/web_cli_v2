export type ResponsiveShellBand = "phone" | "compact" | "desktop";
export type TerminalInset = "compact" | "desktop";
export type DrawerWidth = "phone" | "tablet" | "desktop";

export function getViewportBand(width: number): ResponsiveShellBand {
  if (width < 768) return "phone";
  if (width <= 1366) return "compact";
  return "desktop";
}

export function getResponsiveShellPolicy(width: number | null | undefined) {
  if (width == null) {
    return {
      band: "compact",
      isCompact: true,
      usesOverlayDrawer: true,
      secondaryHeaderCollapsedByDefault: true,
      debugCollapsedByDefault: true,
      terminalInset: "compact",
      drawerWidth: "tablet",
    } as const;
  }

  const band = getViewportBand(width);
  const isCompact = band !== "desktop";

  return {
    band: isCompact ? "compact" : "desktop",
    isCompact,
    usesOverlayDrawer: isCompact,
    secondaryHeaderCollapsedByDefault: isCompact,
    debugCollapsedByDefault: isCompact,
    terminalInset: isCompact ? "compact" : "desktop",
    drawerWidth: band === "phone" ? "phone" : band === "compact" ? "tablet" : "desktop",
  } as const;
}
