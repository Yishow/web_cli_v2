export type CoreType = "builtin" | "ghostty";

type CoreConfig = {
  label: string;
  size: string;
  wasmUrl?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const CORE_PREFERENCE_KEY = "webcli:core-preference";

export const CORE_CONFIG = {
  builtin: {
    label: "Built-in",
    wasmUrl: "/wterm.wasm",
    size: "~12KB",
  },
  ghostty: {
    label: "Ghostty",
    size: "~400KB",
  },
} satisfies Record<CoreType, CoreConfig>;

export function getInitialCorePreference(): CoreType {
  return "ghostty";
}

export function normalizeCorePreference(value: string | null | undefined): CoreType | null {
  if (value === "builtin" || value === "ghostty") {
    return value;
  }

  return null;
}

export function loadCorePreference(storage: StorageLike | null | undefined): CoreType {
  if (!storage) {
    return getInitialCorePreference();
  }

  const saved = normalizeCorePreference(storage.getItem(CORE_PREFERENCE_KEY));

  if (saved) {
    return saved;
  }

  if (storage.getItem(CORE_PREFERENCE_KEY) !== null) {
    storage.setItem(CORE_PREFERENCE_KEY, "ghostty");
  }

  return getInitialCorePreference();
}
