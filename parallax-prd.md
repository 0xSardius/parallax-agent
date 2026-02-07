# Parallax — x402 Orchestration Agent

**Codename:** Parallax
**Version:** 0.1 — Scoping Draft
**Date:** February 6, 2026
**Author:** Justin
**Framework:** Daydreams (TypeScript)
**Protocol:** x402 Micropayments (USDC on Base)
**Status:** Pre-development

---

## Executive Summary

An AI agent that chains multiple x402-paid endpoints into compound intelligence workflows, synthesizing data from disparate onchain and offchain sources into premium, actionable reports. Instead of building another endpoint, this agent is the **aggregation layer** — the Kayak of the x402 ecosystem.

Everyone is racing to build individual x402 endpoints (yield data, chain analytics, social signals, news). Nobody is building the orchestration layer that makes them useful together. This agent fills that gap.

---

## Problem Statement

### For End Users
- Crypto traders, DAOs, and VCs need multi-source intelligence to make decisions
- Manually querying 5-10 different data sources and synthesizing results is time-consuming
- No product currently chains x402 endpoints into compound workflows
- Existing tools are either read-only dashboards or single-purpose bots

### For the x402 Ecosystem
- Individual endpoints struggle to generate meaningful revenue alone
- No discovery/aggregation layer exists to drive demand to endpoint builders
- The ecosystem needs a consumer of endpoints, not just more producers

---

## Solution Overview

The orchestration agent accepts complex natural language queries, decomposes them into sub-tasks, calls multiple x402 endpoints (paying micropayments automatically), and synthesizes results into a single premium report delivered via chat interface or API.

### Core Loop

```
User Query
    → Query Decomposition (LLM breaks into sub-tasks)
    → Endpoint Selection (match sub-tasks to available x402 services)
    → Parallel Execution (call endpoints, pay micropayments)
    → Synthesis (LLM combines results into actionable output)
    → Delivery (chat, API, or webhook)
```

---

## Target Users

| Segment | Use Case | Willingness to Pay |
|---------|----------|--------------------|
| **Crypto Traders** | "Should I ape this token?" — multi-signal analysis | $1-3 per report |
| **DAO Treasury Managers** | Yield rotation thesis, risk monitoring | $3-5 per report, subscription |
| **VCs / Researchers** | Due diligence on projects, competitive landscape | $5-10 per deep report |
| **Other Agents** | Agent-to-agent intelligence (x402 native) | Micropayments per call |

---

## Compound Workflows (MVP)

### Workflow 1: Token Due Diligence Report

**Trigger:** "Should I invest in $TOKEN?"

| Sub-task | x402 Endpoint | Data Retrieved |
|----------|---------------|----------------|
| Chain analytics | chain-analytics-agent | Contract age, holder distribution, liquidity depth |
| Social sentiment | social-signals-agent | Farcaster/Twitter mention velocity, sentiment score |
| Dev activity | github-analytics-agent | Commit frequency, contributor count, repo health |
| Yield context | defi-yield-agent | If applicable: TVL trend, APY history, protocol risk |
| News context | news-agent | Recent coverage, partnerships, red flags |

**Output:** Structured risk/opportunity report with confidence score and key signals.

**Estimated x402 cost:** $0.10-0.25
**User price:** $2-5

---

### Workflow 2: Yield Rotation Thesis

**Trigger:** "Where should I move my stables for best risk-adjusted yield?"

| Sub-task | x402 Endpoint | Data Retrieved |
|----------|---------------|----------------|
| Current yields | defi-yield-agent | APY across top protocols per chain |
| TVL trends | chain-analytics-agent | TVL momentum (growing vs declining protocols) |
| Stablecoin flows | stablecoin-flow-agent | Net flows between chains and protocols |
| Risk scoring | protocol-risk-agent | Smart contract risk, audit status, depeg history |

**Output:** Ranked yield opportunities with risk-adjusted scoring and migration strategy.

**Estimated x402 cost:** $0.10-0.20
**User price:** $2-3

---

### Workflow 3: Macro Context Brief

**Trigger:** "What's the macro setup right now?"

| Sub-task | x402 Endpoint | Data Retrieved |
|----------|---------------|----------------|
| Chain activity | chain-analytics-agent | Active addresses, gas trends, bridge volume |
| Market structure | perps-analytics-agent | Funding rates, open interest, liquidation levels |
| News digest | news-agent | Top stories, regulatory developments |
| Social pulse | social-signals-agent | Trending narratives, fear/greed proxy |

**Output:** 1-page market context brief suitable for morning review or DAO governance discussion.

**Estimated x402 cost:** $0.10-0.20
**User price:** $1-2

---

### Workflow 4: Project Competitive Landscape (V2)

**Trigger:** "Map the competitive landscape for [sector]"

Chains all available endpoints to build a sector map — who's building what, where capital is flowing, which teams are shipping. VC-style memo output. Premium tier.

**User price:** $5-10

---

## Technical Architecture

### Daydreams Context Composition

```
OrchestratorAgent
├── QueryContext          — Parse user intent, decompose into sub-tasks
├── EndpointRegistryCtx   — Catalog of available x402 endpoints + capabilities
├── ExecutionContext       — Call endpoints, manage payments, handle failures
├── SynthesisContext       — Combine results into coherent output
├── MemoryContext          — Remember past queries, user preferences, endpoint reliability
└── BillingContext         — Track costs, margins, user credits
```

### Endpoint Registry

The agent maintains a registry of known x402 endpoints:

```typescript
interface X402Endpoint {
  id: string;
  name: string;
  url: string;
  capabilities: string[];       // what questions can it answer
  costPerCall: number;           // USDC
  reliability: number;           // 0-1 score based on history
  latency: number;               // avg ms
  lastHealthCheck: Date;
  sampleResponse: object;        // for LLM context
}
```

New endpoints can be added dynamically — the agent discovers and evaluates them.

### Payment Flow

```
User pays agent (USDC on Base)
    → Agent holds funds in CDP Server Wallet
    → Agent calls x402 endpoints (micropayments deducted automatically)
    → Agent retains margin
    → If endpoint fails, funds not spent (retry or refund)
```

### Error Handling & Fallbacks

- **Endpoint down:** Skip and note data gap in report
- **Endpoint returns garbage:** Validate response schema, discard if invalid
- **All endpoints for a sub-task fail:** Surface partial report with explicit gaps
- **Cost overrun:** Hard cap per workflow, abort if exceeded

---

## Monetization

### Pricing Model

| Tier | Access | Price |
|------|--------|-------|
| **Per-report** | Pay per workflow execution | $1-10 depending on complexity |
| **Daily subscriber** | 5 reports/day + morning brief | $29/month |
| **Pro / DAO** | Unlimited + API access + webhooks | $99/month |
| **Agent-to-agent** | x402 endpoint (other agents call this agent) | $0.50-2.00 per call |

### Unit Economics (Per Report)

| Item | Cost |
|------|------|
| x402 endpoint calls (3-5 per workflow) | $0.10-0.25 |
| LLM inference (decomposition + synthesis) | $0.02-0.05 |
| Infrastructure (Railway/Vercel) | $0.01 |
| **Total cost** | **$0.13-0.31** |
| **User price** | **$1-5** |
| **Gross margin** | **75-95%** |

---

## Differentiation / Moat

1. **Prompt engineering + synthesis quality** — The value is in how well the agent interprets, weighs, and combines signals. This is hard to replicate without deep domain knowledge.
2. **Workflow curation** — Knowing which endpoints to chain for which question. Built from real user queries over time.
3. **Endpoint reliability data** — Over time, the agent learns which endpoints are trustworthy, fast, and accurate. This institutional knowledge compounds.
4. **Network effects** — More users → more queries → better synthesis → more endpoint demand → more endpoints onboard → richer reports.
5. **Agent-to-agent positioning** — This agent becomes infrastructure that other agents call, not just a consumer product.

---

## Roadmap

### Phase 1: Foundation (Weeks 1-2)

- [ ] Scaffold Daydreams agent with core contexts
- [ ] Build endpoint registry with 3-5 known x402 endpoints (goust's live agents)
- [ ] Implement query decomposition (LLM parses intent → sub-tasks)
- [ ] Basic sequential execution (call endpoints one at a time)
- [ ] Simple synthesis (combine results into markdown report)
- [ ] CLI interface for testing
- [ ] Deploy to Railway

### Phase 2: Product (Weeks 3-4)

- [ ] Chat interface (Next.js + Vercel AI SDK)
- [ ] Parallel endpoint execution
- [ ] Payment integration (user pays USDC, agent pays x402)
- [ ] CDP Server Wallet v2 for agent treasury
- [ ] Ship Workflow 1 (Token Due Diligence) and Workflow 3 (Macro Brief)
- [ ] Basic user accounts + query history

### Phase 3: Growth (Weeks 5-8)

- [ ] Ship Workflow 2 (Yield Rotation) and Workflow 4 (Competitive Landscape)
- [ ] Subscription billing
- [ ] Expose agent as x402 endpoint (agent-to-agent)
- [ ] Endpoint discovery — auto-detect new x402 services
- [ ] Reliability scoring and smart routing
- [ ] Public launch + blog post on architecture

### Phase 4: Scale (Months 3+)

- [ ] Custom workflow builder (users define their own endpoint chains)
- [ ] Webhook/Telegram/Farcaster delivery channels
- [ ] Endpoint marketplace (endpoint builders register directly)
- [ ] Historical data and trend analysis
- [ ] White-label for DAOs and protocols

---

## Open Questions

1. **Naming** — ✅ Parallax. Multiple vantage points → true signal. Fits the Polaris → Tidal → Parallax portfolio trilogy.
2. **Which endpoints exist today?** — Need to audit goust's live x402 agents and any others in the ecosystem to confirm what's callable right now.
3. **Agent-to-agent first vs consumer first?** — Shipping as an x402 endpoint that other agents call might be faster to validate than building a full consumer chat UI.
4. **Daydreams vs lighter framework?** — Full Daydreams might be overkill for v1. Could start with Vercel AI SDK + custom orchestration and migrate to Daydreams when context composition becomes critical.
5. **How to handle endpoint quality variance?** — Some x402 endpoints will return garbage. Need a validation/scoring layer before synthesis.

---

## Success Metrics

### Phase 1-2
- 3+ workflows operational
- 5+ x402 endpoints integrated
- First 10 paid reports delivered
- Architecture blog post published

### Phase 3-4
- 50+ monthly active users
- $500+/month revenue
- Listed in x402 ecosystem directory
- Other agents calling this agent as an endpoint
- Invited to speak/write about orchestration pattern

---

## Strategic Alignment

This project directly serves the "Onchain Agentic Specialist" positioning:

- **Demonstrates system-level thinking** — not just building endpoints, but architecting how they compose
- **Creates portfolio content** — the architecture itself is thought leadership material
- **Feeds the ebook** — real-world stablecoin/DeFi agent case study
- **Generates revenue** — clear path to income independent of government job
- **Compounds over time** — every new x402 endpoint in the ecosystem makes this agent more valuable without additional build effort

---

## References

- [langoustine69 / goust — x402 agent playbook](https://github.com/langoustine69)
- [x402 Protocol Documentation](https://www.x402.org/)
- [Daydreams AI Framework](https://docs.dreams.fun)
- [ERC-8004 — Agent Identity Registry](https://eips.ethereum.org/EIPS/eip-8004)
- StableVault / Tidal PRD (prior work on Daydreams + DeFi architecture)
- Onchain Astrodice PRD (prior work on x402 payment flows)
