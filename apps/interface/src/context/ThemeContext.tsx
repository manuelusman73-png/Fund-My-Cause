"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/** Theme type: either "dark" or "light". */
type Theme = "dark" | "light";

/**
 * Context value provided by ThemeProvider.
 * @interface ThemeContextType
 * @property {Theme} theme - Current theme ("dark" or "light")
 * @property {Function} toggleTheme - Toggles between dark and light themes
 */
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provider component for theme management.
 * Persists theme preference to localStorage and applies CSS classes to document root.
 * Auto-detects system preference on first load if no saved preference exists.
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element|null} Provider wrapper, or null during hydration
 * @example
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("theme", theme);
      if (theme === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      }
    }
  }, [theme, mounted]);

  /**
   * Toggles the theme between dark and light.
   */
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context.
 * Must be used within a ThemeProvider.
 * @returns {ThemeContextType} Theme context value
 * @throws {Error} If used outside ThemeProvider
 * @example
 * const { theme, toggleTheme } = useTheme();
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
