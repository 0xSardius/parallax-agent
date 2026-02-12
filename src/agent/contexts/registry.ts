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

export function getEndpointsForTier(tier: QueryTier): X402Endpoint[] {
  if (tier === "premium") return endpoints; // premium gets everything
  return endpoints.filter((ep) => ep.tier === "standard");
}

export function getAllCapabilities(tier: QueryTier = "standard"): string[] {
  const caps = new Set<string>();
  for (const ep of getEndpointsForTier(tier)) {
    for (const cap of ep.capabilities) {
      caps.add(cap);
    }
  }
  return Array.from(caps);
}

export function findByCapability(
  capability: string,
  tier: QueryTier = "standard"
): X402Endpoint | undefined {
  return getEndpointsForTier(tier)
    .filter((ep) => ep.capabilities.includes(capability))
    .sort((a, b) => b.reliability - a.reliability)[0];
}

export { endpoints };
