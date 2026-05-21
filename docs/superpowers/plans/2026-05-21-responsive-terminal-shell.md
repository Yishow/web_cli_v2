# Responsive Terminal Shell Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the terminal-first shell work cleanly on iPad and phone-sized devices while preserving the current desktop shell and without touching terminal runtime code.

**Architecture:** Add a small responsive-shell policy helper that becomes the single source of truth for compact-vs-desktop layout decisions. Then refactor `app/page.tsx` to consume that policy for header density, Sessions drawer behavior, and terminal frame sizing, with CSS limited to shell/layout rules in `app/globals.css`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4 utilities, `node:test` via `tsx`

---

## File Map

- Create: `app/responsive-shell.ts`
  - Pure responsive policy helpers for viewport banding and compact-shell rules.
- Create: `app/responsive-shell.test.ts`
  - Regression tests for breakpoint boundaries and compact-shell behavior decisions.
- Modify: `app/page.tsx:72-93`
  - Add viewport-driven shell state near existing UI state and refs.
- Modify: `app/page.tsx:444-477`
  - Add/adjust effects for compact-shell defaults and resize-driven state updates.
- Modify: `app/page.tsx:480-1250`
  - Refactor header, Sessions drawer, terminal frame, and debug-panel composition to consume responsive policy.
- Modify: `app/globals.css:1-173`
  - Add viewport-safe shell sizing, compact header row styling, drawer sizing, and terminal frame spacing.
- Spec reference: `docs/superpowers/specs/2026-05-21-responsive-terminal-shell-design.md`

## Task 1: Create the responsive-shell policy helper

**Files:**
- Create: `app/responsive-shell.ts`
- Test: `app/responsive-shell.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test app/responsive-shell.test.ts`  
Expected: FAIL with module/function-not-found errors for `getViewportBand` / `getResponsiveShellPolicy`

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test app/responsive-shell.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/responsive-shell.ts app/responsive-shell.test.ts
git commit -m "feat: add responsive shell policy helper"
```

## Task 2: Wire responsive policy into shell state

**Files:**
- Modify: `app/page.tsx:72-93`
- Modify: `app/page.tsx:444-477`
- Modify: `app/page.tsx:480-560`
- Test: `app/responsive-shell.test.ts`

- [ ] **Step 1: Extend the failing test with state defaults that page code will rely on**

```ts
test("phone widths stay compact and use phone drawer sizing", () => {
  assert.deepEqual(getResponsiveShellPolicy(390), {
    band: "compact",
    isCompact: true,
    usesOverlayDrawer: true,
    secondaryHeaderCollapsedByDefault: true,
    debugCollapsedByDefault: true,
    terminalInset: "compact",
    drawerWidth: "phone",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test app/responsive-shell.test.ts`  
Expected: FAIL because phone widths currently map to the wrong `drawerWidth`

- [ ] **Step 3: Update the helper minimally**

```ts
if (width < 768) {
  return {
    band: "compact",
    isCompact: true,
    usesOverlayDrawer: true,
    secondaryHeaderCollapsedByDefault: true,
    debugCollapsedByDefault: true,
    terminalInset: "compact",
    drawerWidth: "phone",
  } as const;
}
```

- [ ] **Step 4: Add viewport state in `app/page.tsx` and derive shell policy from it**

```ts
const [viewportWidth, setViewportWidth] = useState<number | null>(null);

useEffect(() => {
  const syncViewport = () => setViewportWidth(window.innerWidth);
  syncViewport();
  window.addEventListener("resize", syncViewport);
  return () => window.removeEventListener("resize", syncViewport);
}, []);

const shellPolicy = getResponsiveShellPolicy(viewportWidth);
const compactShell = shellPolicy.isCompact;
```

Also add compact-shell defaults for:

- `secondaryHeaderOpen`
- `sidebarOpen`
- `panelExpanded` only when the user explicitly expands it

- [ ] **Step 4.1: Keep first render compact-safe**

Do **not** seed a fake desktop width such as `1440`. The first render should use `getResponsiveShellPolicy(null)` so phone/tablet never flash the dense shell before hydration.

- [ ] **Step 5: Keep compact-shell state transitions deterministic**

Update the resize/defaulting effect so compact shell:

- starts with secondary header collapsed
- keeps Sessions closed by default
- does not auto-expand debug panel on resize

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
node --import tsx --test app/responsive-shell.test.ts
npm run typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/responsive-shell.ts app/responsive-shell.test.ts app/page.tsx
git commit -m "feat: drive shell state from responsive policy"
```

## Task 3: Refactor header and Sessions into the compact shell model

**Files:**
- Modify: `app/page.tsx:480-930`
- Modify: `app/globals.css:1-173`
- Test: `app/responsive-shell.test.ts`

- [ ] **Step 1: Add a failing test for compact-shell structural policy**

```ts
test("compact shell requires overlay drawer and collapsed secondary controls", () => {
  const policy = getResponsiveShellPolicy(1024);
  assert.equal(policy.usesOverlayDrawer, true);
  assert.equal(policy.secondaryHeaderCollapsedByDefault, true);
});
```

- [ ] **Step 2: Run test to verify it fails for the new policy field if needed**

Run: `node --import tsx --test app/responsive-shell.test.ts`  
Expected: FAIL if the policy surface is still incomplete

- [ ] **Step 3: Split the header into primary and secondary rows in `app/page.tsx`**

Primary row should keep:

- app label
- mode switch
- connection state
- entry points for Sessions and secondary controls

Secondary row should contain:

- settings / theme / core controls
- Agent / Demo / Debug actions
- session label or secondary metadata that no longer fits in the primary row

Use `compactShell` to render:

```tsx
{compactShell ? (
  <header className="terminal-shell-header">
    <div className="terminal-shell-header-primary">
      <button
        ref={secondaryHeaderBtnRef}
        onClick={() => setSecondaryHeaderOpen((open) => !open)}
      >
        Controls
      </button>
    </div>
    {secondaryHeaderOpen ? (
      <div ref={secondaryHeaderRef} className="terminal-shell-header-secondary">...</div>
    ) : null}
  </header>
) : (
  <header className="...existing desktop header...">...</header>
)}
```

- [ ] **Step 4: Replace the current small-screen menu with the compact-shell secondary row**

Remove duplicated mobile-only action clusters where they are now superseded by the compact two-row header. Keep one small-screen interaction model, not both.

Define the interaction model explicitly:

- add `secondaryHeaderOpen` state
- add `secondaryHeaderRef` and `secondaryHeaderBtnRef`
- close the secondary row on outside click
- close the secondary row after the user taps an action inside it on compact shell
- keep desktop settings popover behavior unchanged

- [ ] **Step 5: Make Sessions always overlay on compact shell**

Use `shellPolicy.usesOverlayDrawer` to switch drawer behavior:

```tsx
const drawerClasses = compactShell
  ? "absolute inset-y-0 left-0 z-40 w-[85vw] max-w-80 ..."
  : "absolute inset-y-0 left-0 z-40 w-72 ...";
```

Tablet can map to a slightly wider compact drawer than phone by reading `shellPolicy.drawerWidth`.

- [ ] **Step 6: Add shell CSS only for structure/polish**

Examples:

```css
.terminal-shell-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.terminal-shell-header-secondary {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 7: Run checks**

Run:

```bash
node --import tsx --test app/responsive-shell.test.ts
npm run lint
npm run typecheck
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx app/globals.css app/responsive-shell.ts app/responsive-shell.test.ts
git commit -m "feat: add compact header and overlay sessions drawer"
```

## Task 4: Make the terminal frame viewport-safe and verify device behavior

**Files:**
- Modify: `app/page.tsx:819-1250`
- Modify: `app/globals.css:1-173`
- Test: `app/responsive-shell.test.ts`

- [ ] **Step 1: Add a failing boundary test for the compact shell edge**

```ts
test("1366px still uses the compact shell but 1367px switches to desktop", () => {
  assert.equal(getResponsiveShellPolicy(1366).isCompact, true);
  assert.equal(getResponsiveShellPolicy(1367).isCompact, false);
});
```

- [ ] **Step 2: Run test to verify it fails if the threshold drifted**

Run: `node --import tsx --test app/responsive-shell.test.ts`  
Expected: FAIL if the breakpoint logic no longer matches the spec

- [ ] **Step 3: Update the root and terminal container layout in `app/page.tsx`**

Use the policy to apply compact-shell container classes and remove `h-screen` assumptions:

```tsx
<div className={compactShell ? "terminal-shell-root terminal-shell-root--compact" : "flex h-screen flex-col bg-[#08090d]"}>
```

Ensure the terminal stage stays inside a `min-h-0 flex-1 overflow-hidden` container and only keeps very small outer spacing on compact shell.

- [ ] **Step 4: Add viewport-safe CSS in `app/globals.css`**

```css
.terminal-shell-root--compact {
  min-height: 100dvh;
}

.terminal-shell-stage--compact {
  min-height: 0;
  padding: 4px;
}

@media (min-width: 768px) {
  .terminal-shell-stage--compact {
    padding: 8px;
  }
}
```

Keep desktop layout behavior unchanged.

- [ ] **Step 5: Verify the full project checks**

Run:

```bash
node --import tsx --test app/responsive-shell.test.ts
npm run lint
npm run typecheck
npm run build
```

Expected: PASS

- [ ] **Step 6: Manual verification matrix**

Verify:

1. iPad portrait: terminal nearly fills the viewport, Sessions is closed by default, secondary header can be expanded.
2. iPad landscape: still compact shell, terminal remains dominant, no fallback to dense desktop header.
3. Samsung phone portrait: terminal-first shell with very small margins, no multi-row header sprawl.
4. Samsung phone landscape if available: shell remains usable and drawer still overlays.
5. Desktop: current dense shell still recognizable and functional.
6. Debug panel: remains collapsed by default on compact shell and still expands correctly when requested.
7. SSH, Agent, and Demo overlays still stack correctly above the compact shell and do not strand the secondary header or drawer open underneath.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/globals.css app/responsive-shell.ts app/responsive-shell.test.ts
git commit -m "feat: make terminal shell viewport-safe on compact screens"
```
