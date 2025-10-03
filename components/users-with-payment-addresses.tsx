"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wallet, Send } from "lucide-react";

interface User {
  id: number;
  userId: string;
  username: string;
  displayName: string;
  paymentAddress: string;
}

export function UsersWithPaymentAddresses() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/users/with-payment-addresses");

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePay = (user: User) => {
    // For now, just show an alert with the payment address
    // In a real app, this would open a payment modal or redirect to a payment page
    alert(
      `Pay to: ${user.paymentAddress}\nUser: ${user.displayName} (@${user.username})`
    );
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users with Payment Addresses
          </CardTitle>
          <CardDescription>Loading users...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users with Payment Addresses
          </CardTitle>
          <CardDescription className="text-destructive">
            Error: {error}
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
            Users with Payment Addresses
          </CardTitle>
          <CardDescription>
            No users have set their payment addresses yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Users with Payment Addresses
        </CardTitle>
        <CardDescription>
          {users.length} user{users.length !== 1 ? "s" : ""} ready to receive
          payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="font-semibold">{user.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    @{user.username}
                  </div>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {formatAddress(user.paymentAddress)}
                </Badge>
              </div>
              <Button
                onClick={() => handlePay(user)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Pay
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
