export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "steprs.theme";

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* private mode */
  }
  return null;
}

export function resolveTheme(stored: ThemeMode | null): ThemeMode {
  if (stored) return stored;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.theme = mode;
  root.style.colorScheme = mode;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", mode === "dark" ? "#09090b" : "#ffffff");
  }
}

export function storeTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Disable color transitions for one frame — instant theme flip. */
export function freezeThemeTransition() {
  const root = document.documentElement;
  root.classList.add("theme-instant");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-instant"));
  });
}

export function toggleTheme(): ThemeMode {
  freezeThemeTransition();
  const next: ThemeMode = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  storeTheme(next);
  applyTheme(next);
  return next;
}

/** Inline script string — must stay in sync with resolve/apply logic. */
export const THEME_INIT_SCRIPT = `(function(){try{var k="steprs.theme";var s=localStorage.getItem(k);var d=s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#09090b":"#ffffff");}catch(e){}})();`;
