"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ collapsed, variant = "sidebar" }: { collapsed?: boolean; variant?: "sidebar" | "menu" }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full",
        variant === "sidebar"
          ? "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground px-2.5 py-2"
          : "text-foreground/70 hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {isDark
        ? <Sun className="h-4 w-4 shrink-0" />
        : <Moon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
