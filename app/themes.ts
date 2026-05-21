export type ThemeId = "default" | "solarized-dark" | "monokai" | "light";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  cssClass: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const THEMES: ThemeMeta[] = [
  { id: "default", label: "Default", cssClass: "theme-default" },
  { id: "solarized-dark", label: "Solarized Dark", cssClass: "theme-solarized-dark" },
  { id: "monokai", label: "Monokai", cssClass: "theme-monokai" },
  { id: "light", label: "Light", cssClass: "theme-light" },
];

export const DEFAULT_THEME: ThemeId = "default";
export const THEME_STORAGE_KEY = "webcli:theme-preference";

export function getInitialThemePreference(): ThemeId {
  return DEFAULT_THEME;
}

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function loadThemePreference(storage: StorageLike | null | undefined): ThemeId {
  if (!storage) {
    return DEFAULT_THEME;
  }

  const saved = storage.getItem(THEME_STORAGE_KEY);

  if (isThemeId(saved)) {
    return saved;
  }

  if (saved !== null) {
    storage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
  }

  return DEFAULT_THEME;
}

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
