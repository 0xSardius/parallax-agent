import type { EndpointResult } from "../agent/types.js";

export function buildSynthesisPrompt(
  query: string,
  results: EndpointResult[]
): string {
  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);

  const dataSection = successfulResults
    .map(
      (r) =>
        `### ${r.endpointName} (${r.capability})\n${JSON.stringify(r.data, null, 2)}`
    )
    .join("\n\n");

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
1. **Directly answers** the user's question in the opening summary
2. **Cites which data source** supports each claim (use the endpoint names)
3. **Notes any data gaps** where sources were unavailable or conflicting
4. **Provides a confidence score** (0-100) based on data completeness and source agreement
5. **Lists key risks** the user should be aware of

## Response Format
Write the report as clean markdown. Include these sections:
- **Summary** — 2-3 sentence direct answer
- **Analysis** — detailed findings organized by theme, citing sources
- **Data Gaps** — what data was missing or unavailable
- **Confidence Score** — 0-100 with brief justification
- **Key Risks** — bullet points of risks to consider

Do NOT wrap your response in code fences. Write plain markdown only.`;
}
