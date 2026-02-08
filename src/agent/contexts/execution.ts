import { context, action } from "@daydreamsai/core";
import { z } from "zod";
import type { SubTask, EndpointResult } from "../types.js";
import { findByCapability } from "./registry.js";
import { callEndpoint } from "../../endpoints/client.js";
import { logInfo, logError } from "../../utils/logger.js";

const s = (schema: z.ZodTypeAny) => schema as any;

export const executionContext = context({
  type: "execution",
  create: () => ({
    results: [] as EndpointResult[],
    totalCostUsd: 0,
    totalLatencyMs: 0,
  }),
  render: (state: any) => {
    const results = state.memory.results as EndpointResult[];
    const successCount = results.filter((r) => r.success).length;
    return `Execution: ${successCount}/${results.length} calls succeeded | Cost: $${state.memory.totalCostUsd} | Latency: ${state.memory.totalLatencyMs}ms`;
  },
  instructions:
    "This context executes x402 endpoint calls for sub-tasks, matching each to the best endpoint and collecting results.",
});

executionContext.setActions([
  action({
    name: "execute-subtasks",
    description:
      "Execute a list of sub-tasks by matching each to an x402 endpoint and calling it sequentially. Handles failures gracefully — skips failed endpoints and notes gaps.",
    schema: s(
      z.object({
        subTasks: z.array(
          z.object({
            task: z.string(),
            requiredCapability: z.string(),
            priority: z.number(),
          })
        ),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { subTasks } = args as { subTasks: SubTask[] };
      const results: EndpointResult[] = [];

      // Sort by priority (1 = highest)
      const sorted = [...subTasks].sort((a, b) => a.priority - b.priority);

      logInfo(`Executing ${sorted.length} sub-tasks sequentially`);

      for (const subTask of sorted) {
        const endpoint = findByCapability(subTask.requiredCapability);

        if (!endpoint) {
          logInfo(`No endpoint for capability: ${subTask.requiredCapability} — skipping`);
          results.push({
            endpointId: "none",
            endpointName: "No endpoint available",
            capability: subTask.requiredCapability,
            success: false,
            error: `No endpoint registered for capability: ${subTask.requiredCapability}`,
            latencyMs: 0,
            costUsd: 0,
          });
          continue;
        }

        logInfo(`Calling ${endpoint.name} for: ${subTask.task}`);

        const result = await callEndpoint(endpoint, subTask.requiredCapability, {
          query: subTask.task,
        });

        results.push(result);
      }

      const totalCostUsd = results.reduce((sum, r) => sum + r.costUsd, 0);
      const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);
      const successCount = results.filter((r) => r.success).length;

      ctx.memory.results = results;
      ctx.memory.totalCostUsd = totalCostUsd;
      ctx.memory.totalLatencyMs = totalLatencyMs;

      logInfo(
        `Execution complete: ${successCount}/${results.length} succeeded | Cost: $${totalCostUsd.toFixed(4)} | Latency: ${totalLatencyMs}ms`
      );

      return {
        results,
        totalCostUsd,
        totalLatencyMs,
        successCount,
        failureCount: results.length - successCount,
      };
    },
  }),
]);
