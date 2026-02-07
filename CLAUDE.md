# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Parallax** is an x402 orchestration agent that chains multiple x402-paid endpoints into compound intelligence workflows. It accepts complex queries, decomposes them into sub-tasks, calls multiple x402 endpoints (paying USDC micropayments via CDP Server Wallet on Base), and synthesizes results into premium actionable reports.

This is NOT an x402 endpoint — it is the aggregation/orchestration layer that consumes and chains other agents' endpoints.

**Stack:** TypeScript (strict mode), Daydreams framework, x402 protocol, USDC on Base, CDP Server Wallet v2
**Deployment:** Railway
**Status:** Pre-development (Phase 1)

## Key Documents

- `parallax-CLAUDE.md` — Detailed build guide with implementation steps, code patterns, prompts, and phase plan
- `parallax-prd.md` — Full PRD with business context, workflows, architecture, monetization, and roadmap
- `SCRATCHPAD.md` — Lessons learned, gotchas, and decisions made during the build

## Architecture

```
ParallaxAgent (Daydreams)
├── QueryContext          — LLM decomposes user query into sub-tasks
├── EndpointRegistryCtx   — Catalog of x402 endpoints: capabilities, pricing, reliability
├── ExecutionContext       — Call endpoints via x402 client, manage payments, handle failures/retries
├── SynthesisContext       — LLM combines raw results into structured markdown report
├── MemoryContext          — Past queries, user prefs, endpoint reliability (v1: JSON file)
└── BillingContext         — Track per-query costs, margins, user credits
```

**Core loop:** User Query → Decompose into sub-tasks → Match to x402 endpoints → Execute calls (sequential in Phase 1) → LLM synthesizes report → Deliver to user

Each context lives in its own file under `src/agent/contexts/`. The x402 HTTP client (`src/endpoints/client.ts`) centralizes all endpoint calls — never use raw fetch for x402 endpoints.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run CLI (primary entry point)
npx tsx src/index.ts "your query here"

# TypeScript compilation check
npx tsc --noEmit
```

## Environment Variables

Required in `.env` (see `.env.example`):
- `ANTHROPIC_API_KEY` — LLM calls for decomposition + synthesis
- `CDP_API_KEY` — Coinbase Developer Platform agent wallet
- `CDP_WALLET_SECRET` — CDP wallet secret
- `BASE_RPC_URL` — Base mainnet RPC
- `AGENT_WALLET_ADDRESS` — Pre-funded USDC wallet for x402 payments

## Coding Standards

- TypeScript strict mode
- Zod for all external data validation — endpoint responses are untrusted
- All x402 calls go through the centralized client (`x402-fetch` package), never raw fetch
- Log every endpoint call with: endpoint_id, latency_ms, cost, success/fail
- Keep synthesis prompts in separate files for easy iteration
- Each context is a single file with a single responsibility

## Git Workflow

- **Do NOT include `Co-Authored-By` lines in commit messages.** No co-author attribution.
- Commit and push after each feature/module is complete so we can test modularly
- Keep commits focused on a single feature or context — one logical unit per commit
- Push to `origin` (https://github.com/0xSardius/parallax-agent.git) after each commit

## x402 Payment Pattern

x402 uses HTTP 402 Payment Required flow. The `x402-fetch` package handles payment headers automatically when configured with a CDP Server Wallet:

```typescript
import { x402Fetch } from 'x402-fetch';
const response = await x402Fetch(endpoint.url + '/api/data', {
  wallet: agentWallet,
  maxPayment: endpoint.costPerCall
});
```

## Error Handling

- Endpoint returns non-200 (excluding 402 payment flow): log, skip, note gap in report
- Endpoint timeout (>10s): skip with timeout note
- Decomposition returns capabilities with no matching endpoint: note "data unavailable" in report
- Never let a single endpoint failure kill the entire workflow — always produce a partial report

## Phase 1 Scope (Current)

Phase 1 is CLI-only, sequential execution, no UI, no auth, no subscriptions. Goal: query in → markdown report out. See `parallax-CLAUDE.md` "Phase 1 Build" section for detailed step-by-step build order and file structure.

## Endpoint Registry

Seed endpoint data lives in `src/endpoints/registry.json`. Known x402 endpoints come from the goust ecosystem (github.com/langoustine69). Verify endpoint URLs are live before building against them; use mock endpoints locally if needed.

## Relevant Skills

These Claude Code skills are available and useful at different phases of the build:

**Phase 1 (current):**
- `prompt-engineering-patterns` — Optimize decomposition and synthesis prompts for reliable LLM output
- `railway-docs` — Railway deployment configuration and troubleshooting
- `viem` — Low-level EVM/Base blockchain interactions (wallet ops, USDC transfers, tx signing)

**Phase 2 (chat UI):**
- `ai-sdk-core` — Vercel AI SDK backend: streaming, tool use, structured output
- `ai-sdk-ui` — `useChat`/`useCompletion` hooks for the Next.js chat interface
- `frontend-design` — Production-grade UI design for the chat interface
- `vercel-react-best-practices` — Next.js performance patterns
- `wagmi` — React hooks for wallet connection and onchain interactions in the UI
