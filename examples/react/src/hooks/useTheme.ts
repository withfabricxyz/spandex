import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "blue" | "coffee" | "terminal";

const STORAGE_KEY = "fabricThemeSelect";

export const THEME_VALUES = {
  light: ["#fafafa", "#0f0f0f"],
  dark: ["#0f0f0f", "#b3b3b3"],
  blue: ["#3a26e6", "#897aff"],
  coffee: ["#5c4033", "#987c6f"],
  terminal: ["#00dc7c", "#00b454"],
};

export const THEMES = Object.keys(THEME_VALUES) as Theme[];

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.includes(stored as Theme)) {
    return stored as Theme;
  }

  return "light";
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;

    THEMES.forEach((t) => {
      if (t !== "light") root.classList.remove(t);
    });

    if (theme !== "light") {
      root.classList.add(theme);
    }
  }, [theme]);

  // if for some reason the theme is changed in another tab, we can sync it here
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && THEMES.includes(e.newValue as Theme)) {
        setThemeState(e.newValue as Theme);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return { theme, setTheme };
};
