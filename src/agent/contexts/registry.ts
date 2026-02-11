import { context, action } from "@daydreamsai/core";
import { z } from "zod";
import { X402EndpointSchema, type X402Endpoint, type QueryTier } from "../types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const registryPath = join(__dirname, "../../endpoints/registry.json");
const registryData = JSON.parse(readFileSync(registryPath, "utf-8"));

const endpoints: X402Endpoint[] = (registryData as unknown[]).map((e) =>
  X402EndpointSchema.parse(e)
);

function getEndpointsForTier(tier: QueryTier): X402Endpoint[] {
  if (tier === "premium") return endpoints; // premium gets everything
  return endpoints.filter((ep) => ep.tier === "standard");
}

function getAllCapabilities(tier: QueryTier = "standard"): string[] {
  const caps = new Set<string>();
  for (const ep of getEndpointsForTier(tier)) {
    for (const cap of ep.capabilities) {
      caps.add(cap);
    }
  }
  return Array.from(caps);
}

function findByCapability(capability: string, tier: QueryTier = "standard"): X402Endpoint | undefined {
  return getEndpointsForTier(tier)
    .filter((ep) => ep.capabilities.includes(capability))
    .sort((a, b) => b.reliability - a.reliability)[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod v3/v4 compat bridge
const s = (schema: z.ZodTypeAny) => schema as any;

export const registryContext = context({
  type: "endpoint-registry",
  create: () => ({
    endpoints,
    capabilities: getAllCapabilities(),
  }),
  render: (state: any) => {
    const caps = state.memory.capabilities as string[];
    return `Available x402 endpoint capabilities: ${caps.join(", ")}\nTotal endpoints: ${(state.memory.endpoints as X402Endpoint[]).length}`;
  },
  instructions:
    "This context provides access to the x402 endpoint registry. Use it to find endpoints that can fulfill specific data needs.",
});

registryContext.setActions([
  action({
    name: "list-capabilities",
    description: "List all available capabilities across registered x402 endpoints",
    schema: s(z.object({})),
    handler: async (_args: any, ctx: any) => {
      return { capabilities: ctx.memory.capabilities };
    },
  }),
  action({
    name: "find-endpoint",
    description:
      "Find the best endpoint for a given capability. Returns the most reliable endpoint that offers the capability.",
    schema: s(
      z.object({
        capability: z
          .string()
          .describe("The capability to search for (e.g. 'whale_tracking', 'yield_data')"),
      })
    ),
    handler: async (args: any) => {
      const { capability } = args as { capability: string };
      const endpoint = findByCapability(capability);
      if (!endpoint) {
        return { found: false, capability, message: `No endpoint found for capability: ${capability}` };
      }
      return { found: true, endpoint };
    },
  }),
  action({
    name: "list-endpoints",
    description: "List all registered x402 endpoints with their capabilities and pricing",
    schema: s(z.object({})),
    handler: async (_args: any, ctx: any) => {
      return {
        endpoints: (ctx.memory.endpoints as X402Endpoint[]).map((ep) => ({
          id: ep.id,
          name: ep.name,
          capabilities: ep.capabilities,
          costPerCall: ep.costPerCall,
          reliability: ep.reliability,
        })),
      };
    },
  }),
]);

export { endpoints, getAllCapabilities, findByCapability, getEndpointsForTier };
