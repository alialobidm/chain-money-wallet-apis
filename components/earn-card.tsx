"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { encodeFunctionData, formatUnits } from "viem";
import { useUser } from "@/contexts/user-context";
import { toast } from "sonner";
import { USDC_CONTRACT_ADDRESS } from "@/lib/constants";

// ERC20 function ABIs
const tokenABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function EarnCard() {
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isEarningEnabled, setIsEarningEnabled] = useState(false);
  const [isTogglingEarn, setIsTogglingEarn] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { profile } = useUser();

  const fetchBalance = useCallback(async () => {
    if (!profile?.smartAccountAddress) {
      setIsLoadingBalance(false);
      return;
    }

    try {
      setIsLoadingBalance(true);

      // Generate calldata for balanceOf function
      const calldata = encodeFunctionData({
        abi: tokenABI,
        functionName: "balanceOf",
        args: [profile.smartAccountAddress as `0x${string}`],
      });

      // Make a call through our Alchemy proxy
      const response = await fetch("/api/alchemy-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "eth_call",
          params: [
            {
              to: USDC_CONTRACT_ADDRESS,
              data: calldata,
            },
            "latest",
          ],
        }),
      });

      const data = await response.json();

      if (data.result) {
        // Convert the hex result to a formatted balance (6 decimals)
        const balanceWei = BigInt(data.result);
        const formattedBalance = formatUnits(balanceWei, 6);
        setBalance(parseFloat(formattedBalance).toFixed(2));
      } else {
        setBalance("0.00");
      }
    } catch {
      setBalance("0.00");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [profile?.smartAccountAddress]);

  // Fetch balance when component mounts or when smartAccountAddress changes
  useEffect(() => {
    fetchBalance();
  }, [profile?.smartAccountAddress, fetchBalance]);

  const handleToggleEarn = async (enabled: boolean) => {
    if (!profile?.smartAccountAddress) {
      toast.error("Wallet not initialized");
      return;
    }

    setIsTogglingEarn(true);

    try {
      if (enabled) {
        // Enable earning - deposit into AAVE
        toast.loading("Depositing into AAVE...", { id: "toggle-earn" });

        const response = await fetch("/api/aave/supply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: balance, // Supply full balance
          }),
        });

        if (response.ok) {
          const data = await response.json();
          toast.success("Earning enabled!", {
            id: "toggle-earn",
            description: `Transaction: ${data.transactionHash?.slice(0, 10)}...`,
          });
          setIsEarningEnabled(true);
          fetchBalance();
        } else {
          const error = await response.json();
          throw new Error(error.error || "Failed to enable earning");
        }
      } else {
        // Disable earning - withdraw from AAVE
        toast.loading("Withdrawing from AAVE...", { id: "toggle-earn" });

        const response = await fetch("/api/aave/withdraw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          toast.success("Earning disabled!", {
            id: "toggle-earn",
            description: `Transaction: ${data.transactionHash?.slice(0, 10)}...`,
          });
          setIsEarningEnabled(false);
          fetchBalance();
        } else {
          const error = await response.json();
          throw new Error(error.error || "Failed to disable earning");
        }
      }
    } catch (error) {
      console.error("Error toggling earn:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle earning",
        { id: "toggle-earn" }
      );
      // Revert the switch state
      setIsEarningEnabled(!enabled);
    } finally {
      setIsTogglingEarn(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Earn Yield</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoadingBalance ? "Loading..." : `$${balance}`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Available balance
        </p>

        <div className="mt-6 p-4 bg-muted rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Start Earning</p>
              <p className="text-xs text-muted-foreground">
                ~3.5% APY on USDC
              </p>
            </div>
            <Switch
              checked={isEarningEnabled}
              onCheckedChange={handleToggleEarn}
              disabled={isTogglingEarn || !profile?.smartAccountAddress}
            />
          </div>

          {isTogglingEarn && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing transaction...</span>
            </div>
          )}
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">How it works</p>
              <p className="text-xs text-muted-foreground">
                When you enable earning, your USDC is deposited into{" "}
                <span className="font-semibold">AAVE</span>, a decentralized lending protocol.
                Your funds earn interest from borrowers while remaining accessible to you at any time.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Safety</p>
              <p className="text-xs text-muted-foreground">
                AAVE is one of the most established DeFi protocols with over $10B in total value locked.
                Your funds are secured by smart contracts that have been audited by multiple security firms.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Withdraw anytime</p>
              <p className="text-xs text-muted-foreground">
                Toggle off earning at any time to withdraw your funds plus earned interest back to your wallet instantly.
              </p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Learn More
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
