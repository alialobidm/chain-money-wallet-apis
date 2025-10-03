"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { UserDropdown } from "./user-dropdown";
import { useUser } from "@/contexts/user-context";

export function UserAuth() {
  const { user } = useUser();

  return user ? (
    <UserDropdown user={user} />
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
