import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { CdpClient } from "@coinbase/cdp-sdk";
import { privateKeyToAccount } from "viem/accounts";
import type { X402Endpoint, EndpointResult } from "../agent/types.js";
import { logEndpointCall, logInfo, logError } from "../utils/logger.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const EXPENSIVE_TIMEOUT_MS = 90_000; // Einstein AI deep queries need longer

// Mock responses for development without spending USDC
const MOCK_RESPONSES: Record<string, unknown> = {
  "blockchain_intelligence": {
    data: { topHolders: ["0xabc...1", "0xdef...2"], holderCount: 15423, whaleActivity: "increasing" },
  },
  "whale_tracking": {
    data: { recentWhaleTransactions: 12, netFlow: "+2.3M USDC", sentiment: "accumulating" },
  },
  "token_analysis": {
    data: { marketCap: "45M", volume24h: "8.2M", priceChange7d: "+12.5%", liquidity: "strong" },
  },
  "crypto_news": {
    data: { articles: [{ title: "Token gains momentum", sentiment: "positive" }], overallSentiment: 0.72 },
  },
  "market_sentiment": {
    data: { fearGreedIndex: 65, socialVolume: "high", trendingScore: 8.2 },
  },
  "regulatory_updates": {
    data: { relevantRegulations: [], riskLevel: "low" },
  },
  "social_data": {
    data: { farcasterMentions: 342, twitterMentions: 1205, communityGrowth: "+5.3%" },
  },
  "farcaster_trends": {
    data: { trendingCasts: 45, topChannels: ["defi", "base"], engagementRate: 0.034 },
  },
  "community_sentiment": {
    data: { sentiment: "bullish", activeUsers: 8923, growthRate: "+8.1%" },
  },
  "smart_money": {
    data: { smartMoneyFlow: "+1.2M", topWallets: 5, conviction: "high" },
  },
  "wallet_tracking": {
    data: { trackedWallets: 23, avgPosition: "$45K", recentActivity: "buying" },
  },
  "dex_flow": {
    data: { buyVolume: "4.1M", sellVolume: "2.8M", netFlow: "+1.3M", topDex: "Aerodrome" },
  },
  "risk_intelligence": {
    data: { riskScore: 35, contractAudit: "verified", rugPullRisk: "low" },
  },
  "black_swan_events": {
    data: { alerts: [], systemicRisk: "low", correlationRisk: "medium" },
  },
  "market_risk": {
    data: { volatility: "moderate", maxDrawdown30d: "-18%", sharpeRatio: 1.2 },
  },
  "defi_portfolio": {
    data: { protocols: ["Aerodrome", "Aave", "Compound"], totalTvl: "2.1B" },
  },
  "yield_data": {
    data: { bestYield: "12.5% APY on Aerodrome", alternatives: ["Aave: 4.2%", "Compound: 3.8%"] },
  },
  "apy_comparison": {
    data: { protocols: [{ name: "Aerodrome", apy: 12.5 }, { name: "Aave", apy: 4.2 }] },
  },
  "tvl_tracking": {
    data: { totalTvl: "2.1B", change24h: "+3.2%", topPool: "AERO/USDC" },
  },
  "web_search": {
    data: { results: [{ title: "Base L2 ecosystem report", url: "https://example.com/base", snippet: "Base network TVL reaches $10B..." }] },
  },
  "token_search": {
    data: { tokens: [{ symbol: "AERO", name: "Aerodrome Finance", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", chain: "base" }] },
  },
  "token_price": {
    data: { symbol: "AERO", price: 1.42, change24h: "+5.2%", volume24h: "12.3M", marketCap: "580M" },
  },
  "wallet_analysis": {
    data: { totalValue: "$245K", topHoldings: ["USDC", "WETH", "AERO"], riskScore: 42, diversification: "moderate" },
  },
  "yield_suggestions": {
    data: { opportunities: [{ protocol: "Aerodrome", pool: "AERO/USDC", apy: 18.5, risk: "medium" }] },
  },
  "gas_data": {
    data: { baseFee: "0.005 Gwei", estimatedSwapCost: "$0.003", network: "base" },
  },
  "new_token_launches": {
    data: { tokens: [{ symbol: "NEW1", launchDate: "2026-02-08", liquidity: "$500K", chain: "base" }] },
  },
  "smart_money_leaderboard": {
    data: { topTraders: [{ address: "0xabc...", pnl30d: "+$2.1M", winRate: "72%", topHolding: "AERO" }] },
  },
};

let paymentFetch: typeof fetch | null = null;

async function initPaymentFetch(): Promise<typeof fetch> {
  if (paymentFetch) return paymentFetch;

  const client = new x402Client();

  if (process.env.EVM_PRIVATE_KEY) {
    // Dev mode: use a local private key
    logInfo("Initializing x402 client with local private key signer");
    const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
    const signer = toClientEvmSigner(account);
    registerExactEvmScheme(client, { signer });
  } else {
    // Production: use CDP Server Wallet v2
    logInfo("Initializing x402 client with CDP Server Wallet v2");
    const cdp = new CdpClient();
    const cdpAccount = await cdp.evm.getOrCreateAccount({ name: "parallax-agent" });
    logInfo(`Agent wallet address: ${cdpAccount.address}`);
    const signer = toClientEvmSigner(cdpAccount as any);
    registerExactEvmScheme(client, { signer });
  }

  paymentFetch = wrapFetchWithPayment(fetch, client);
  return paymentFetch;
}

function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

export async function callEndpoint(
  endpoint: X402Endpoint,
  capability: string,
  params?: Record<string, unknown>
): Promise<EndpointResult> {
  const startTime = Date.now();

  // Mock mode — return canned responses without real x402 calls
  if (isMockMode()) {
    const mockData = MOCK_RESPONSES[capability] ?? { data: { message: "Mock data unavailable for this capability" } };
    const latencyMs = Math.floor(Math.random() * 200) + 50; // Simulate 50-250ms latency
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    logEndpointCall({
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      url: endpoint.url,
      latencyMs,
      costUsd: 0,
      success: true,
    });

    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      capability,
      success: true,
      data: mockData,
      latencyMs,
      costUsd: 0,
    };
  }

  // Live mode — make real x402-paid HTTP requests
  const timeoutMs = endpoint.costPerCall >= 0.10 ? EXPENSIVE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  try {
    const pFetch = await initPaymentFetch();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const url = new URL(endpoint.url);
    const mergedParams = { ...endpoint.defaultParams, ...params };
    // Rename "query" param to endpoint-specific name (e.g. Neynar uses "q")
    if (endpoint.queryParamName && endpoint.queryParamName !== "query" && "query" in mergedParams) {
      mergedParams[endpoint.queryParamName] = mergedParams["query"];
      delete mergedParams["query"];
    }
    const method = endpoint.method ?? "GET";

    let response: Response;
    if (method === "POST") {
      // POST endpoints receive params as JSON body
      response = await pFetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergedParams),
        signal: controller.signal,
      });
    } else {
      // GET endpoints receive params as query string
      for (const [key, value] of Object.entries(mergedParams)) {
        url.searchParams.set(key, String(value));
      }
      response = await pFetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
    }
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      logEndpointCall({
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        url: url.toString(),
        latencyMs,
        costUsd: endpoint.costPerCall,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      });

      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        capability,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        latencyMs,
        costUsd: endpoint.costPerCall,
      };
    }

    const data = await response.json();
    logEndpointCall({
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      url: url.toString(),
      latencyMs,
      costUsd: endpoint.costPerCall,
      success: true,
    });

    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      capability,
      success: true,
      data,
      latencyMs,
      costUsd: endpoint.costPerCall,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.name === "AbortError"
          ? `Timeout after ${timeoutMs}ms`
          : error.message
        : String(error);

    logEndpointCall({
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      url: endpoint.url,
      latencyMs,
      costUsd: 0,
      success: false,
      error: errorMessage,
    });

    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      capability,
      success: false,
      error: errorMessage,
      latencyMs,
      costUsd: 0,
    };
  }
}
