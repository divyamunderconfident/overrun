import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overrun",
  description: "Why your LLM bill does not match your estimate: estimate, count, price and reconcile, in your browser.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto max-w-4xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-baseline gap-4">
          <Link href="/" className="text-xl font-bold no-underline">Overrun</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/">Calculator</Link>
            <Link href="/reconcile/">Reconcile</Link>
            <Link href="/findings/">Findings</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="mt-12 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
          Built on &ldquo;Token Counter and Cost Meter&rdquo; from{" "}
          <a href="https://github.com/rohitg00/ai-engineering-from-scratch">AI Engineering from Scratch</a> by Rohit Ghumare (MIT).
          Prices are dated fixtures, not current prices. Everything runs in your browser.{" "}
          <a href="https://github.com/divyamunderconfident/overrun">Source</a>.
        </footer>
      </body>
    </html>
  );
}
