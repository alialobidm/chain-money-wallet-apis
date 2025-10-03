"use client";

import { SendPaymentUsers } from "@/components/send-payment-users";
import { AuthLayout } from "@/components/auth-layout";
import { WalletBalanceCard } from "@/components/wallet-balance-card";
import { useUser } from "@/contexts/user-context";

export default function SendPaymentPage() {
  const { user } = useUser();

  return (
    <AuthLayout>
      <div className="flex flex-col gap-8">
        {/* Balance Card */}
        <WalletBalanceCard />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-bold text-2xl">Choose who to pay</h1>
            <p className="text-muted-foreground">
              Select a user from the list below to send them a payment
            </p>
          </div>

          <SendPaymentUsers currentUser={user!} />
        </div>
      </div>
    </AuthLayout>
  );
}