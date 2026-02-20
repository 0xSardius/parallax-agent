import type { EndpointResult } from "../agent/types.js";

// --- Data truncation for synthesis cost control ---
// Target: ~4K tokens total for endpoint data (~16K chars)
// Without this, verbose endpoints (Neynar, etc.) push synthesis to 40K+ input tokens

const MAX_DATA_CHARS_TOTAL = 16000;
const MAX_ARRAY_ITEMS = 3;

/**
 * Trim arrays at top level and one level deep to keep only first N items.
 * This handles the main cost driver: endpoints returning large arrays of objects
 * (Neynar casts, CoinGecko pools, Silverback whale moves, etc.)
 */
function trimArrays(value: unknown, maxItems: number, depth = 0): unknown {
  if (value === null || value === undefined || typeof value !== "object")
    return value;

  if (Array.isArray(value)) {
    const total = value.length;
    const kept = value.slice(0, maxItems);
    const trimmed = kept.map((item) =>
      depth < 2 ? trimArrays(item, maxItems, depth + 1) : item
    );
    if (total > maxItems) {
      return [...trimmed, { _omitted: `${total - maxItems} more items` }];
    }
    return trimmed;
  }

  // Recurse into object values (up to depth 2)
  if (depth < 2) {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = trimArrays(val, maxItems, depth + 1);
    }
    return result;
  }

  return value;
}

/**
 * Truncate endpoint data for synthesis prompt.
 * 1. Trim arrays to first few items (biggest win)
 * 2. Compact JSON (no indentation — saves ~30%)
 * 3. Hard character cap with truncation marker
 */
function truncateEndpointData(data: unknown, maxChars: number): string {
  const trimmed = trimArrays(data, MAX_ARRAY_ITEMS);
  const json = JSON.stringify(trimmed);

  if (json.length <= maxChars) return json;
  return json.slice(0, maxChars) + "…(truncated)";
}

/** Returns total raw chars and total truncated chars for logging */
export function truncateAllEndpointData(
  results: EndpointResult[]
): { sections: string; rawChars: number; truncatedChars: number } {
  const successful = results.filter((r) => r.success);
  if (successful.length === 0)
    return { sections: "(no data collected)", rawChars: 0, truncatedChars: 0 };

  const perEndpointBudget = Math.floor(
    MAX_DATA_CHARS_TOTAL / successful.length
  );

  let rawChars = 0;
  let truncatedChars = 0;

  const sections = successful
    .map((r) => {
      const rawJson = JSON.stringify(r.data);
      rawChars += rawJson.length;

      const truncated = truncateEndpointData(r.data, perEndpointBudget);
      truncatedChars += truncated.length;

      return `### ${r.endpointName} (${r.capability})\n${truncated}`;
    })
    .join("\n\n");

  return { sections, rawChars, truncatedChars };
}

export function buildSynthesisPrompt(
  query: string,
  results: EndpointResult[]
): string {
  const failedResults = results.filter((r) => !r.success);

  const { sections: dataSection } = truncateAllEndpointData(results);

  const gapsSection =
    failedResults.length > 0
      ? `\n## Data Gaps\nThe following data sources were unavailable:\n${failedResults.map((r) => `- ${r.capability}: ${r.error}`).join("\n")}`
      : "";

  return `You are Parallax, an intelligence synthesis agent. You have collected data from multiple x402-paid endpoints to answer the user's query. Your job is to synthesize all the data into a clear, actionable intelligence report.

## User's Original Query
${query}

## Data Collected
${dataSection}
${gapsSection}

## Report Requirements
Generate a structured markdown report that:
1. **Directly answers** the user's question in the opening summary — be decisive, not wishy-washy
2. **Cites which data source** supports each claim (use the endpoint names in parentheses)
3. **Distinguishes facts from inferences** — clearly label what the data shows vs. what you're interpreting
4. **Notes data gaps** but prioritize them — which gaps actually matter for answering this query?
5. **Provides a confidence score** (0-100) based on data completeness and source agreement
6. **Lists key risks** the user should be aware of
7. **Ends with concrete next steps** the user can take right now

## Tone
Write like a sharp analyst briefing a trader. Be direct, specific, and opinionated when the data supports it. Avoid filler phrases like "it's worth noting" or "it should be mentioned." If the data points in a clear direction, say so. If it's genuinely uncertain, say that directly too.

## Response Format
Write the report as clean markdown. Include these sections:
- **Summary** — 2-3 sentence direct answer to the user's question
- **Analysis** — detailed findings organized by theme, citing sources
- **Data Gaps** — ranked by impact: which missing data would most change the analysis?
- **Confidence Score** — 0-100 with brief justification
- **Key Risks** — bullet points of risks to consider
- **What To Do Next** — 2-4 concrete, actionable steps the user can take

Do NOT wrap your response in code fences. Write plain markdown only.`;
}
