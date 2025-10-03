"use client";

import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { GradientAvatar } from "@/lib/gradient-avatar";
import { useUser } from "@/contexts/user-context";

interface UserDropdownProps {
  user: SupabaseUser;
}

export function UserDropdown({}: UserDropdownProps) {
  const { profile } = useUser();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          {profile?.username ? (
            <GradientAvatar
              username={profile.username}
              name={profile.displayName || profile.username}
              size="sm"
            />
          ) : (
            <div className="w-8 h-8 bg-primary/10 rounded-full" />
          )}
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-sm font-medium">{profile?.displayName || profile?.username}</span>
            <span className="text-xs text-muted-foreground">@{profile?.username}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile?.displayName || profile?.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              @{profile?.username}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer">
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
