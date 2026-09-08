export function resolveTheme(theme: string): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme === "light" ? "light" : "dark";
}

export function applyResolvedTheme(resolved: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function applyTheme(theme: string) {
  const resolved = resolveTheme(theme);
  applyResolvedTheme(resolved);
  try {
    localStorage.setItem("sr-theme", theme);
  } catch {
    /* ignore */
  }
}
