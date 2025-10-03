"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { DollarSign, ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { encodeFunctionData, formatUnits } from "viem";
import { useUser } from "@/contexts/user-context";
import { toast } from "sonner";
import {
  USDC_CONTRACT_ADDRESS,
  AUSDC_CONTRACT_ADDRESS,
  BLOCK_EXPLORER_URL,
  NETWORK_NAME,
} from "@/lib/constants";

// Circle USDC Faucet
const USDC_FAUCET_URL = "https://faucet.circle.com/";

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

export function BalanceCard() {
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

      // Fetch USDC balance
      const usdcResponse = await fetch("/api/alchemy-proxy", {
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

      // Fetch aUSDC balance
      const ausdcResponse = await fetch("/api/alchemy-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "eth_call",
          params: [
            {
              to: AUSDC_CONTRACT_ADDRESS,
              data: calldata,
            },
            "latest",
          ],
        }),
      });

      const usdcData = await usdcResponse.json();
      const ausdcData = await ausdcResponse.json();

      // Calculate total balance (USDC + aUSDC)
      let totalBalance = 0n;

      if (usdcData.result) {
        totalBalance += BigInt(usdcData.result);
      }

      if (ausdcData.result) {
        totalBalance += BigInt(ausdcData.result);
      }

      // Convert the total to a formatted balance (6 decimals)
      const formattedBalance = formatUnits(totalBalance, 6);
      setBalance(parseFloat(formattedBalance).toFixed(2));
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
          description: "Please try again or contact support"
        });
      }
    } catch {
      toast.error("Setup failed", {
        id: "init-wallet",
        description: "Please try again"
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

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Your Balance</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoadingBalance ? "Loading..." : `$${balance}`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Available for payments
        </p>

        {!profile?.smartAccountAddress && (
          <Button
            onClick={handleInitializeWallet}
            className="w-full mt-4"
            variant="outline"
          >
            Initialize Wallet
          </Button>
        )}

        {profile?.smartAccountAddress && showAdvanced && (
          <div className="mt-4 pt-4 border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Your Account Address</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                  <code className="text-xs font-mono flex-1 truncate">
                    {profile.smartAccountAddress}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={copyAddress}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  asChild
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
              <p className="text-xs font-medium text-foreground">Add to your balance (test USDC)</p>
              <p className="text-xs text-foreground">
                Visit the Circle faucet to receive 10 USDC. Copy your address above, paste it into the faucet, and make sure to select <span className="font-bold">{NETWORK_NAME}</span> as the network.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                asChild
              >
                <a
                  href={USDC_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Circle Faucet
                  <ExternalLink className="h-3 w-3 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {profile?.smartAccountAddress && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Advanced
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Advanced
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
