# Responsive Terminal Shell Design

**Date:** 2026-05-21  
**Status:** Approved for planning  
**Scope:** `app/page.tsx`, small responsive shell helpers, `app/globals.css`

## Summary

Refactor the product shell so the terminal stays the highest-priority surface on iPad and phone-sized devices, including Samsung phones, without changing the terminal runtime, transport, or server integration. The new shell keeps desktop behavior intact while introducing a compact-first responsive layout for smaller viewports: a two-stage header, overlay Sessions drawer, and a terminal frame that expands to the remaining visible viewport with only minimal margins.

## Context

The current page shell is optimized around a desktop-like header density and a relatively stable `h-screen` container. On iPad and phones, that causes the terminal viewport to lose too much usable height and width to header controls, drawers, and card-like framing. The problem is in the product shell, not in `app/terminal-runtime/*`.

Current relevant structure:

- `app/page.tsx` owns the shell, header, Sessions drawer, terminal frame, debug panel, and mode-specific overlays.
- `app/terminal-runtime/*` owns the terminal runtime boundary and should remain untouched for this change.
- `app/globals.css` already holds terminal and layout-adjacent CSS overrides.

## Goals

1. Keep the terminal nearly full-screen on iPad in both portrait and landscape.
2. Extend the same terminal-first behavior to phone-sized devices, including Samsung phones.
3. Make Sessions a drawer that does not consume terminal width by default on phone and tablet.
4. Turn the header into a primary row plus a collapsible secondary row on smaller viewports.
5. Preserve desktop information density and existing feature coverage.

## Non-Goals

1. Do not rewrite `app/terminal-runtime/*`, transport, PTY, SSH, or server code.
2. Do not redesign desktop UX beyond the responsive boundary needed to preserve parity.
3. Do not add device-specific logic that hard-codes iPad or Samsung model detection.

## Evaluated Approaches

### 1. Tablet/phone responsive shell with shared compact rules **(Chosen)**

Use one compact-first layout model for phone and tablet, then keep the current richer desktop shell above that breakpoint.

**Why chosen:**

- Matches the approved requirement that both iPad and Samsung phone prioritize terminal area.
- Avoids fragile device sniffing.
- Keeps maintenance localized to shell/layout code.

### 2. CSS-only spacing tweaks

Reduce padding and margins with breakpoints, but keep the same header/drawer structure.

**Why rejected:**

- Too weak for the approved two-stage header.
- Does not fully solve viewport loss from control density.

### 3. Device-specific layout mode

Branch behavior for iPad or selected mobile families.

**Why rejected:**

- High maintenance cost.
- Fragile against browser and device changes.

## Chosen Design

## 1. Layout Architecture

The page root becomes a viewport-safe flex column shell instead of a desktop-biased `h-screen` container. Header, content area, and debug panel remain siblings in one vertical stack so the terminal can consume the remaining height naturally.

For small viewports, the content area presents a single primary terminal stage. Secondary UI moves out of the default flow:

- Sessions becomes an overlay drawer and stays closed by default.
- Header secondary controls move into a collapsible second row.
- Terminal frame keeps only minimal margins to preserve screen space.

Desktop keeps the existing denser layout model.

## 2. Responsive Model

Define three behavior bands with explicit viewport-width thresholds:

| Band | Intent | Shell behavior |
| --- | --- | --- |
| Phone | `< 768px` | terminal-first, minimal chrome: two-stage header, overlay drawer, minimal terminal margins |
| Tablet / compact-large | `>= 768px and <= 1366px` | terminal-first, slightly roomier chrome: same model as phone, with larger spacing and drawer width |
| Desktop | `> 1366px` | current dense shell: existing richer header and layout remain the default |

The important rule is that phone and tablet share the same mental model. Only spacing and sizing change between them. The compact-shell range intentionally extends through `1366px` so currently common iPad landscape widths remain in the terminal-first shell instead of falling back to desktop density. Narrow desktop browser windows inside that same range should also use the compact shell.

## 3. Shell Responsibilities

### `app/page.tsx`

Keep ownership of:

- mode switch
- drawer open/close state
- header secondary-row expanded/collapsed state
- terminal-shell composition
- debug panel composition

Reduce inline responsive branching by moving shell-specific viewport logic into a small helper or hook. The page should consume derived shell flags rather than inlining all responsive conditions directly.

### New small helper/hook

Introduce a focused responsive-shell helper for:

- viewport class derivation (`phone` / `tablet` / `desktop`)
- whether compact shell rules apply
- whether the secondary header row is expanded
- whether the Sessions drawer should overlay

This keeps responsive shell policy out of the terminal runtime boundary.

### `app/globals.css`

Add only layout-level CSS that supports:

- viewport-safe shell sizing
- compact terminal margins
- responsive header row styling
- responsive drawer sizing/overlay polish

## 4. Header Behavior

On phone and tablet:

- **Primary row** always shows the essential controls and status:
  - app identity
  - mode switch
  - connection state
  - menu/drawer entry points
- **Secondary row** contains lower-priority actions:
  - settings
  - theme/core controls
  - agent/demo/debug actions
  - session label or related secondary metadata

The secondary row is collapsed by default on smaller screens and can be expanded on demand. This preserves terminal height without removing features.

Desktop can keep the current single-row density unless minor structural reuse makes it simpler to share code.

## 5. Sessions Drawer

On phone and tablet:

- Sessions is always treated as an overlay drawer.
- It is closed by default.
- Opening it should not permanently reduce terminal width.
- Closing it should return focus to the terminal-first shell state.

Desktop may continue using the current behavior if that remains simpler and preserves existing UX.

## 6. Terminal Frame

The terminal viewport should stretch to the remaining available space using flex layout and `min-height: 0` style rules instead of desktop-oriented framing assumptions.

Phone and tablet requirements:

- terminal nearly fills the visible viewport
- only minimal outer spacing remains
- portrait and landscape both preserve the terminal as the dominant surface
- debug panel expansion should still reduce terminal height predictably rather than causing layout breakage

## 7. Debug Panel Strategy

The debug panel remains available everywhere, but on phone and tablet its default state should stay collapsed so it does not compete with terminal height. The current explicit expand/collapse model is retained.

## 8. Error Handling and Compatibility

This change should be behavior-safe:

- No transport or runtime APIs change.
- Existing connection, reconnect, SSH, Agent, Demo, and Debug actions remain reachable.
- If viewport detection fails or a browser reports unexpected dimensions, the fallback should still be a usable compact shell rather than broken layout.

Avoid device sniffing. Prefer viewport-based behavior and resilient CSS.

## 9. Testing and Verification

Implementation planning should cover:

1. Automated checks for any extracted responsive helper logic.
2. Desktop regression checks so the current dense shell does not unintentionally collapse.
3. Manual browser verification for:
   - iPad portrait
   - iPad landscape
   - Samsung phone portrait
   - Samsung phone landscape if available
4. Verification that Sessions, SSH overlay, Agent overlay, Demo shell, and Debug panel still layer correctly on compact layouts.

## Success Criteria

The design is successful when:

1. iPad and phone both show a terminal-first shell with only minimal margins.
2. The Sessions drawer no longer consumes default terminal width on smaller screens.
3. The smaller-screen header no longer steals excessive vertical space.
4. Desktop behavior remains recognizable and fully functional.
5. The change stays isolated to shell/layout boundaries, not terminal runtime code.
