import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Initials on a soft orange tint. No photos in this app, so initials are the identity. */
export default function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn('size-8', className)}>
      <AvatarFallback className="bg-accent text-[12px] font-semibold text-accent-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
