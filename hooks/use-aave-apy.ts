import { useQuery } from "@tanstack/react-query";
import { encodeFunctionData, decodeFunctionResult } from "viem";
import {
  USDC_CONTRACT_ADDRESS,
  AAVE_V3_POOL_ADDRESS,
} from "@/lib/constants";

const aavePoolABI = [
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

async function fetchApy(): Promise<string> {
  try {
    const calldata = encodeFunctionData({
      abi: aavePoolABI,
      functionName: "getReserveData",
      args: [USDC_CONTRACT_ADDRESS as `0x${string}`],
    });

    const response = await fetch("/api/alchemy-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "eth_call",
        params: [{ to: AAVE_V3_POOL_ADDRESS, data: calldata }, "latest"],
      }),
    });

    const data = await response.json();

    if (data.result) {
      const decoded = decodeFunctionResult({
        abi: aavePoolABI,
        functionName: "getReserveData",
        data: data.result as `0x${string}`,
      }) as { currentLiquidityRate: bigint };

      const liquidityRate = decoded.currentLiquidityRate;

      if (liquidityRate) {
        // AAVE rates are in RAY units (1e27), convert to APY percentage
        const RAY = 10n ** 27n;
        const apyDecimal = Number((BigInt(liquidityRate) * 10000n) / RAY) / 100;
        return apyDecimal.toFixed(2);
      }
    }

    return "3.5"; // Fallback
  } catch (error) {
    console.error("Error fetching APY:", error);
    return "3.5"; // Fallback
  }
}

export function useAaveApy() {
  return useQuery({
    queryKey: ["aave", "apy", "usdc"],
    queryFn: fetchApy,
    staleTime: 5 * 60 * 1000, // 5 minutes - APY doesn't change often
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });
}
