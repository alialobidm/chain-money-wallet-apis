"use client";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DollarSign,
  Plus,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useAaveApy } from "@/hooks/use-aave-apy";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BLOCK_EXPLORER_URL,
  NETWORK_NAME,
  AAVE_MARKET_URL,
  AAVE_DOCS_URL,
} from "@/lib/constants";

// Circle USDC Faucet
const USDC_FAUCET_URL = "https://faucet.circle.com/";

export default function WalletPage() {
  const [isEarningEnabled, setIsEarningEnabled] = useState(false);
  const [isTogglingEarn, setIsTogglingEarn] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const { profile, refetchProfile } = useUser();

  // Use cached queries
  const { data: balance = "0.00", isLoading: isLoadingBalance } = useWalletBalance(
    profile?.smartAccountAddress
  );
  const { data: apy = "..." } = useAaveApy();

  // Sync earning enabled state from profile
  useEffect(() => {
    if (profile?.isEarningYield !== undefined) {
      setIsEarningEnabled(profile.isEarningYield);
    }
  }, [profile?.isEarningYield]);

  const handleToggleEarn = async (enabled: boolean) => {
    if (!profile?.smartAccountAddress) return;

    setIsTogglingEarn(true);
    // Optimistically update UI
    setIsEarningEnabled(enabled);

    if (enabled) {
      // Supply ALL liquid USDC to AAVE
      try {
        const response = await fetch("/api/aave/supply", {
          method: "POST",
        });

        if (response.ok) {
          toast.success("Now earning yield!", {
            description: `Your USDC is now earning ${apy}% APY`,
          });
          // Refetch profile to update isEarningYield state
          await refetchProfile();
        } else {
          const error = await response.json();
          toast.error("Failed to enable earning", {
            description: error.error || "Please try again",
          });
          setIsEarningEnabled(false);
        }
      } catch {
        toast.error("Failed to enable earning");
        setIsEarningEnabled(false);
      }
    } else {
      // Withdraw ALL from AAVE
      try {
        const response = await fetch("/api/aave/withdraw", {
          method: "POST",
        });

        if (response.ok) {
          toast.success("Earning disabled", {
            description: "Your funds are no longer earning yield",
          });
          // Refetch profile to update isEarningYield state
          await refetchProfile();
        } else {
          const error = await response.json();
          toast.error("Failed to disable earning", {
            description: error.error || "Please try again",
          });
          setIsEarningEnabled(true);
        }
      } catch {
        toast.error("Failed to disable earning");
        setIsEarningEnabled(true);
      }
    }

    setIsTogglingEarn(false);
  };

  const handleInitializeWallet = async () => {
    toast.loading("Setting up your account...", { id: "init-wallet" });

    try {
      const response = await fetch("/api/wallet/initialize", {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Account ready!", { id: "init-wallet" });
        window.location.reload();
      } else {
        toast.error("Setup failed", {
          id: "init-wallet",
          description: "Please try again or contact support",
        });
      }
    } catch {
      toast.error("Setup failed", {
        id: "init-wallet",
        description: "Please try again",
      });
    }
  };

  const copyAddress = () => {
    if (profile?.smartAccountAddress) {
      navigator.clipboard.writeText(profile.smartAccountAddress);
      toast.success("Address copied to clipboard!");
    }
  };

  const explorerUrl = profile?.smartAccountAddress
    ? `${BLOCK_EXPLORER_URL}/address/${profile.smartAccountAddress}`
    : "";

  if (!profile?.smartAccountAddress) {
    return (
      <AuthLayout>
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Welcome to ChainMoney</CardTitle>
            <CardDescription>
              Get started by initializing your wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below to create your smart wallet and start sending payments
            </p>
            <Button onClick={handleInitializeWallet} className="w-full">
              Initialize Wallet
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Hero Balance Section */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background border-2">
          <CardContent className="pt-8 pb-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm font-medium">Total Balance</span>
              </div>
              {isLoadingBalance ? (
                <Skeleton className="h-16 w-48" />
              ) : (
                <div className="text-6xl font-bold tracking-tight">
                  ${balance}
                </div>
              )}
              {isEarningEnabled && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">Earning {apy}% APY</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Earn Yield Section */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Earn Yield on Your Balance
                </CardTitle>
                {apy === "..." ? (
                  <Skeleton className="h-5 w-48" />
                ) : (
                  <CardDescription>
                    Automatically earn {apy}% APY on your balance
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-4">
                {isLoadingBalance ? (
                  <div className="flex items-center gap-4">
                    <div className="text-right space-y-1">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ) : (
                  <>
                    <div className="text-right">
                      <div className="text-base font-semibold">
                        {isEarningEnabled ? "Earning" : "Disabled"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isEarningEnabled ? `${apy}% APY` : "Enable to earn"}
                      </div>
                    </div>
                    <Switch
                      checked={isEarningEnabled}
                      onCheckedChange={handleToggleEarn}
                      disabled={
                        isTogglingEarn ||
                        isLoadingBalance ||
                        parseFloat(balance) === 0
                      }
                      className="data-[state=checked]:bg-green-600 scale-150"
                    />
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Learn More */}
            <button
              onClick={() => setShowLearnMore(!showLearnMore)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showLearnMore ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              How does this work?
            </button>

            {showLearnMore && (
              <div className="p-4 rounded-lg border space-y-4">
                <div className="space-y-2">
                  <p className="font-medium text-sm">How it works</p>
                  <p className="text-sm text-muted-foreground">
                    When enabled, your balance (held in{" "}
                    <a
                      href="https://www.usdc.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline hover:no-underline"
                    >
                      USDC
                    </a>
                    ) is deposited into the{" "}
                    <a
                      href={AAVE_DOCS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline hover:no-underline"
                    >
                      AAVE
                    </a>{" "}
                    lending protocol to earn yield. Your funds remain yours and can be withdrawn anytime.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-sm">Where are my funds?</p>
                  <p className="text-sm text-muted-foreground">
                    Your funds are deposited in{" "}
                    <a
                      href={AAVE_MARKET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline hover:no-underline"
                    >
                      this AAVE market
                    </a>
                    .{" "}
                    {isEarningEnabled ? (
                      <>
                        Because you&apos;re earning interest, you&apos;ll see{" "}
                        <a
                          href={`${BLOCK_EXPLORER_URL}/address/${profile.smartAccountAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground underline hover:no-underline"
                        >
                          aUSDC tokens in your account
                        </a>
                        .
                      </>
                    ) : (
                      <>
                        Because you&apos;re not earning interest, you&apos;ll see{" "}
                        <a
                          href={`${BLOCK_EXPLORER_URL}/address/${profile.smartAccountAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground underline hover:no-underline"
                        >
                          USDC tokens in your account
                        </a>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top up button and content */}
        <div className="w-full">
          <Button
            size="lg"
            variant="outline"
            className={`w-full h-auto py-6 transition-all ${
              showAdvanced
                ? "rounded-b-none border-b-0 bg-accent"
                : ""
            }`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Top up test balance</div>
                  <div className="text-xs text-muted-foreground">
                    Add funds to your wallet
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              />
            </div>
          </Button>

          {/* Top up Section */}
          {showAdvanced && (
            <Card className="w-full rounded-t-none border-t-0 animate-in slide-in-from-top-2 duration-200">
              <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Your Smart Account Address
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all">
                    {profile.smartAccountAddress}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyAddress}
                    className="flex-shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="flex-shrink-0"
                  >
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Get 10 test USDC from Circle faucet
                </p>
                <p className="text-sm text-muted-foreground">
                  Copy your address above, paste it into the faucet, and make sure to select{" "}
                  <span className="font-semibold">{NETWORK_NAME}</span> as the network.
                </p>
                <Button
                  size="default"
                  variant="secondary"
                  className="w-full"
                  asChild
                >
                  <a
                    href={USDC_FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Circle Faucet
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
