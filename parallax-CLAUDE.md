# CLAUDE.md — Parallax

## Project Overview

**Parallax** is an x402 orchestration agent that chains multiple x402-paid endpoints into compound intelligence workflows. It accepts complex queries, decomposes them into sub-tasks, calls multiple x402 endpoints (paying USDC micropayments), and synthesizes results into premium actionable reports.

This is NOT another x402 endpoint. This is the aggregation layer — the agent that consumes and orchestrates other agents.

**Stack:** TypeScript, Daydreams framework, x402 protocol, USDC on Base, CDP Server Wallet v2, Railway (deployment)

**Full PRD:** See `x402-orchestration-agent-prd.md` in repo root for complete context.

---

## Architecture

```
ParallaxAgent (Daydreams)
├── QueryContext          — Parse user intent → decompose into sub-tasks
├── EndpointRegistryCtx   — Catalog of x402 endpoints, capabilities, pricing, reliability
├── ExecutionContext       — Call endpoints, manage x402 payments, handle failures/retries
├── SynthesisContext       — LLM combines raw results into coherent report
├── MemoryContext          — Past queries, user prefs, endpoint reliability scores
└── BillingContext         — Track per-query costs, margins, user credits
```

### Core Loop

```
User Query
  → QueryContext: LLM decomposes into sub-tasks
  → EndpointRegistryCtx: match sub-tasks to available x402 services
  → ExecutionContext: call endpoints in parallel, pay micropayments
  → SynthesisContext: LLM combines results into structured report
  → Delivery: return to user (chat, API, or webhook)
```

---

## Phase 1 Build (START HERE)

Phase 1 is foundation. No UI. CLI-only. Sequential execution. The goal is: query in → report out.

### Step 1: Scaffold Project

```
parallax/
├── CLAUDE.md
├── x402-orchestration-agent-prd.md
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                    # Entry point, CLI interface
│   ├── agent/
│   │   ├── parallax.ts             # Daydreams agent setup + context composition
│   │   ├── contexts/
│   │   │   ├── query.ts            # Query decomposition context
│   │   │   ├── registry.ts         # Endpoint registry context
│   │   │   ├── execution.ts        # x402 call execution context
│   │   │   ├── synthesis.ts        # Result synthesis context
│   │   │   ├── memory.ts           # Memory context (v1: simple JSON, v2: vector DB)
│   │   │   └── billing.ts          # Cost tracking context
│   │   └── types.ts                # Shared types
│   ├── endpoints/
│   │   ├── registry.json           # Static endpoint catalog (seed data)
│   │   └── client.ts               # x402 HTTP client with payment headers
│   ├── workflows/
│   │   ├── token-dd.ts             # Workflow 1: Token Due Diligence
│   │   ├── macro-brief.ts          # Workflow 3: Macro Context Brief
│   │   └── yield-rotation.ts       # Workflow 2: Yield Rotation (Phase 2)
│   └── utils/
│       ├── decompose.ts            # LLM query decomposition helper
│       └── format.ts               # Report formatting (markdown output)
```

### Step 2: Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@daydreamsai/core": "latest",
    "x402-fetch": "latest",
    "dotenv": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "latest",
    "@types/node": "latest"
  }
}
```

### Step 3: Endpoint Registry Seed

Seed `endpoints/registry.json` with known live x402 endpoints. These are from the goust ecosystem and any others discoverable at build time:

```json
[
  {
    "id": "defi-yield",
    "name": "DeFi Yield Agent",
    "url": "https://defi-yield-agent.up.railway.app",
    "capabilities": ["yield_data", "apy_comparison", "tvl_tracking"],
    "costPerCall": 0.05,
    "reliability": 0.9
  },
  {
    "id": "chain-analytics",
    "name": "Chain Analytics Agent",
    "url": "https://chain-analytics-agent.up.railway.app",
    "capabilities": ["active_addresses", "gas_trends", "bridge_volume", "holder_distribution"],
    "costPerCall": 0.05,
    "reliability": 0.9
  },
  {
    "id": "perps-analytics",
    "name": "Perpetuals Analytics Agent",
    "url": "https://perps-analytics-agent.up.railway.app",
    "capabilities": ["funding_rates", "open_interest", "liquidation_levels"],
    "costPerCall": 0.05,
    "reliability": 0.9
  },
  {
    "id": "news-agent",
    "name": "Tech News Agent",
    "url": "https://news-agent.up.railway.app",
    "capabilities": ["crypto_news", "regulatory_updates", "project_announcements"],
    "costPerCall": 0.05,
    "reliability": 0.85
  }
]
```

**IMPORTANT:** Before building, verify these endpoint URLs are live. Goust's repos are at https://github.com/langoustine69 — check which agents are actually deployed and update URLs accordingly. If endpoints aren't live yet, build mock endpoints locally for development.

### Step 4: Build Order

1. **Types first** — Define `X402Endpoint`, `SubTask`, `WorkflowResult`, `Report` interfaces in `types.ts`
2. **x402 client** — HTTP client that adds x402 payment headers to requests. Reference x402 protocol spec for header format.
3. **Endpoint registry** — Load from JSON, expose lookup by capability
4. **Query decomposition** — LLM call that takes natural language query → returns array of SubTasks with required capabilities
5. **Execution context** — Takes SubTasks, matches to endpoints via registry, calls sequentially (parallel in Phase 2), collects results
6. **Synthesis context** — Takes raw endpoint results + original query, LLM generates structured markdown report
7. **CLI entry point** — Accept query as arg, run pipeline, print report
8. **Test with Workflow 1** (Token Due Diligence) end-to-end

### Step 5: First Test

```bash
npx tsx src/index.ts "Should I invest in $AERO on Base?"
```

Expected output: Markdown report combining chain data, social signals, yield context, and news into a structured risk/opportunity assessment.

---

## Key Implementation Notes

### x402 Payment Headers

x402 uses HTTP 402 Payment Required flow. When an endpoint returns 402, the client must include payment proof in the retry. Use the `x402-fetch` package which handles this automatically when configured with a wallet.

```typescript
import { x402Fetch } from 'x402-fetch';

const response = await x402Fetch(endpoint.url + '/api/data', {
  wallet: agentWallet, // CDP Server Wallet
  maxPayment: endpoint.costPerCall
});
```

### Query Decomposition Prompt

```
You are Parallax, an intelligence orchestration agent. 
Given a user query, decompose it into specific sub-tasks.
Each sub-task should map to one of these capabilities:
${capabilities.join(', ')}

Return JSON array of sub-tasks:
[{ "task": "description", "requiredCapability": "capability_name", "priority": 1-5 }]
```

### Synthesis Prompt

```
You are Parallax, synthesizing multiple data sources into a single intelligence report.

User's original query: ${query}

Data collected:
${results.map(r => `### ${r.source}\n${JSON.stringify(r.data)}`).join('\n')}

Generate a structured report that:
1. Directly answers the user's question
2. Cites which data source supports each claim
3. Notes any data gaps or conflicting signals
4. Ends with a confidence score (0-100) and key risks
```

### Error Handling

- If an endpoint returns non-200 (excluding 402 payment flow): log, skip, note gap in report
- If an endpoint times out (>10s): skip with timeout note
- If decomposition returns capabilities with no matching endpoint: note in report as "data unavailable"
- Never let a single endpoint failure kill the entire workflow

---

## Environment Variables

```
# .env
ANTHROPIC_API_KEY=            # For LLM calls (decomposition + synthesis)
CDP_API_KEY=                  # Coinbase Developer Platform — agent wallet
CDP_WALLET_SECRET=            # CDP wallet secret
BASE_RPC_URL=                 # Base mainnet RPC
AGENT_WALLET_ADDRESS=         # Pre-funded USDC wallet for paying x402 endpoints
```

---

## Phase 2 (After Phase 1 Works)

- Chat UI (Next.js + Vercel AI SDK — port pattern from Tidal)
- Parallel endpoint execution
- User payment flow (user pays USDC → agent pays endpoints → retains margin)
- Workflow 2: Yield Rotation Thesis
- Workflow 3: Macro Context Brief (if not done in Phase 1)
- Deploy to Railway
- Register as x402 endpoint itself (agent-to-agent)

## Phase 3 (Growth)

- Subscription billing
- Endpoint auto-discovery
- Reliability scoring + smart routing
- Custom workflow builder
- Webhook / Telegram / Farcaster delivery

---

## Coding Standards

- TypeScript strict mode
- Zod for all external data validation (endpoint responses are untrusted)
- Descriptive variable names, no abbreviations
- Each context is its own file with a single responsibility
- All x402 calls go through the centralized client — never raw fetch
- Log every endpoint call with: endpoint_id, latency_ms, cost, success/fail
- Keep synthesis prompts in separate files for easy iteration

---

## What NOT to Build in Phase 1

- No UI (CLI only)
- No user accounts or auth
- No subscription billing
- No parallel execution (sequential is fine for 3-5 calls)
- No endpoint auto-discovery (manual registry is fine)
- No vector DB for memory (JSON file is fine)
- No deployment optimization — local dev + Railway deploy is sufficient
