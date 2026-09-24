import { CaretUpDown, SignOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import UserAvatar from '@/components/auth/UserAvatar';
import { useAuth } from '@/context/AuthContext';

/** Signed-in user at the foot of the sidebar. Opens a menu with sign out. */
export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name} className="gap-2.5 rounded-xl data-[state=open]:bg-secondary group-data-[collapsible=icon]:p-0!">
              <UserAvatar name={user.name} className="size-8 rounded-lg" />
              <span className="grid min-w-0 flex-1 text-start leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[14px] font-medium">{user.name}</span>
                <span className="truncate text-[12px] text-muted-foreground">{user.email}</span>
              </span>
              <CaretUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-[14px] font-medium">{user.name}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { signOut(); navigate('/login', { replace: true }); }}>
              <SignOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
