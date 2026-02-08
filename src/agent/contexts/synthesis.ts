import { context, action } from "@daydreamsai/core";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { EndpointResult } from "../types.js";
import { buildSynthesisPrompt } from "../../prompts/synthesize.js";
import { logInfo, logError } from "../../utils/logger.js";

const s = (schema: z.ZodTypeAny) => schema as any;

export const synthesisContext = context({
  type: "synthesis",
  create: () => ({
    lastReport: null as string | null,
  }),
  render: (state: any) => {
    const report = state.memory.lastReport as string | null;
    if (!report) return "No report synthesized yet.";
    return `Last report: ${report.length} chars`;
  },
  instructions:
    "This context synthesizes endpoint results into structured intelligence reports using LLM analysis.",
});

synthesisContext.setActions([
  action({
    name: "synthesize-report",
    description:
      "Synthesize raw endpoint results and the original query into a structured markdown intelligence report. Uses LLM to analyze, correlate, and present findings.",
    schema: s(
      z.object({
        query: z.string().describe("The user's original query"),
        results: z.array(
          z.object({
            endpointId: z.string(),
            endpointName: z.string(),
            capability: z.string(),
            success: z.boolean(),
            data: z.unknown().optional(),
            error: z.string().optional(),
            latencyMs: z.number(),
            costUsd: z.number(),
          })
        ),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { query, results } = args as {
        query: string;
        results: EndpointResult[];
      };

      logInfo(`Synthesizing report from ${results.length} endpoint results`);

      const prompt = buildSynthesisPrompt(query, results);

      try {
        const result = await generateText({
          model: anthropic("claude-sonnet-4-5-20250929"),
          prompt,
          maxOutputTokens: 4096,
          temperature: 0.5,
        });

        const report = result.text.trim();
        ctx.memory.lastReport = report;

        logInfo(`Report synthesized: ${report.length} chars`);

        return { report };
      } catch (error) {
        logError("Report synthesis failed", error);
        throw error;
      }
    },
  }),
]);
