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
import { buildSynthesisPrompt, truncateAllEndpointData } from "./prompts/synthesize.js";
import { logInfo, logError } from "./utils/logger.js";

// Claude Sonnet 4.5 pricing (USD per token)
const SONNET_INPUT_PRICE = 3.0 / 1_000_000;   // $3.00 / MTok
const SONNET_OUTPUT_PRICE = 15.0 / 1_000_000;  // $15.00 / MTok
const SONNET_CACHED_INPUT_PRICE = 0.3 / 1_000_000; // $0.30 / MTok

function calculateLlmCost(usage: {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}): number {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const cached = usage.cachedInputTokens ?? 0;
  return (
    (input - cached) * SONNET_INPUT_PRICE +
    cached * SONNET_CACHED_INPUT_PRICE +
    output * SONNET_OUTPUT_PRICE
  );
}

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

  const decompCost = calculateLlmCost(decompositionResult.usage);
  logInfo(`Decomposition tokens: ${decompositionResult.usage.inputTokens ?? 0}in / ${decompositionResult.usage.outputTokens ?? 0}out → $${decompCost.toFixed(4)}`);
  costEntries.push({
    type: "llm",
    description: `Query decomposition (Claude Sonnet) [${decompositionResult.usage.inputTokens ?? 0}in/${decompositionResult.usage.outputTokens ?? 0}out]`,
    costUsd: decompCost,
    timestamp: Date.now(),
  });

  logInfo(`Decomposed into ${decomposition.subTasks.length} sub-tasks`);
  for (const st of decomposition.subTasks) {
    logInfo(`  [P${st.priority}] ${st.requiredCapability}: ${st.task}`);
  }

  // --- Step 2: Execute sub-tasks (parallel) ---
  logInfo("\n=== Step 2: Endpoint Execution (parallel) ===");
  const sorted = [...decomposition.subTasks].sort(
    (a, b) => a.priority - b.priority
  );

  const promises = sorted.map(async (subTask): Promise<EndpointResult> => {
    const endpoint = findByCapability(subTask.requiredCapability, tier);

    if (!endpoint) {
      logInfo(`No endpoint for: ${subTask.requiredCapability} — skipping`);
      return {
        endpointId: "none",
        endpointName: "No endpoint available",
        capability: subTask.requiredCapability,
        success: false,
        error: `No endpoint for capability: ${subTask.requiredCapability}`,
        latencyMs: 0,
        costUsd: 0,
      };
    }

    logInfo(`Calling ${endpoint.name} for: ${subTask.task}`);
    return callEndpoint(
      endpoint,
      subTask.requiredCapability,
      subTask.params ?? {}
    );
  });

  const settled = await Promise.allSettled(promises);
  const endpointResults: EndpointResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    // Unexpected rejection — wrap as a failed result
    const subTask = sorted[i];
    logError(`Unexpected error for ${subTask.requiredCapability}: ${s.reason}`);
    return {
      endpointId: "none",
      endpointName: "Unknown",
      capability: subTask.requiredCapability,
      success: false,
      error: String(s.reason),
      latencyMs: 0,
      costUsd: 0,
    };
  });

  for (const result of endpointResults) {
    if (result.costUsd > 0) {
      costEntries.push({
        type: "x402",
        description: `${result.endpointName} (${result.capability})`,
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

  // Log data truncation stats
  const { rawChars, truncatedChars } = truncateAllEndpointData(endpointResults);
  const savings = rawChars > 0 ? ((1 - truncatedChars / rawChars) * 100).toFixed(0) : "0";
  logInfo(`Data truncation: ${rawChars.toLocaleString()} → ${truncatedChars.toLocaleString()} chars (${savings}% reduction, ~${Math.round(truncatedChars / 4)} tokens)`);

  const synthesisPrompt = buildSynthesisPrompt(query, endpointResults);

  const synthesisResult = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    prompt: synthesisPrompt,
    maxOutputTokens: 4096,
    temperature: 0.5,
  });

  const report = synthesisResult.text.trim();

  const synthCost = calculateLlmCost(synthesisResult.usage);
  logInfo(`Synthesis tokens: ${synthesisResult.usage.inputTokens ?? 0}in / ${synthesisResult.usage.outputTokens ?? 0}out → $${synthCost.toFixed(4)}`);
  costEntries.push({
    type: "llm",
    description: `Report synthesis (Claude Sonnet) [${synthesisResult.usage.inputTokens ?? 0}in/${synthesisResult.usage.outputTokens ?? 0}out]`,
    costUsd: synthCost,
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
