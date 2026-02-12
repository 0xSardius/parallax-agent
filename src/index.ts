import "dotenv/config";
import type { QueryTier } from "./agent/types.js";
import { runPipeline } from "./pipeline.js";
import { logInfo, logError } from "./utils/logger.js";

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

  if (!query) {
    logInfo("Usage: npx tsx src/index.ts 'Your query here' [--tier premium]");
    logInfo("  Or start the server: npx tsx src/server.ts");
    process.exit(0);
  }

  logInfo(`Processing query: "${query}"\n`);

  try {
    const result = await runPipeline(query, tier);

    // --- Print report ---
    console.log("\n" + "=".repeat(60));
    console.log(result.report);
    console.log("=".repeat(60));

    // --- Print cost summary ---
    console.log(`\n--- Cost Summary (${tier.toUpperCase()} tier) ---`);
    for (const entry of result.costEntries) {
      console.log(`  ${entry.type.padEnd(4)} | ${entry.description}: $${entry.costUsd.toFixed(4)}`);
    }
    console.log(`  ${"".padEnd(4)}   Total: $${result.totalCostUsd.toFixed(4)}`);
    console.log(`  ${"".padEnd(4)}   x402:  $${result.x402CostUsd.toFixed(4)}`);
    console.log(`  ${"".padEnd(4)}   LLM:   $${result.llmCostUsd.toFixed(4)}`);
    console.log(`  ${"".padEnd(4)}   Time:  ${result.totalLatencyMs}ms`);
    console.log(`  ${"".padEnd(4)}   Calls: ${result.endpointCallsSucceeded}/${result.endpointCallsSucceeded + result.endpointCallsFailed} succeeded`);
  } catch (error) {
    logError("Pipeline failed", error);
    process.exit(1);
  }
}

main().catch((error) => {
  logError("Fatal error", error);
  process.exit(1);
});
