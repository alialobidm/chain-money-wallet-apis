"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Send } from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { SendPaymentModal } from "./send-payment-modal";
import { GradientAvatar } from "@/lib/gradient-avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  id: number;
  userId: string;
  username: string;
  displayName: string;
  smartAccountAddress: string;
}

interface SendPaymentUsersProps {
  currentUser: SupabaseUser;
}

async function fetchUsers(currentUserId: string) {
  const response = await fetch("/api/users/with-payment-addresses");
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  const data = await response.json();
  // Filter out the current user
  const filteredUsers = data.users.filter(
    (user: User) => user.userId !== currentUserId
  );
  return filteredUsers as User[];
}

export function SendPaymentUsers({ currentUser }: SendPaymentUsersProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: users = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["users", "payment-addresses", currentUser.id],
    queryFn: () => fetchUsers(currentUser.id),
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
  });

  const handlePay = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };


  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Payment To
          </CardTitle>
          <CardDescription>Loading users...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex flex-col gap-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-9 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Payment To
          </CardTitle>
          <CardDescription className="text-destructive">
            Error: {error instanceof Error ? error.message : "An error occurred"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Payment To
          </CardTitle>
          <CardDescription>
            No other users have wallets initialized yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Payment To
          </CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? "s" : ""} available to
            receive payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0">
                    <GradientAvatar
                      username={user.username}
                      name={user.displayName}
                      size="md"
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-semibold truncate">{user.displayName}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      @{user.username}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handlePay(user)}
                  size="sm"
                  className="flex items-center gap-2 ml-2"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden lg:inline">Send</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Send Payment Modal */}
      {selectedUser && (
        <SendPaymentModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          recipient={{
            id: selectedUser.userId,
            displayName: selectedUser.displayName,
            username: selectedUser.username,
            smartAccountAddress: selectedUser.smartAccountAddress,
          }}
        />
      )}
    </>
  );
}
