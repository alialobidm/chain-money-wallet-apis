"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/user-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  ArrowUpRight,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientAvatar } from "@/lib/gradient-avatar";
import { BLOCK_EXPLORER_URL } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: number;
  transactionHash: string;
  amount: string;
  message: string | null;
  createdAt: string;
  senderDisplayName: string;
  senderUsername: string;
  recipientDisplayName: string;
  recipientUsername: string;
  fromUserId: string;
  toUserId: string;
}

async function fetchTransactions() {
  const response = await fetch("/api/transactions/all");
  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }
  const data = await response.json();
  return data.transactions as Transaction[];
}

export function ActivityFeed() {
  const { user } = useUser();
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const {
    data: transactions = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: fetchTransactions,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Filter transactions based on selected filter
  const filteredTransactions = useMemo(() => {
    if (filter === "mine" && user?.id) {
      return transactions.filter(
        (tx) => tx.fromUserId === user.id || tx.toUserId === user.id
      );
    }
    return transactions;
  }, [transactions, filter, user?.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60)
      );
      return diffInMinutes <= 1 ? "Just now" : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    // If it's a whole number, return without decimals
    if (num % 1 === 0) {
      return num.toString();
    }
    // Otherwise, round to 2 decimal places and remove trailing zeros
    return num.toFixed(2).replace(/\.?0+$/, "");
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Platform Activity
              </CardTitle>
              <CardDescription>Loading recent activity...</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "mine" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("mine")}
              >
                Mine
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
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
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Platform Activity
              </CardTitle>
              <CardDescription className="text-destructive">
                Error: {error instanceof Error ? error.message : "An error occurred"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "mine" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("mine")}
              >
                Mine
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (filteredTransactions.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Platform Activity
              </CardTitle>
              <CardDescription>
                {filter === "mine"
                  ? "No transactions yet. Send your first payment!"
                  : "No activity yet. Be the first to send a payment!"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "mine" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("mine")}
              >
                Mine
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Platform Activity
            </CardTitle>
            <CardDescription>
              {filter === "mine"
                ? `Your ${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? "s" : ""}`
                : `Latest ${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? "s" : ""} across the platform`
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("mine")}
            >
              Mine
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() =>
                window.open(
                  `${BLOCK_EXPLORER_URL}/tx/${transaction.transactionHash}`,
                  "_blank"
                )
              }
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Avatars */}
                <div className="flex items-center gap-3">
                  {/* Sender avatar */}
                  <GradientAvatar
                    username={transaction.senderUsername}
                    name={transaction.senderDisplayName}
                    size="md"
                  />

                  {/* Arrow indicator */}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />

                  {/* Recipient avatar */}
                  <GradientAvatar
                    username={transaction.recipientUsername}
                    name={transaction.recipientDisplayName}
                    size="md"
                  />
                </div>

                {/* Transaction details */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {transaction.senderDisplayName}
                    </span>
                    <span className="text-sm text-muted-foreground">→</span>
                    <span className="text-sm text-muted-foreground">
                      {transaction.recipientDisplayName}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                      <Clock className="h-3 w-3" />
                      {formatDate(transaction.createdAt)}
                    </div>
                  </div>

                  {/* Message if exists */}
                  {transaction.message && (
                    <div className="flex items-center gap-2 mt-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-base text-foreground font-medium">
                        {transaction.message}
                      </span>
                    </div>
                  )}
                </div>

                {/* Amount - neutral color */}
                <div className="text-right">
                  <div className="text-lg font-semibold text-foreground">
                    ${formatAmount(transaction.amount)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}