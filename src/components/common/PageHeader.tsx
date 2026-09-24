import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-6 pt-4">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-[1.1] tracking-[-0.02em] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
