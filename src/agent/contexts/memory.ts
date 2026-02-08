import { context, action } from "@daydreamsai/core";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { MemoryStore, QueryCostSummary } from "../types.js";
import { logInfo, logError } from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MEMORY_FILE = join(__dirname, "../../../memory.json");

const s = (schema: z.ZodTypeAny) => schema as any;

function loadMemory(): MemoryStore {
  if (!existsSync(MEMORY_FILE)) {
    return { queries: [], endpointReliability: {} };
  }
  try {
    const raw = readFileSync(MEMORY_FILE, "utf-8");
    return JSON.parse(raw) as MemoryStore;
  } catch {
    logError("Failed to load memory file, starting fresh");
    return { queries: [], endpointReliability: {} };
  }
}

function saveMemory(store: MemoryStore): void {
  try {
    writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    logError("Failed to save memory file", error);
  }
}

export const memoryContext = context({
  type: "memory",
  create: () => {
    const store = loadMemory();
    return { store };
  },
  render: (state: any) => {
    const store = state.memory.store as MemoryStore;
    return `Memory: ${store.queries.length} past queries | ${Object.keys(store.endpointReliability).length} endpoints tracked`;
  },
  instructions:
    "This context provides persistent memory — past queries, results, and endpoint reliability scores.",
});

memoryContext.setActions([
  action({
    name: "save-query-result",
    description: "Save a completed query and its cost summary to persistent memory",
    schema: s(
      z.object({
        query: z.string(),
        totalCostUsd: z.number(),
        entries: z.array(
          z.object({
            type: z.enum(["x402", "llm"]),
            description: z.string(),
            costUsd: z.number(),
            timestamp: z.number(),
          })
        ),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const summary = args as QueryCostSummary;
      const store = ctx.memory.store as MemoryStore;
      store.queries.push(summary);
      saveMemory(store);
      logInfo(`Saved query to memory (total: ${store.queries.length} queries)`);
      return { saved: true, totalQueries: store.queries.length };
    },
  }),
  action({
    name: "update-endpoint-reliability",
    description: "Update reliability tracking for an endpoint after a call (success or failure)",
    schema: s(
      z.object({
        endpointId: z.string(),
        success: z.boolean(),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { endpointId, success } = args as {
        endpointId: string;
        success: boolean;
      };
      const store = ctx.memory.store as MemoryStore;

      if (!store.endpointReliability[endpointId]) {
        store.endpointReliability[endpointId] = { successes: 0, failures: 0 };
      }

      if (success) {
        store.endpointReliability[endpointId].successes++;
      } else {
        store.endpointReliability[endpointId].failures++;
      }

      saveMemory(store);

      const { successes, failures } = store.endpointReliability[endpointId];
      const reliability = successes / (successes + failures);
      return { endpointId, reliability, successes, failures };
    },
  }),
  action({
    name: "get-past-queries",
    description: "Retrieve past queries from memory",
    schema: s(
      z.object({
        limit: z.number().optional(),
      })
    ),
    handler: async (args: any, ctx: any) => {
      const { limit } = args as { limit?: number };
      const store = ctx.memory.store as MemoryStore;
      const queries = limit
        ? store.queries.slice(-limit)
        : store.queries;
      return { queries, total: store.queries.length };
    },
  }),
]);
