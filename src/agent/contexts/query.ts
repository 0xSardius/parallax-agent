import { context, action } from "@daydreamsai/core";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { DecompositionResultSchema, type DecompositionResult } from "../types.js";
import { buildDecompositionPrompt } from "../../prompts/decompose.js";
import { getAllCapabilities } from "./registry.js";
import { logInfo, logError } from "../../utils/logger.js";

const s = (schema: z.ZodTypeAny) => schema as any;

export const queryContext = context({
  type: "query-decomposition",
  create: () => ({
    lastDecomposition: null as DecompositionResult | null,
  }),
  render: (state: any) => {
    const decomp = state.memory.lastDecomposition as DecompositionResult | null;
    if (!decomp) return "No query decomposed yet.";
    return `Last decomposition: ${decomp.subTasks.length} sub-tasks\nReasoning: ${decomp.reasoning}`;
  },
  instructions:
    "This context handles query decomposition — breaking user queries into sub-tasks that map to x402 endpoint capabilities.",
});

queryContext.setActions([
  action({
    name: "decompose-query",
    description:
      "Decompose a natural language query into sub-tasks that can be fulfilled by x402 endpoints. Returns an array of sub-tasks with required capabilities and priorities.",
    schema: s(
      z.object({
        query: z.string().describe("The user's natural language query to decompose"),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { query } = args as { query: string };
      const capabilities = getAllCapabilities();

      logInfo(`Decomposing query: "${query}"`);
      logInfo(`Available capabilities: ${capabilities.length}`);

      const prompt = buildDecompositionPrompt(query, capabilities);

      try {
        const result = await generateText({
          model: anthropic("claude-sonnet-4-5-20250929"),
          prompt,
          maxOutputTokens: 1024,
          temperature: 0.3,
        });

        const rawText = result.text.trim();
        const parsed = JSON.parse(rawText);
        const decomposition = DecompositionResultSchema.parse(parsed);

        ctx.memory.lastDecomposition = decomposition;

        logInfo(`Decomposed into ${decomposition.subTasks.length} sub-tasks`);
        for (const st of decomposition.subTasks) {
          logInfo(`  [P${st.priority}] ${st.requiredCapability}: ${st.task}`);
        }

        return decomposition;
      } catch (error) {
        logError("Query decomposition failed", error);
        throw error;
      }
    },
  }),
]);
