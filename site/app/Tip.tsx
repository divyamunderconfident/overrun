"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type TermId } from "./glossary";

/** A "?" disclosure button: hover, tap, Enter or Space opens a one-sentence definition; Escape or tapping elsewhere closes it. */
export function Tip({ id }: { id: TermId }) {
  const g = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const popId = useId();

  function show() {
    const r = btn.current!.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 32);
    // Keep the box inside the viewport: no horizontal scroll at phone width.
    setPos({ left: Math.max(16, Math.min(r.left - 12, window.innerWidth - w - 16)), top: r.bottom + 8 });
    setOpen(true);
  }
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!btn.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) hide(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { hide(); btn.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  const enter = (e: React.PointerEvent) => { if (e.pointerType === "mouse") { clearTimeout(hoverTimer.current); show(); } };
  const leave = (e: React.PointerEvent) => { if (e.pointerType === "mouse") hoverTimer.current = setTimeout(hide, 200); };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="tip"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`What is “${g.term}”?`}
        onClick={() => (open ? hide() : show())}
        onPointerEnter={enter}
        onPointerLeave={leave}
      >?</button>
      {open && createPortal(
        <div ref={pop} id={popId} className="tippop" role="note" style={{ left: pos.left, top: pos.top }} onPointerEnter={enter} onPointerLeave={leave}>
          <b>{g.term}.</b> {g.short} <Link href={`/start/#${id}`} onClick={hide}>In the glossary →</Link>
        </div>,
        document.body,
      )}
    </>
  );
}

/** A technical word followed by its "?" tip. */
export function Term({ id, children }: { id: TermId; children: React.ReactNode }) {
  return <span className="term">{children}<Tip id={id} /></span>;
}
