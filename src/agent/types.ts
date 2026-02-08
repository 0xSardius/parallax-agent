import { z } from "zod";

// --- Endpoint Registry ---

export const X402EndpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  capabilities: z.array(z.string()),
  costPerCall: z.number().positive(),
  reliability: z.number().min(0).max(1),
  description: z.string(),
});

export type X402Endpoint = z.infer<typeof X402EndpointSchema>;

// --- Query Decomposition ---

export const SubTaskSchema = z.object({
  task: z.string(),
  requiredCapability: z.string(),
  priority: z.number().int().min(1).max(5),
});

export type SubTask = z.infer<typeof SubTaskSchema>;

export const DecompositionResultSchema = z.object({
  subTasks: z.array(SubTaskSchema),
  reasoning: z.string(),
});

export type DecompositionResult = z.infer<typeof DecompositionResultSchema>;

// --- Execution ---

export const EndpointResultSchema = z.object({
  endpointId: z.string(),
  endpointName: z.string(),
  capability: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  latencyMs: z.number(),
  costUsd: z.number(),
});

export type EndpointResult = z.infer<typeof EndpointResultSchema>;

// --- Synthesis ---

export const ReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string(),
      sources: z.array(z.string()),
    })
  ),
  dataGaps: z.array(z.string()),
  confidenceScore: z.number().min(0).max(100),
  keyRisks: z.array(z.string()),
});

export type Report = z.infer<typeof ReportSchema>;

// --- Workflow ---

export interface WorkflowResult {
  query: string;
  decomposition: DecompositionResult;
  endpointResults: EndpointResult[];
  report: string;
  totalCostUsd: number;
  totalLatencyMs: number;
}

// --- Billing ---

export interface CostEntry {
  type: "x402" | "llm";
  description: string;
  costUsd: number;
  timestamp: number;
}

export interface QueryCostSummary {
  query: string;
  entries: CostEntry[];
  totalCostUsd: number;
  timestamp: number;
}

// --- Memory ---

export interface MemoryStore {
  queries: QueryCostSummary[];
  endpointReliability: Record<string, { successes: number; failures: number }>;
}
