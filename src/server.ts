import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { runPipeline } from "./pipeline.js";
import { logInfo, logError } from "./utils/logger.js";

// Note: @lucid-agents/* packages have a transitive dependency on
// @lucid-agents/payments which uses a top-level `bun:sqlite` import,
// making the entire SDK Bun-only. This server uses plain Hono with the
// same Lucid-compatible routes and agent card format. When Lucid ships
// Node.js support, swap in createAgentApp() from @lucid-agents/hono.

const PORT = parseInt(process.env.PORT || "3000", 10);
const AGENT_WALLET = "0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A";

// --- Entrypoint definitions (Lucid-compatible format) ---
const entrypoints = [
  {
    key: "intelligence-report",
    description:
      "Standard intelligence report — fast analysis using core DeFi and market data endpoints. Returns a markdown report synthesized from multiple x402 data sources.",
    input: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The intelligence query, e.g. 'Should I invest in $AERO on Base?'",
        },
      },
      required: ["query"],
    },
    output: {
      type: "object",
      properties: {
        report: { type: "string", description: "Markdown-formatted intelligence report" },
        costUsd: { type: "number", description: "Total pipeline cost in USD" },
        endpointsCalled: { type: "number", description: "Number of x402 endpoints called" },
        endpointsSucceeded: { type: "number", description: "Number of successful endpoint calls" },
      },
    },
    price: { invoke: "0.25", currency: "USDC" },
    tier: "standard" as const,
  },
  {
    key: "deep-intelligence-report",
    description:
      "Premium deep intelligence report — comprehensive analysis using all available endpoints including Einstein AI deep queries, web search, and advanced risk analysis.",
    input: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The intelligence query, e.g. 'Full risk assessment of $AERO on Base'",
        },
      },
      required: ["query"],
    },
    output: {
      type: "object",
      properties: {
        report: { type: "string", description: "Markdown-formatted deep intelligence report" },
        costUsd: { type: "number", description: "Total pipeline cost in USD" },
        endpointsCalled: { type: "number", description: "Number of x402 endpoints called" },
        endpointsSucceeded: { type: "number", description: "Number of successful endpoint calls" },
      },
    },
    price: { invoke: "3.00", currency: "USDC" },
    tier: "premium" as const,
  },
];

// --- Agent card (Lucid / xgate-compatible) ---
const agentCard = {
  name: "parallax",
  version: "1.0.0",
  description:
    "x402 intelligence orchestration — chains multiple x402-paid endpoints into compound intelligence reports",
  url: process.env.AGENT_URL || `http://localhost:${PORT}`,
  capabilities: {
    invoke: true,
    stream: false,
    payments: true,
  },
  skills: entrypoints.map((ep) => ({
    id: ep.key,
    description: ep.description,
    input: ep.input,
    output: ep.output,
    price: ep.price,
  })),
  payments: {
    address: AGENT_WALLET,
    network: "base",
    currency: "USDC",
  },
};

// --- Hono app ---
const app = new Hono();

// Health
app.get("/health", (c) =>
  c.json({ status: "ok", agent: "parallax", version: "1.0.0" })
);

// Entrypoints listing
app.get("/entrypoints", (c) =>
  c.json(
    entrypoints.map((ep) => ({
      key: ep.key,
      description: ep.description,
      price: ep.price,
    }))
  )
);

// Agent card (xgate / Lucid discovery)
app.get("/.well-known/agent-card.json", (c) => c.json(agentCard));

// --- Invoke handlers ---
app.post("/entrypoints/intelligence-report/invoke", async (c) => {
  try {
    const body = await c.req.json();
    const query = body?.query;
    if (!query || typeof query !== "string") {
      return c.json({ error: "Missing required field: query (string)" }, 400);
    }

    logInfo(`[Standard] Processing query: "${query}"`);
    const result = await runPipeline(query, "standard");

    return c.json({
      output: {
        report: result.report,
        costUsd: result.totalCostUsd,
        endpointsCalled:
          result.endpointCallsSucceeded + result.endpointCallsFailed,
        endpointsSucceeded: result.endpointCallsSucceeded,
      },
    });
  } catch (error) {
    logError("Standard pipeline failed", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Pipeline failed" },
      500
    );
  }
});

app.post("/entrypoints/deep-intelligence-report/invoke", async (c) => {
  try {
    const body = await c.req.json();
    const query = body?.query;
    if (!query || typeof query !== "string") {
      return c.json({ error: "Missing required field: query (string)" }, 400);
    }

    logInfo(`[Premium] Processing query: "${query}"`);
    const result = await runPipeline(query, "premium");

    return c.json({
      output: {
        report: result.report,
        costUsd: result.totalCostUsd,
        endpointsCalled:
          result.endpointCallsSucceeded + result.endpointCallsFailed,
        endpointsSucceeded: result.endpointCallsSucceeded,
      },
    });
  } catch (error) {
    logError("Premium pipeline failed", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Pipeline failed" },
      500
    );
  }
});

// --- Start server ---
logInfo("Parallax — x402 Intelligence Orchestration Agent (Server Mode)");
logInfo(`Mock mode: ${process.env.MOCK_MODE === "true" ? "ON" : "OFF"}`);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  logInfo(`Server listening on http://localhost:${info.port}`);
  logInfo("Routes:");
  logInfo("  GET  /health");
  logInfo("  GET  /entrypoints");
  logInfo("  GET  /.well-known/agent-card.json");
  logInfo("  POST /entrypoints/intelligence-report/invoke");
  logInfo("  POST /entrypoints/deep-intelligence-report/invoke");
});
