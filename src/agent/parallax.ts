import { createDreams, context, action, LogLevel } from "@daydreamsai/core";
import { cliExtension } from "@daydreamsai/cli";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { generateText } from "ai";
import type { SubTask, EndpointResult, CostEntry, QueryTier } from "./types.js";
import { registryContext, getAllCapabilities, findByCapability } from "./contexts/registry.js";
import { queryContext } from "./contexts/query.js";
import { executionContext } from "./contexts/execution.js";
import { synthesisContext } from "./contexts/synthesis.js";
import { billingContext } from "./contexts/billing.js";
import { memoryContext } from "./contexts/memory.js";
import { callEndpoint } from "../endpoints/client.js";
import { buildDecompositionPrompt } from "../prompts/decompose.js";
import { buildSynthesisPrompt } from "../prompts/synthesize.js";
import { DecompositionResultSchema } from "./types.js";
import { logInfo, logError } from "../utils/logger.js";

const s = (schema: z.ZodTypeAny) => schema as any;

// The main orchestration context that composes all sub-contexts
export const parallaxContext = context({
  type: "parallax",
  create: () => ({
    status: "idle" as string,
    currentQuery: null as string | null,
  }),
  render: (state: any) => {
    return `Parallax Agent | Status: ${state.memory.status}${state.memory.currentQuery ? ` | Query: "${state.memory.currentQuery}"` : ""}`;
  },
  instructions: `You are Parallax, an x402 intelligence orchestration agent. When a user asks a question:

1. Use the "run-pipeline" action to process their query end-to-end
2. The pipeline will: decompose the query → call x402 endpoints → synthesize a report
3. Present the markdown report to the user

You can also answer follow-up questions about the data, suggest related queries, or explain your methodology.

Always run the full pipeline for new queries. For clarifying questions about a previous report, just answer directly.`,
});

// Compose sub-contexts
parallaxContext.use(() => [
  { context: registryContext, args: {} },
  { context: queryContext, args: {} },
  { context: executionContext, args: {} },
  { context: synthesisContext, args: {} },
  { context: billingContext, args: {} },
  { context: memoryContext, args: {} },
]);

// The main pipeline action that orchestrates the full flow
parallaxContext.setActions([
  action({
    name: "run-pipeline",
    description:
      "Run the full Parallax intelligence pipeline: decompose query → match endpoints → execute x402 calls → synthesize report. Use this for any new user query.",
    schema: s(
      z.object({
        query: z.string().describe("The user's query to process"),
        tier: z.enum(["standard", "premium"]).default("standard").describe("Tier: 'standard' for fast/cheap analysis, 'premium' for deep intelligence with Einstein AI and web search"),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { query, tier = "standard" } = args as { query: string; tier?: QueryTier };
      ctx.memory.currentQuery = query;
      ctx.memory.status = "processing";

      const costEntries: CostEntry[] = [];
      const pipelineStart = Date.now();

      try {
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
          costUsd: 0.003, // estimated
          timestamp: Date.now(),
        });

        logInfo(`Decomposed into ${decomposition.subTasks.length} sub-tasks`);
        for (const st of decomposition.subTasks) {
          logInfo(`  [P${st.priority}] ${st.requiredCapability}: ${st.task}`);
        }

        // --- Step 2: Execute sub-tasks ---
        logInfo("=== Step 2: Endpoint Execution ===");
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
        logInfo("=== Step 3: Report Synthesis ===");
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
          costUsd: 0.008, // estimated
          timestamp: Date.now(),
        });

        // --- Cost summary ---
        const totalCost = costEntries.reduce((sum, e) => sum + e.costUsd, 0);
        const totalLatency = Date.now() - pipelineStart;

        ctx.memory.status = "complete";

        logInfo("=== Pipeline Complete ===");
        logInfo(`Total cost: $${totalCost.toFixed(4)} | Total time: ${totalLatency}ms`);

        return {
          report,
          costSummary: {
            entries: costEntries,
            totalCostUsd: totalCost,
            x402CostUsd: x402Cost,
            llmCostUsd: totalCost - x402Cost,
          },
          stats: {
            subTaskCount: decomposition.subTasks.length,
            endpointCallsSucceeded: successCount,
            endpointCallsFailed: endpointResults.length - successCount,
            totalLatencyMs: totalLatency,
          },
        };
      } catch (error) {
        ctx.memory.status = "error";
        logError("Pipeline failed", error);
        throw error;
      }
    },
  }),
]);

export function createParallaxAgent() {
  return createDreams({
    model: anthropic("claude-sonnet-4-5-20250929"),
    extensions: [cliExtension],
    contexts: [parallaxContext],
    logLevel: LogLevel.INFO,
  });
}
