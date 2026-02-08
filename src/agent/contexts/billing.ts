import { context, action } from "@daydreamsai/core";
import { z } from "zod";
import type { CostEntry, QueryCostSummary } from "../types.js";

const s = (schema: z.ZodTypeAny) => schema as any;

export const billingContext = context({
  type: "billing",
  create: () => ({
    currentEntries: [] as CostEntry[],
    totalSpent: 0,
  }),
  render: (state: any) => {
    const entries = state.memory.currentEntries as CostEntry[];
    const total = state.memory.totalSpent as number;
    return `Billing: ${entries.length} cost entries | Total: $${total.toFixed(4)}`;
  },
  instructions:
    "This context tracks costs for the current query — both x402 endpoint payments and LLM inference costs.",
});

billingContext.setActions([
  action({
    name: "record-cost",
    description: "Record a cost entry for the current query (x402 payment or LLM inference)",
    schema: s(
      z.object({
        type: z.enum(["x402", "llm"]),
        description: z.string(),
        costUsd: z.number(),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { type, description, costUsd } = args as CostEntry;
      const entry: CostEntry = {
        type,
        description,
        costUsd,
        timestamp: Date.now(),
      };
      (ctx.memory.currentEntries as CostEntry[]).push(entry);
      ctx.memory.totalSpent = (ctx.memory.totalSpent as number) + costUsd;
      return { recorded: true, totalSpent: ctx.memory.totalSpent };
    },
  }),
  action({
    name: "get-cost-summary",
    description: "Get a cost summary for the current query",
    schema: s(z.object({})),
    handler: async (_args: any, ctx: any) => {
      const entries = ctx.memory.currentEntries as CostEntry[];
      const x402Total = entries
        .filter((e) => e.type === "x402")
        .reduce((sum, e) => sum + e.costUsd, 0);
      const llmTotal = entries
        .filter((e) => e.type === "llm")
        .reduce((sum, e) => sum + e.costUsd, 0);

      return {
        entries,
        x402CostUsd: x402Total,
        llmCostUsd: llmTotal,
        totalCostUsd: ctx.memory.totalSpent,
      };
    },
  }),
]);

export function buildQueryCostSummary(
  query: string,
  entries: CostEntry[]
): QueryCostSummary {
  return {
    query,
    entries,
    totalCostUsd: entries.reduce((sum, e) => sum + e.costUsd, 0),
    timestamp: Date.now(),
  };
}
