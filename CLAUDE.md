# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Parallax** is an x402 orchestration agent that chains multiple x402-paid endpoints into compound intelligence workflows. It accepts complex queries, decomposes them into sub-tasks, calls multiple x402 endpoints (paying USDC micropayments via CDP Server Wallet on Base), and synthesizes results into premium actionable reports.

This is NOT an x402 endpoint — it is the aggregation/orchestration layer that consumes and chains other agents' endpoints.

**Stack:** TypeScript (strict mode), Vercel AI SDK, Hono, x402 protocol, USDC on Base, CDP Server Wallet v2
**Deployment:** Railway
**Status:** Phase 1.5 migration in progress — Daydreams removed, server entry point drafted, needs runtime testing

## RESUME HERE — Phase 1.5 Migration Status

**When starting a new session, give the user a rundown of this section before proceeding.**

### What was done
1. **Extracted pipeline** — `runPipeline()` moved from `index.ts` into `src/pipeline.ts` (shared by CLI + server)
2. **Removed Daydreams** — Uninstalled `@daydreamsai/core` + `@daydreamsai/cli`, deleted all Daydreams context files (`parallax.ts`, `query.ts`, `execution.ts`, `synthesis.ts`, `billing.ts`, `memory.ts`)
3. **Installed Lucid packages** — `@lucid-agents/core`, `http`, `payments`, `hono`, `a2a`, `wallet` all in `package.json`
4. **Upgraded zod v3 → v4** — Required by Lucid. Fixed `z.record()` call in `types.ts`
5. **Simplified registry** — `src/agent/contexts/registry.ts` is now pure functions only (no Daydreams wrappers)
6. **CLI still works** — `src/index.ts` imports from `pipeline.ts`, same behavior as before
7. **Drafted `src/server.ts`** — Plain Hono server with Lucid-compatible routes (see blocker below)
8. **TypeScript compiles clean** — `npx tsc --noEmit` passes

### Blocker: Lucid SDK is Bun-only
`@lucid-agents/payments` has a **top-level `import { Database } from 'bun:sqlite'`** in its dist bundle. Both `@lucid-agents/core` and `@lucid-agents/hono` depend on it transitively, so the entire Lucid SDK crashes on Node.js with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.

**Consequence:** We cannot use `createAgent()` / `createAgentApp()` from Lucid on Node.js. The current `src/server.ts` uses plain Hono instead, implementing the same routes and agent card format manually.

**Options to evaluate next session:**
- **Option A:** Keep plain Hono server (current approach). Matches Lucid's route pattern, easy to swap in real SDK later. Works on Node.js + Railway today.
- **Option B:** Switch runtime to Bun. Lucid SDK works natively, but requires changing all tooling and Railway config.
- **Option C:** Wait for Lucid to ship a Node-compatible build, keep the packages installed but unused.

### What's left to finish
- **Runtime test `src/server.ts`** — Start server, curl `/health`, `/entrypoints`, `/.well-known/agent-card.json`
- **Decide on Lucid blocker** — Pick option A/B/C above
- **Update `.env.example`** — Add `PORT`, `AGENT_URL` vars
- **Update this CLAUDE.md** — Clean up architecture diagram, remove stale Daydreams references
- **Commit the server** once it's tested and working

## Build Progress

### Phase 1 — COMPLETE
Core pipeline works end-to-end in mock mode and with real Anthropic API.

### Phase 1.5 — IN PROGRESS (Lucid Migration)

| Step | What | Status |
|------|------|--------|
| 1 | Extract pipeline to `src/pipeline.ts` | Done |
| 2 | Install Lucid packages, remove Daydreams | Done |
| 3 | Simplify registry to pure functions | Done |
| 4 | Create server entry point (`src/server.ts`) | Draft — needs runtime test |
| 5 | Delete old Daydreams files | Done |
| 6 | Update CLAUDE.md, .env.example, scripts | Partial |

### What Works
- Full pipeline: query → decompose → execute → synthesize → markdown report
- Mock mode (`MOCK_MODE=true`) with canned responses
- **LLM pipeline tested end-to-end** — decomposition + synthesis working with real Anthropic API
- 11 live x402 endpoints registered (Silverback DeFi: 8 endpoints, Gloria AI: 3 endpoints)
- Structured cost summary after each query
- CDP Server Wallet v2 created and operational at `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A`

### What's Next: Live x402 Testing
- **Fund wallet**: Send USDC on Base mainnet to `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A`
- **Flip mock mode off**: Set `MOCK_MODE=false` in `.env`
- **Run live**: `npx tsx src/index.ts 'Should I invest in $AERO on Base?'`
- Expect ~$0.05-0.10 per query (5-6 endpoints at $0.001-$0.03 each + LLM costs)

## Next Steps

### Phase 1 Hardening (do these first)
1. ~~**Test with real LLM**~~ — DONE, decomposition + synthesis verified with Anthropic API
2. ~~**Verify endpoint URLs**~~ — DONE, registry updated with 11 live endpoints (Silverback DeFi + Gloria AI)
3. **Test live x402 payments** — Fund wallet, flip `MOCK_MODE=false`, run a real query
4. **Prompt iteration** — Test decomposition and synthesis prompts with varied queries, tune for quality
5. **Memory integration** — Wire memory context into the pipeline (save query results, update endpoint reliability after each call)
6. **Error edge cases** — Test: all endpoints fail, no matching endpoints, LLM returns malformed JSON

### Phase 1.5 — Migrate to Lucid Agents SDK

**Why:** `@daydreamsai/core` is the old framework. Lucid Agents (`@lucid-agents/*`) is the current
SDK from the same team, purpose-built for x402 commerce agents. Migrating makes Parallax
discoverable on xgate and sellable as a service to other agents — the key business model shift
from cost center (CLI tool that spends USDC) to revenue generator (agent that earns USDC).

**What stays the same:**
- Pipeline logic (decompose → execute → synthesize) — untouched
- Prompts (`src/prompts/`) — untouched
- Endpoint registry (`src/endpoints/registry.json`) — untouched
- Types (`src/agent/types.ts`) — untouched
- Vercel AI SDK for LLM calls (`generateText` from `ai`) — untouched

**What changes:**
- Replace `@daydreamsai/core` + `@daydreamsai/cli` with `@lucid-agents/core` + `@lucid-agents/http`
- Add `@lucid-agents/payments` — replaces our manual x402 client (`src/endpoints/client.ts`) with
  built-in payment handling, policy enforcement, spend limits, and tracking
- Add `@lucid-agents/a2a` — agent-to-agent communication, agent card generation
- Expose `run-pipeline` as a priced Lucid entrypoint so other agents can pay to call it
- Add `@lucid-agents/hono` (or express/next) adapter for HTTP serving
- Remove Daydreams contexts (`src/agent/contexts/*.ts`) — replace with plain functions
- Remove zod v3/v4 `as any` casting workarounds (Lucid uses standard zod)

**Lucid packages to install:**
- `@lucid-agents/core` — agent runtime
- `@lucid-agents/http` — HTTP extension with SSE streaming
- `@lucid-agents/payments` — x402 payment integration (incoming + outgoing)
- `@lucid-agents/a2a` — agent-to-agent discovery and communication
- `@lucid-agents/wallet` — wallet management
- `@lucid-agents/hono` — Hono HTTP adapter (lightweight, good for Railway)
- `@lucid-agents/cli` — scaffolding tool (optional, for reference)

**Lucid agent pattern:**
```typescript
import { createAgent } from '@lucid-agents/core'
import { http } from '@lucid-agents/http'
import { payments } from '@lucid-agents/payments'
import { a2a } from '@lucid-agents/a2a'
import { z } from 'zod'

const agent = await createAgent({ name: 'parallax', version: '1.0.0' })
  .use(http())
  .use(payments({ config: { receivableAddress: '0x...' } }))
  .use(a2a())
  .build()

agent.entrypoints.add({
  key: 'intelligence-report',
  input: z.object({ query: z.string() }),
  output: z.object({ report: z.string(), costUsd: z.number() }),
  price: { amount: '0.50', currency: 'USDC' },
  handler: async ({ input }) => {
    // existing pipeline: decompose → execute → synthesize
    return { output: { report, costUsd } }
  },
})
```

**xgate discovery:** Lucid agents auto-generate `/.well-known/agent.json` agent cards, making
them discoverable on xgate.run. Other agents find Parallax, call the `intelligence-report`
entrypoint, pay USDC, and get a report back.

**Migration order:**
1. Test live x402 payments with current code (validate the product works)
2. Install Lucid packages, scaffold new entry point
3. Move pipeline logic into a Lucid entrypoint handler
4. Replace manual x402 client with `@lucid-agents/payments` for outgoing calls
5. Add A2A + identity extensions
6. Deploy to Railway, register on xgate
7. Remove old Daydreams code and contexts

### Phase 2 — Chat UI
- Next.js chat interface with Vercel AI SDK (`useChat` hooks)
- Streaming report output via Lucid SSE
- User wallet connection (wagmi + ConnectKit)
- User pays USDC → Parallax pays endpoints → retains margin

### Phase 3 — Growth
- Parallel endpoint execution
- Endpoint auto-discovery via xgate Bazaar API
- ERC-8004 on-chain identity + reputation
- A2A agent-to-agent supply chains (Parallax calls other Lucid agents as data sources)
- Reliability scoring + smart routing
- Custom workflow builder
- Webhook / Telegram / Farcaster delivery

## Key Documents

- `parallax-CLAUDE.md` — Original build guide with implementation steps, code patterns, and phase plan
- `parallax-prd.md` — Full PRD with business context, workflows, architecture, monetization, and roadmap
- `SCRATCHPAD.md` — Lessons learned, gotchas, and decisions made during the build (zod v3/v4, AI SDK versioning, etc.)

## Architecture

```
src/
├── index.ts                      # Entry point — single query or interactive CLI
├── agent/
│   ├── parallax.ts               # createDreams agent + orchestration context
│   ├── types.ts                  # Zod-validated types (endpoints, sub-tasks, results, reports)
│   └── contexts/
│       ├── registry.ts           # Endpoint registry — load, search by capability
│       ├── query.ts              # Query decomposition — LLM breaks query into sub-tasks
│       ├── execution.ts          # Execute sub-tasks via x402 client sequentially
│       ├── synthesis.ts          # Synthesize endpoint results into markdown report
│       ├── billing.ts            # Track per-query costs (x402 + LLM)
│       └── memory.ts             # JSON file persistence (past queries, reliability)
├── endpoints/
│   ├── registry.json             # 11 live x402 endpoints (Silverback DeFi + Gloria AI)
│   └── client.ts                 # x402 HTTP client (mock mode, CDP wallet, timeouts)
├── prompts/
│   ├── decompose.ts              # Decomposition prompt template
│   └── synthesize.ts             # Synthesis prompt template
└── utils/
    └── logger.ts                 # Structured endpoint call logging
```

**Core loop:** User Query → Decompose into sub-tasks → Match to x402 endpoints → Execute calls (sequential) → LLM synthesizes report → Print report + cost summary

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run single query (mock mode — no USDC spent)
MOCK_MODE=true npx tsx src/index.ts "Should I invest in $AERO on Base?"

# Run interactive mode
MOCK_MODE=true npx tsx src/index.ts

# Run with live x402 endpoints (requires funded wallet)
npx tsx src/index.ts "Should I invest in $AERO on Base?"

# TypeScript compilation check
npx tsc --noEmit
```

## Environment Variables

Required in `.env` (see `.env.example`):
- `ANTHROPIC_API_KEY` — LLM calls for decomposition + synthesis
- `CDP_API_KEY_ID` — Coinbase Developer Platform API key ID
- `CDP_API_KEY_SECRET` — Coinbase Developer Platform API key secret
- `CDP_WALLET_SECRET` — CDP wallet secret for signing x402 payments
- `BASE_RPC_URL` — Base mainnet RPC (optional, CDP handles signing remotely)
- `MOCK_MODE` — Set to `true` to skip real x402 calls and use canned responses
- `EVM_PRIVATE_KEY` — (dev only) Local private key signer instead of CDP wallet

## Coding Standards

- TypeScript strict mode
- Zod for all external data validation — endpoint responses are untrusted
- All x402 calls go through the centralized client (`src/endpoints/client.ts`), never raw fetch
- Log every endpoint call with: endpoint_id, latency_ms, cost, success/fail
- Keep synthesis prompts in separate files (`src/prompts/`) for easy iteration
- Each context is a single file with a single responsibility
- Use `as any` casts for zod schemas passed to Daydreams `context()` and `action()` (zod v3/v4 compat)

## Git Workflow

- **Do NOT include `Co-Authored-By` lines in commit messages.** No co-author attribution.
- Commit and push after each feature/module is complete so we can test modularly
- Keep commits focused on a single feature or context — one logical unit per commit
- Push to `origin` (https://github.com/0xSardius/parallax-agent.git) after each commit

## x402 Payment Pattern

x402 v2 uses `@x402/fetch` + `@x402/evm` packages (NOT the deprecated `x402-fetch`):

```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

const client = new x402Client();
registerExactEvmScheme(client, { signer: toClientEvmSigner(account) });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment(endpoint.url);
```

## Error Handling

- Endpoint returns non-200 (excluding 402 payment flow): log, skip, note gap in report
- Endpoint timeout (>10s): skip with timeout note
- Decomposition returns capabilities with no matching endpoint: note "data unavailable" in report
- Never let a single endpoint failure kill the entire workflow — always produce a partial report

## CDP Wallet

- **Address**: `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A`
- **Network**: Base mainnet
- **Token**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Wallet name**: `parallax-agent` (idempotent via `getOrCreateAccount`)
- Created via CDP Server Wallet v2 — keys secured in AWS Nitro Enclave TEE

## Live x402 Endpoints

Registry updated with verified live endpoints (all return 402 Payment Required):

**Silverback DeFi** (`x402.silverbackdefi.app`) — 8 endpoints:
- top-coins ($0.001), trending-tokens ($0.001), top-pools ($0.001), dex-metrics ($0.002)
- whale-moves ($0.01), token-audit ($0.01), technical-analysis ($0.02), defi-yield ($0.02)

**Gloria AI** (`api.itsgloria.ai`) — 3 endpoints:
- news ($0.03), recaps ($0.10), news-ticker-summary ($0.031)

**Other confirmed live endpoints** (not yet in registry, potential additions):
- Zapper (`public.zapper.xyz`) — 14 endpoints (token prices, holders, portfolio, transactions)
- Elsa x402 (`x402-api.heyelsa.ai`) — 18 endpoints (DeFi trading, portfolio, yield)
- Neynar (`api.neynar.com`) — Farcaster social data via x402
- Firecrawl (`api.firecrawl.dev`) — web scraping

## Known Issues / Tech Debt

- **zod v3/v4 mismatch**: Daydreams bundles zod v4 internally, our project uses zod v3. We cast with `as any`. If Daydreams updates to export zod or align versions, remove the casts.
- **Memory not wired into pipeline**: Billing and memory contexts exist but aren't called from the main `runPipeline()` in `index.ts`. Need to add save-query-result and update-endpoint-reliability calls.
- **LLM cost estimates are hardcoded**: `$0.003` for decomposition, `$0.008` for synthesis. Should use actual token counts from AI SDK response.
- **Endpoint registry is static**: No runtime discovery. Phase 3 will add auto-discovery.
- **CLI `$` escaping**: Use single quotes for queries with `$` symbols (e.g. `'Should I invest in $AERO?'`), otherwise the shell interprets `$AERO` as a variable.

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
