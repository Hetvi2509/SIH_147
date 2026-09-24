import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';

/** Compact pointer to the next stage. Sits in the page header, not at the foot of the page. */
export default function NextStep({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={`Next stage: ${label}`}
      className="group inline-flex h-9 items-center gap-2 rounded-full bg-card pe-1.5 ps-3.5 text-[14px] smooth-shadow-ring-xs outline-none transition-[background-color,scale] duration-150 ease-[var(--ease-ui)] hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97]"
    >
      <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Next</span>
      <span className="font-medium">{label}</span>
      <span className="grid size-6 place-items-center rounded-full bg-accent text-primary">
        <ArrowRight weight="bold" className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
