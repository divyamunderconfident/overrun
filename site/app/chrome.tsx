"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Nav() {
  const path = usePathname();
  const links = [["/", "Estimate"], ["/findings/", "Findings"], ["/reconcile/", "Reconcile"]] as const;
  const here = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.slice(0, -1)));
  return (
    <nav aria-label="Primary" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Link href="/" className="pill" aria-label="Overrun home"><span className="led" aria-hidden="true" />Overrun</Link>
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="pill navlinks" aria-current={here(href) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }
  return (
    <button type="button" className="pill" aria-pressed={dark ?? false} onClick={toggle}>
      {dark ? "Light" : "Dark"}
    </button>
  );
}
