import { useQuery } from "@tanstack/react-query";
import { encodeFunctionData, formatUnits } from "viem";
import {
  USDC_CONTRACT_ADDRESS,
  AUSDC_CONTRACT_ADDRESS,
} from "@/lib/constants";

const tokenABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function fetchBalance(smartAccountAddress: string): Promise<string> {
  try {
    const calldata = encodeFunctionData({
      abi: tokenABI,
      functionName: "balanceOf",
      args: [smartAccountAddress as `0x${string}`],
    });

    // Fetch USDC balance
    const usdcResponse = await fetch("/api/alchemy-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "eth_call",
        params: [{ to: USDC_CONTRACT_ADDRESS, data: calldata }, "latest"],
      }),
    });

    // Fetch aUSDC balance
    const ausdcResponse = await fetch("/api/alchemy-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "eth_call",
        params: [{ to: AUSDC_CONTRACT_ADDRESS, data: calldata }, "latest"],
      }),
    });

    const usdcData = await usdcResponse.json();
    const ausdcData = await ausdcResponse.json();

    let usdcBal = 0n;
    let ausdcBal = 0n;

    if (usdcData.result) usdcBal = BigInt(usdcData.result);
    if (ausdcData.result) ausdcBal = BigInt(ausdcData.result);

    const liquid = parseFloat(formatUnits(usdcBal, 6));
    const earning = parseFloat(formatUnits(ausdcBal, 6));
    const total = liquid + earning;

    return total.toFixed(2);
  } catch (error) {
    console.error("Error fetching balance:", error);
    return "0.00";
  }
}

export function useWalletBalance(smartAccountAddress: string | null | undefined) {
  return useQuery({
    queryKey: ["wallet", "balance", smartAccountAddress],
    queryFn: () => fetchBalance(smartAccountAddress!),
    enabled: !!smartAccountAddress,
    staleTime: 2 * 1000, // 2 seconds - balance needs to be accurate
    gcTime: 10 * 1000, // Cache for 10 seconds
    refetchInterval: 5 * 1000, // Auto-refetch every 5 seconds
    refetchOnWindowFocus: true,
  });
}
