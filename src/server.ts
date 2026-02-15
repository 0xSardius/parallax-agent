import "dotenv/config";
import { z } from "zod";
import { createAgent } from "@lucid-agents/core";
import { http } from "@lucid-agents/http";
import { payments } from "@lucid-agents/payments";
import { a2a } from "@lucid-agents/a2a";
import { createAgentApp } from "@lucid-agents/hono";
import { serve } from "@hono/node-server";
import { runPipeline } from "./pipeline.js";
import { logInfo } from "./utils/logger.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
// Revenue wallet — incoming x402 payments land here
const REVENUE_WALLET = "0xA45284183b5d95f85bdB128E59D448F6762B44B3" as const;

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
        payTo: REVENUE_WALLET,
        network: "eip155:8453",
        facilitatorUrl:
          process.env.FACILITATOR_URL ||
          "https://facilitator.daydreams.systems",
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
  price: { invoke: "0.25" },
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
  price: { invoke: "3.00" },
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
