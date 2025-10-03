"use client";

import { Card, CardContent } from "./ui/card";
import { DollarSign, TrendingUp } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletBalanceCard() {
  const { profile } = useUser();
  const { data: balance = "0.00", isLoading: isLoadingBalance } = useWalletBalance(
    profile?.smartAccountAddress
  );

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background border-2">
      <CardContent className="pt-8 pb-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-5 w-5" />
            <span className="text-sm font-medium">Your Balance</span>
          </div>
          {isLoadingBalance ? (
            <Skeleton className="h-16 w-48" />
          ) : (
            <div className="text-6xl font-bold tracking-tight">
              ${balance}
            </div>
          )}
          {profile?.isEarningYield && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Earning yield</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
