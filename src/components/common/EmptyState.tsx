import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** A results page with nothing to show yet. Says what is missing and offers the next step. */
export default function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  const navigate = useNavigate();
  return (
    <Empty className="mt-10 rounded-2xl bg-card py-20 smooth-shadow-ring-xs">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-accent text-primary [&_svg]:size-6">{icon}</EmptyMedia>
        <EmptyTitle className="font-display text-[22px] font-normal">{title}</EmptyTitle>
        <EmptyDescription className="max-w-[44ch] text-[14.5px]">{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
      </EmptyContent>
    </Empty>
  );
}
export type { ReactNode };
