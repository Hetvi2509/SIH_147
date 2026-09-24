import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';

/** Closes a results page by pointing at the next stage, so the pipeline reads as one path. */
export default function NextStep({ to, label, description }: { to: string; label: string; description: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="group mt-10 flex w-full items-center justify-between gap-4 rounded-2xl bg-card px-6 py-5 text-start smooth-shadow-ring-xs outline-none transition-[background-color] duration-150 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.99]"
    >
      <span>
        <span className="label-caps block">Next</span>
        <span className="mt-1 block font-display text-[20px] leading-tight tracking-[-0.01em]">{label}</span>
        <span className="mt-0.5 block text-[13.5px] text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-1" />
    </button>
  );
}
