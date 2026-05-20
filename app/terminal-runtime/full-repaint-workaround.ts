import type { TerminalCore } from "@wterm/core";

const patchedCores = new WeakSet<TerminalCore>();

export function patchFullRepaintWorkaround(core: TerminalCore | null): void {
  if (!core || patchedCores.has(core)) {
    return;
  }

  core.isDirtyRow = () => true;
  patchedCores.add(core);
}
