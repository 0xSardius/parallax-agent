import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  DecompositionResultSchema,
  type EndpointResult,
  type CostEntry,
  type QueryTier,
} from "./agent/types.js";
import { getCapabilityDetails, findByCapability } from "./agent/contexts/registry.js";
import { callEndpoint } from "./endpoints/client.js";
import { buildDecompositionPrompt } from "./prompts/decompose.js";
import { buildSynthesisPrompt } from "./prompts/synthesize.js";
import { logInfo, logError } from "./utils/logger.js";

export interface PipelineResult {
  report: string;
  costEntries: CostEntry[];
  totalCostUsd: number;
  x402CostUsd: number;
  llmCostUsd: number;
  totalLatencyMs: number;
  subTaskCount: number;
  endpointCallsSucceeded: number;
  endpointCallsFailed: number;
}

export async function runPipeline(
  query: string,
  tier: QueryTier = "standard"
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const costEntries: CostEntry[] = [];

  logInfo(`Tier: ${tier.toUpperCase()}`);

  // --- Step 1: Decompose query ---
  logInfo("=== Step 1: Query Decomposition ===");
  const capabilityDetails = getCapabilityDetails(tier);
  const decompositionPrompt = buildDecompositionPrompt(query, capabilityDetails);

  const decompositionResult = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    prompt: decompositionPrompt,
    maxOutputTokens: 1024,
    temperature: 0.3,
  });

  let rawDecomp = decompositionResult.text.trim();
  // Strip markdown code fences if LLM wraps JSON in ```json ... ```
  rawDecomp = rawDecomp.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
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
  const sorted = [...decomposition.subTasks].sort(
    (a, b) => a.priority - b.priority
  );
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
    const result = await callEndpoint(
      endpoint,
      subTask.requiredCapability,
      subTask.params ?? {}
    );
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

  logInfo("=== Pipeline Complete ===");
  logInfo(`Total cost: $${totalCost.toFixed(4)} | Total time: ${totalLatency}ms`);

  return {
    report,
    costEntries,
    totalCostUsd: totalCost,
    x402CostUsd: x402Cost,
    llmCostUsd: totalCost - x402Cost,
    totalLatencyMs: totalLatency,
    subTaskCount: decomposition.subTasks.length,
    endpointCallsSucceeded: successCount,
    endpointCallsFailed: endpointResults.length - successCount,
  };
}
