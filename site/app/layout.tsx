import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { Nav, ThemeToggle } from "./chrome";
import "./globals.css";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Overrun — estimate an LLM request before you send it",
  description: "Why your LLM bill does not match your estimate: estimate, count, price and reconcile, in your browser.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies a saved theme choice before first paint; without one, CSS follows the system setting.
const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <header className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 22, paddingBottom: 22, flexWrap: "wrap" }}>
          <Nav />
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="lab tagline">Free · runs in your browser</span>
            <ThemeToggle />
          </span>
        </header>
        <main>{children}</main>
        <footer className="wrap" style={{ borderTop: "1px solid var(--line)", paddingTop: 28, paddingBottom: 40, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
          <span className="serif" style={{ fontSize: 28 }}>Overrun<em>.</em></span>
          <span className="mut" style={{ fontSize: 13, maxWidth: 640 }}>
            Built on &ldquo;Token Counter and Cost Meter&rdquo; from{" "}
            <a href="https://github.com/rohitg00/ai-engineering-from-scratch">AI Engineering from Scratch</a> by Rohit Ghumare (MIT).
            Estimates are estimates; rate cards are dated fixtures, not current prices. <a href="https://github.com/divyamunderconfident/overrun">Source</a> · MIT licensed.
          </span>
        </footer>
      </body>
    </html>
  );
}
