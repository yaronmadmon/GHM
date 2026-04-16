"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Building2, Users, Wrench, HardHat, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchResults {
  tenants: { id: string; name: string; email?: string | null; phone?: string | null; property?: string | null; unit?: string | null }[];
  properties: { id: string; name: string; address: string; unitCount: number; status: string }[];
  maintenance: { id: string; title: string; status: string; priority: string; property?: string | null }[];
  vendors: { id: string; name: string; trade?: string | null; phone?: string | null }[];
}

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export function GlobalSearch({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K / Ctrl+K opens search from anywhere
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  const hasResults = results && (
    results.tenants.length > 0 ||
    results.properties.length > 0 ||
    results.maintenance.length > 0 ||
    results.vendors.length > 0
  );

  return (
    <>
      {/* Trigger button — adapts to collapsed sidebar or mobile */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-md text-sm transition-colors",
          collapsed
            ? "justify-center w-full p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            : "w-full px-2.5 py-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-sidebar-border/50 hover:border-sidebar-border"
        )}
        title={collapsed ? "Search (⌘K)" : undefined}
      >
        <Search className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-xs bg-sidebar-accent border border-sidebar-border rounded px-1 py-0.5 font-mono opacity-60">⌘K</kbd>
          </>
        )}
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setResults(null); } }}
        title="Global Search"
        description="Search tenants, properties, maintenance, and vendors"
      >
        <CommandInput
          placeholder="Search tenants, properties, maintenance…"
          value={query}
          onValueChange={handleInput}
        />
        <CommandList>
          {query.length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}

          {query.length >= 2 && loading && (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Searching…
            </div>
          )}

          {query.length >= 2 && !loading && !hasResults && (
            <CommandEmpty>No results for &ldquo;{query}&rdquo;</CommandEmpty>
          )}

          {results && results.tenants.length > 0 && (
            <CommandGroup heading="Tenants">
              {results.tenants.map((t) => (
                <CommandItem key={t.id} onSelect={() => go(`/tenants/${t.id}`)}>
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{t.name}</span>
                    {(t.property || t.email) && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        {t.property ? `${t.property}${t.unit ? ` · Unit ${t.unit}` : ""}` : t.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results && results.tenants.length > 0 && results.properties.length > 0 && (
            <CommandSeparator />
          )}

          {results && results.properties.length > 0 && (
            <CommandGroup heading="Properties">
              {results.properties.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/properties/${p.id}`)}>
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.address}</span>
                  </div>
                  <Badge variant="outline" className="text-xs ml-2 shrink-0">
                    {p.unitCount} unit{p.unitCount !== 1 ? "s" : ""}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results && results.maintenance.length > 0 && (results.tenants.length > 0 || results.properties.length > 0) && (
            <CommandSeparator />
          )}

          {results && results.maintenance.length > 0 && (
            <CommandGroup heading="Maintenance">
              {results.maintenance.map((m) => (
                <CommandItem key={m.id} onSelect={() => go(`/maintenance/${m.id}`)}>
                  <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{m.title}</span>
                    {m.property && <span className="ml-2 text-xs text-muted-foreground">{m.property}</span>}
                  </div>
                  <Badge variant={PRIORITY_STYLES[m.priority] as "destructive" | "secondary" | "outline" ?? "outline"} className="text-xs shrink-0">
                    {m.priority}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results && results.vendors.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Vendors">
                {results.vendors.map((v) => (
                  <CommandItem key={v.id} onSelect={() => go(`/vendors/${v.id}`)}>
                    <HardHat className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{v.name}</span>
                      {v.trade && <span className="ml-2 text-xs text-muted-foreground capitalize">{v.trade}</span>}
                    </div>
                    {v.phone && <span className="text-xs text-muted-foreground shrink-0">{v.phone}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Footer hint */}
        <div className="border-t px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span><kbd className="font-mono border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono border rounded px-1">↵</kbd> open</span>
          <span><kbd className="font-mono border rounded px-1">esc</kbd> close</span>
        </div>
      </CommandDialog>
    </>
  );
}

// Standalone trigger for mobile top bar (icon only)
export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  const hasResults = results && (
    results.tenants.length > 0 || results.properties.length > 0 ||
    results.maintenance.length > 0 || results.vendors.length > 0
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="Search (⌘K)"
      >
        <Search className="h-5 w-5" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setResults(null); } }}
        title="Global Search"
        description="Search tenants, properties, maintenance, and vendors"
      >
        <CommandInput
          placeholder="Search tenants, properties, maintenance…"
          value={query}
          onValueChange={handleInput}
        />
        <CommandList>
          {query.length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
          {query.length >= 2 && loading && (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">Searching…</div>
          )}
          {query.length >= 2 && !loading && !hasResults && (
            <CommandEmpty>No results for &ldquo;{query}&rdquo;</CommandEmpty>
          )}
          {results && results.tenants.length > 0 && (
            <CommandGroup heading="Tenants">
              {results.tenants.map((t) => (
                <CommandItem key={t.id} onSelect={() => go(`/tenants/${t.id}`)}>
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{t.name}</span>
                    {(t.property || t.email) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.property ? `${t.property}${t.unit ? ` · Unit ${t.unit}` : ""}` : t.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results && results.properties.length > 0 && (
            <CommandGroup heading="Properties">
              {results.properties.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/properties/${p.id}`)}>
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.address}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results && results.maintenance.length > 0 && (
            <CommandGroup heading="Maintenance">
              {results.maintenance.map((m) => (
                <CommandItem key={m.id} onSelect={() => go(`/maintenance/${m.id}`)}>
                  <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{m.title}</span>
                  {m.property && <span className="ml-2 text-xs text-muted-foreground">{m.property}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results && results.vendors.length > 0 && (
            <CommandGroup heading="Vendors">
              {results.vendors.map((v) => (
                <CommandItem key={v.id} onSelect={() => go(`/vendors/${v.id}`)}>
                  <HardHat className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{v.name}</span>
                  {v.trade && <span className="ml-2 text-xs text-muted-foreground capitalize">{v.trade}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className="border-t px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span><kbd className="font-mono border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono border rounded px-1">↵</kbd> open</span>
          <span><kbd className="font-mono border rounded px-1">esc</kbd> close</span>
        </div>
      </CommandDialog>
    </>
  );
}
