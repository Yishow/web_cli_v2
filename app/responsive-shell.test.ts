import assert from "node:assert/strict";
import test from "node:test";

import { getResponsiveShellPolicy, getViewportBand } from "./responsive-shell";

test("getViewportBand keeps compact shell through common iPad widths", () => {
  assert.equal(getViewportBand(767), "phone");
  assert.equal(getViewportBand(768), "compact");
  assert.equal(getViewportBand(1024), "compact");
  assert.equal(getViewportBand(1366), "compact");
  assert.equal(getViewportBand(1367), "desktop");
});

test("getResponsiveShellPolicy enables overlay drawer and collapsed secondary header in compact shell", () => {
  assert.deepEqual(getResponsiveShellPolicy(820), {
    band: "compact",
    isCompact: true,
    usesOverlayDrawer: true,
    secondaryHeaderCollapsedByDefault: true,
    debugCollapsedByDefault: true,
    terminalInset: "compact",
    drawerWidth: "tablet",
  });
});

test("getResponsiveShellPolicy keeps desktop shell dense above 1366px", () => {
  assert.deepEqual(getResponsiveShellPolicy(1440), {
    band: "desktop",
    isCompact: false,
    usesOverlayDrawer: false,
    secondaryHeaderCollapsedByDefault: false,
    debugCollapsedByDefault: false,
    terminalInset: "desktop",
    drawerWidth: "desktop",
  });
});

test("getResponsiveShellPolicy defaults to compact-safe behavior before viewport hydration", () => {
  assert.deepEqual(getResponsiveShellPolicy(null), {
    band: "compact",
    isCompact: true,
    usesOverlayDrawer: true,
    secondaryHeaderCollapsedByDefault: true,
    debugCollapsedByDefault: true,
    terminalInset: "compact",
    drawerWidth: "tablet",
  });
});
