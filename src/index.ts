import "dotenv/config";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createParallaxAgent, parallaxContext } from "./agent/parallax.js";
import { DecompositionResultSchema, type EndpointResult, type CostEntry, type QueryTier } from "./agent/types.js";
import { getAllCapabilities, findByCapability } from "./agent/contexts/registry.js";
import { callEndpoint } from "./endpoints/client.js";
import { buildDecompositionPrompt } from "./prompts/decompose.js";
import { buildSynthesisPrompt } from "./prompts/synthesize.js";
import { logInfo, logError } from "./utils/logger.js";

async function runPipeline(query: string, tier: QueryTier = "standard") {
  const pipelineStart = Date.now();
  const costEntries: CostEntry[] = [];

  logInfo(`Tier: ${tier.toUpperCase()}`);

  // --- Step 1: Decompose query ---
  logInfo("=== Step 1: Query Decomposition ===");
  const capabilities = getAllCapabilities(tier);
  const decompositionPrompt = buildDecompositionPrompt(query, capabilities);

  const decompositionResult = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    prompt: decompositionPrompt,
    maxOutputTokens: 1024,
    temperature: 0.3,
  });

  const rawDecomp = decompositionResult.text.trim();
  const decomposition = DecompositionResultSchema.parse(JSON.parse(rawDecomp));

  costEntries.push({
    type: "llm",
    description: "Query decomposition (Claude Sonnet)",
    costUsd: 0.003,
    timestamp: Date.now(),
  });

  logInfo(`Decomposed into ${decomposition.subTasks.length} sub-tasks`);
  for (const st of decomposition.subTasks) {
    logInfo(`  [P${st.priority}] ${st.requiredCapability}: ${st.task}`);
  }

  // --- Step 2: Execute sub-tasks ---
  logInfo("\n=== Step 2: Endpoint Execution ===");
  const sorted = [...decomposition.subTasks].sort((a, b) => a.priority - b.priority);
  const endpointResults: EndpointResult[] = [];

  for (const subTask of sorted) {
    const endpoint = findByCapability(subTask.requiredCapability, tier);

    if (!endpoint) {
      logInfo(`No endpoint for: ${subTask.requiredCapability} — skipping`);
      endpointResults.push({
        endpointId: "none",
        endpointName: "No endpoint available",
        capability: subTask.requiredCapability,
        success: false,
        error: `No endpoint for capability: ${subTask.requiredCapability}`,
        latencyMs: 0,
        costUsd: 0,
      });
      continue;
    }

    logInfo(`Calling ${endpoint.name} for: ${subTask.task}`);
    const result = await callEndpoint(endpoint, subTask.requiredCapability, {
      query: subTask.task,
    });
    endpointResults.push(result);

    if (result.costUsd > 0) {
      costEntries.push({
        type: "x402",
        description: `${endpoint.name} (${subTask.requiredCapability})`,
        costUsd: result.costUsd,
        timestamp: Date.now(),
      });
    }
  }

  const successCount = endpointResults.filter((r) => r.success).length;
  const x402Cost = endpointResults.reduce((sum, r) => sum + r.costUsd, 0);
  logInfo(
    `Execution complete: ${successCount}/${endpointResults.length} succeeded | x402 cost: $${x402Cost.toFixed(4)}`
  );

  // --- Step 3: Synthesize report ---
  logInfo("\n=== Step 3: Report Synthesis ===");
  const synthesisPrompt = buildSynthesisPrompt(query, endpointResults);

  const synthesisResult = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    prompt: synthesisPrompt,
    maxOutputTokens: 4096,
    temperature: 0.5,
  });

  const report = synthesisResult.text.trim();

  costEntries.push({
    type: "llm",
    description: "Report synthesis (Claude Sonnet)",
    costUsd: 0.008,
    timestamp: Date.now(),
  });

  const totalCost = costEntries.reduce((sum, e) => sum + e.costUsd, 0);
  const totalLatency = Date.now() - pipelineStart;

  // --- Print report ---
  console.log("\n" + "=".repeat(60));
  console.log(report);
  console.log("=".repeat(60));

  // --- Print cost summary ---
  console.log(`\n--- Cost Summary (${tier.toUpperCase()} tier) ---`);
  for (const entry of costEntries) {
    console.log(`  ${entry.type.padEnd(4)} | ${entry.description}: $${entry.costUsd.toFixed(4)}`);
  }
  console.log(`  ${"".padEnd(4)}   Total: $${totalCost.toFixed(4)}`);
  console.log(`  ${"".padEnd(4)}   x402:  $${x402Cost.toFixed(4)}`);
  console.log(`  ${"".padEnd(4)}   LLM:   $${(totalCost - x402Cost).toFixed(4)}`);
  console.log(`  ${"".padEnd(4)}   Time:  ${totalLatency}ms`);
  console.log(`  ${"".padEnd(4)}   Calls: ${successCount}/${endpointResults.length} succeeded`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse --tier flag
  let tier: QueryTier = "standard";
  const tierIdx = args.indexOf("--tier");
  if (tierIdx !== -1 && args[tierIdx + 1]) {
    const tierArg = args[tierIdx + 1];
    if (tierArg === "premium" || tierArg === "standard") {
      tier = tierArg;
    }
    args.splice(tierIdx, 2);
  }
  // Shorthand: --premium
  const premIdx = args.indexOf("--premium");
  if (premIdx !== -1) {
    tier = "premium";
    args.splice(premIdx, 1);
  }

  const query = args[0];

  logInfo("Parallax — x402 Intelligence Orchestration Agent");
  logInfo(`Mock mode: ${process.env.MOCK_MODE === "true" ? "ON" : "OFF"}`);
  console.log("");

  if (query) {
    // Single query mode — run pipeline and exit
    logInfo(`Processing query: "${query}"\n`);

    try {
      await runPipeline(query, tier);
    } catch (error) {
      logError("Pipeline failed", error);
      process.exit(1);
    }
  } else {
    // Interactive mode — use Daydreams CLI extension
    logInfo("Starting interactive mode. Type your query and press Enter.");
    logInfo('Type "exit" to quit.\n');

    const agent = createParallaxAgent();
    await agent.start();
    await agent.run({
      context: parallaxContext,
      args: {},
    });
  }
}

main().catch((error) => {
  logError("Fatal error", error);
  process.exit(1);
});
