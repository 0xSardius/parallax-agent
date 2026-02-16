import type { CapabilityInfo } from "../agent/contexts/registry.js";

export function buildDecompositionPrompt(
  query: string,
  capabilityDetails: CapabilityInfo[]
): string {
  const capSection = capabilityDetails
    .map((c) => {
      let line = `- **${c.capability}** — ${c.description} ($${c.costPerCall})`;
      if (c.paramHints) line += `\n  Params: ${c.paramHints}`;
      return line;
    })
    .join("\n");

  return `You are Parallax, an intelligence orchestration agent that decomposes complex queries into specific sub-tasks.

Given the user's query below, break it down into concrete sub-tasks. Each sub-task should map to exactly ONE capability from the available list.

## Available Capabilities
${capSection}

## Rules
1. Each sub-task must specify a "requiredCapability" that exactly matches one from the list above
2. Priority is 1 (highest) to 5 (lowest) — assign based on how critical the data is to answering the query
3. Create 2-6 sub-tasks — enough to comprehensively answer the query, but don't be redundant
4. If the query doesn't need a particular capability, don't include it
5. Each sub-task "task" field should be a specific, actionable description of what data to retrieve
6. **IMPORTANT**: Include a "params" object with the correct parameters for that endpoint. Check the Params hints for each capability. Use short, specific values — not full sentences.
7. For token-specific queries, pass the token symbol (e.g. "AERO") in the relevant param field
8. If an endpoint needs a token_address you don't know, skip it or use token_search first

## User Query
${query}

## Response Format
Respond with valid JSON only — no markdown, no code fences, no explanation.

{
  "subTasks": [
    {
      "task": "specific description of what data to retrieve",
      "requiredCapability": "capability_name_from_list",
      "priority": 1,
      "params": { "symbol": "AERO", "chain": "base" }
    }
  ],
  "reasoning": "brief explanation of why these sub-tasks were chosen"
}`;
}
