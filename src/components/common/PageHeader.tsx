import type { ReactNode } from 'react';
import NextStep from './NextStep';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Next stage in the processing flow. Rendered top-right, wraps under the title on narrow screens. */
  next?: { to: string; label: string };
}

export default function PageHeader({ title, description, actions, next }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-6 pt-4">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-[1.1] tracking-[-0.02em] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {(actions || next) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {actions}
          {next && <NextStep {...next} />}
        </div>
      )}
    </div>
  );
}
