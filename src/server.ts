import "dotenv/config";
import { z } from "zod";
import { createAgent } from "@lucid-agents/core";
import { http } from "@lucid-agents/http";
import { payments } from "@lucid-agents/payments";
import { a2a } from "@lucid-agents/a2a";
import { createAgentApp } from "@lucid-agents/hono";
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runPipeline } from "./pipeline.js";
import { logInfo } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
// CDP Server Wallet — receives incoming x402 payments and pays outgoing endpoint calls.
// Self-funding: revenue covers operating costs, margin accumulates. Sweep profits periodically.
const AGENT_WALLET = "0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A" as const;

// --- Build Lucid agent ---
const runtime = await createAgent({
  name: "parallax",
  version: "1.0.0",
  description:
    "x402 intelligence orchestration — chains multiple x402-paid endpoints into compound intelligence reports",
  url: process.env.AGENT_URL || `http://localhost:${PORT}`,
})
  .use(http())
  .use(
    payments({
      config: {
        payTo: AGENT_WALLET,
        network: "eip155:8453",
        facilitatorUrl:
          process.env.FACILITATOR_URL ||
          "https://facilitator.payai.network",
        storage: { type: "in-memory" }, // Node.js — SQLite is Bun-only
      },
    })
  )
  .use(a2a())
  .build();

// --- Create Hono app from runtime ---
const { app, addEntrypoint } = await createAgentApp(runtime);

// --- Standard tier: fast analysis using core endpoints ---
addEntrypoint({
  key: "intelligence-report",
  description:
    "Standard intelligence report — fast analysis using core DeFi and market data endpoints. Returns a markdown report synthesized from multiple x402 data sources.",
  input: z.object({
    query: z
      .string()
      .describe(
        "The intelligence query, e.g. 'Should I invest in $AERO on Base?'"
      ),
  }),
  output: z.object({
    report: z.string().describe("Markdown-formatted intelligence report"),
    costUsd: z.number().describe("Total pipeline cost in USD"),
    endpointsCalled: z
      .number()
      .describe("Number of x402 endpoints called"),
    endpointsSucceeded: z
      .number()
      .describe("Number of successful endpoint calls"),
  }),
  price: { invoke: "0.15" },
  async handler({ input }) {
    logInfo(`[Standard] Processing query: "${input.query}"`);
    const result = await runPipeline(input.query, "standard");
    return {
      output: {
        report: result.report,
        costUsd: result.totalCostUsd,
        endpointsCalled:
          result.endpointCallsSucceeded + result.endpointCallsFailed,
        endpointsSucceeded: result.endpointCallsSucceeded,
      },
    };
  },
});

// --- Premium tier: comprehensive analysis with all endpoints ---
addEntrypoint({
  key: "deep-intelligence-report",
  description:
    "Premium deep intelligence report — comprehensive analysis using all available endpoints including Einstein AI deep queries, web search, and advanced risk analysis.",
  input: z.object({
    query: z
      .string()
      .describe(
        "The intelligence query, e.g. 'Full risk assessment of $AERO on Base'"
      ),
  }),
  output: z.object({
    report: z
      .string()
      .describe("Markdown-formatted deep intelligence report"),
    costUsd: z.number().describe("Total pipeline cost in USD"),
    endpointsCalled: z
      .number()
      .describe("Number of x402 endpoints called"),
    endpointsSucceeded: z
      .number()
      .describe("Number of successful endpoint calls"),
  }),
  price: { invoke: "1.50" },
  async handler({ input }) {
    logInfo(`[Premium] Processing query: "${input.query}"`);
    const result = await runPipeline(input.query, "premium");
    return {
      output: {
        report: result.report,
        costUsd: result.totalCostUsd,
        endpointsCalled:
          result.endpointCallsSucceeded + result.endpointCallsFailed,
        endpointsSucceeded: result.endpointCallsSucceeded,
      },
    };
  },
});

// --- Static assets ---
const logoBuffer = readFileSync(join(__dirname, "../public/logo.png"));
app.get("/logo.png", (c) => {
  return new Response(logoBuffer, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
});

// --- ERC-8004 registration metadata ---
const AGENT_URL =
  process.env.AGENT_URL || `http://localhost:${PORT}`;

app.get("/.well-known/agent-registration.json", (c) =>
  c.json({
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Parallax",
    description:
      "x402 intelligence orchestration agent. Chains multiple x402-paid DeFi and market data endpoints into compound intelligence reports. 54 endpoints across 10 providers — DeFi, rug detection, Twitter sentiment, Farcaster social, NFTs, wallet analysis. Standard reports $0.15 USDC, premium deep analysis $1.50 USDC. Pays and receives on Base.",
    image: `${AGENT_URL}/logo.png`,
    agentType: "orchestrator",
    tags: ["defi", "intelligence", "x402", "base", "market-data", "analytics"],
    categories: ["data-analysis", "defi", "research"],
    active: true,
    x402Support: true,
    services: [
      {
        name: "A2A",
        endpoint: `${AGENT_URL}/.well-known/agent-card.json`,
        version: "1.0.0",
        a2aSkills: ["intelligence-report", "deep-intelligence-report"],
      },
      {
        name: "web",
        endpoint: AGENT_URL,
      },
      {
        name: "agentWallet",
        endpoint: `eip155:8453:${AGENT_WALLET}`,
      },
    ],
    registrations: [
      {
        agentId: 17653,
        agentRegistry:
          "eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
      },
    ],
    supportedTrust: ["reputation"],
    updatedAt: 1740528000, // 2025-02-26T00:00:00Z — fixed for content-addressing (IPFS pin)
  })
);

// --- Start server ---
logInfo("Parallax — x402 Intelligence Orchestration Agent (Lucid SDK)");
logInfo(`Mock mode: ${process.env.MOCK_MODE === "true" ? "ON" : "OFF"}`);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  logInfo(`Server listening on http://localhost:${info.port}`);
  logInfo("Lucid auto-routes:");
  logInfo("  GET  /health");
  logInfo("  GET  /entrypoints");
  logInfo("  GET  /.well-known/agent.json");
  logInfo("  GET  /.well-known/agent-card.json");
  logInfo("  POST /entrypoints/intelligence-report/invoke");
  logInfo("  POST /entrypoints/deep-intelligence-report/invoke");
});
