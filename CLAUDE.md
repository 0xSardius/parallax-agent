# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Parallax** is an x402 orchestration agent built on the Lucid Agents SDK. It chains multiple x402-paid endpoints into compound intelligence workflows — accepting complex queries, decomposing them into sub-tasks, calling multiple x402 endpoints (paying USDC micropayments on Base), and synthesizing results into premium actionable reports.

Parallax is both a **consumer** (pays other x402 endpoints for data) and a **provider** (charges callers USDC via x402 to run reports). Other agents discover it via `/.well-known/agent-card.json` on xgate.

**Stack:** TypeScript (strict mode), Lucid Agents SDK, Vercel AI SDK, Hono, x402 protocol, USDC on Base, CDP Server Wallet v2
**Deployment:** Railway
**Status:** Phase 1.5 complete — Lucid SDK wired, server runtime tested, ready for live x402 testing and Railway deploy

## RESUME HERE — Current Status

**When starting a new session, give the user a rundown of this section before proceeding.**

### Phase 1.5 — COMPLETE (Lucid Migration)

| Step | What | Status |
|------|------|--------|
| 1 | Extract pipeline to `src/pipeline.ts` | Done |
| 2 | Install Lucid packages, remove Daydreams | Done |
| 3 | Simplify registry to pure functions | Done |
| 4 | Wire server to Lucid SDK (`createAgent`, `createAgentApp`) | Done |
| 5 | Runtime test all routes (health, entrypoints, agent card, invoke) | Done |
| 6 | Delete old Daydreams files | Done |
| 7 | Update CLAUDE.md | Done |

### What Works
- Full pipeline: query -> decompose -> execute -> synthesize -> markdown report
- Mock mode (`MOCK_MODE=true`) with canned responses
- **LLM pipeline tested end-to-end** — decomposition + synthesis working with real Anthropic API
- **Lucid SDK server** — `createAgent()` with `http()`, `payments()`, `a2a()` extensions
- **x402 payment gating** — invoke endpoints return 402 Payment Required with proper x402v2 headers
- **Auto-generated agent card** — `/.well-known/agent-card.json` with skills, schemas, pricing, payment info
- 11 live x402 endpoints registered (Silverback DeFi: 8 endpoints, Gloria AI: 3 endpoints)
- Structured cost summary after each query
- CDP Server Wallet v2 created and operational at `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A`
- Two priced entrypoints: `intelligence-report` ($0.25) and `deep-intelligence-report` ($3.00)

### Known Patch: Lucid SDK bun:sqlite
`@lucid-agents/payments` v2.4.3 has a top-level `import { Database } from 'bun:sqlite'` that crashes Node.js. We applied a `patch-package` fix that defers the import behind a `typeof Bun` check. Patch file: `patches/@lucid-agents+payments+2.4.3.patch`, auto-applied via `postinstall` script.

**Important:** The server uses `storage: { type: 'in-memory' }` for payments. The default SQLite storage only works on Bun. For production persistence, switch to `storage: { type: 'postgres' }`.

**To remove the patch:** When Lucid ships a Node-compatible build, delete `patches/` dir and the `postinstall` script.

### What's Next
- **Test live x402 payments** — Fund wallet, set `MOCK_MODE=false`, run a real query
- **Deploy to Railway** — Add `PORT` env var, push, verify agent card is publicly accessible
- **Register on xgate** — Make Parallax discoverable to other agents
- **Update `.env.example`** — Add `PORT`, `AGENT_URL`, `FACILITATOR_URL` vars
- **Prompt iteration** — Test decomposition and synthesis prompts with varied queries, tune for quality
- **Memory integration** — Wire memory into the pipeline (save query results, update endpoint reliability)
- **Error edge cases** — Test: all endpoints fail, no matching endpoints, LLM returns malformed JSON

## Build Progress

### Phase 1 — COMPLETE
Core pipeline works end-to-end in mock mode and with real Anthropic API.

### Phase 1.5 — COMPLETE (Lucid Migration)
Server migrated from plain Hono to real Lucid Agents SDK. All routes auto-generated, x402 payment gating working, agent card discoverable.

### Phase 2 — Chat UI (upcoming)
- Next.js chat interface with Vercel AI SDK (`useChat` hooks)
- Streaming report output via Lucid SSE
- User wallet connection (wagmi + ConnectKit)
- User pays USDC -> Parallax pays endpoints -> retains margin

### Phase 3 — Growth (future)
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
├── index.ts                      # CLI entry point — single query or interactive mode
├── server.ts                     # Lucid agent server (createAgent + createAgentApp)
├── pipeline.ts                   # Core pipeline: decompose → execute → synthesize
├── agent/
│   ├── types.ts                  # Zod-validated types (endpoints, sub-tasks, results, reports)
│   └── contexts/
│       └── registry.ts           # Endpoint registry — load, search by capability (pure functions)
├── endpoints/
│   ├── registry.json             # 11 live x402 endpoints (Silverback DeFi + Gloria AI)
│   └── client.ts                 # x402 HTTP client (mock mode, CDP wallet, timeouts)
├── prompts/
│   ├── decompose.ts              # Decomposition prompt template
│   └── synthesize.ts             # Synthesis prompt template
└── utils/
    └── logger.ts                 # Structured endpoint call logging
```

**Server (`src/server.ts`):** Uses Lucid SDK builder pattern:
```
createAgent() → .use(http()) → .use(payments()) → .use(a2a()) → .build()
→ createAgentApp(runtime) → addEntrypoint() → serve()
```

Auto-generated routes:
- `GET /health` — `{ ok: true, version }`
- `GET /entrypoints` — List skills with streaming info
- `GET /.well-known/agent.json` / `agent-card.json` — Full A2A agent card
- `POST /entrypoints/:key/invoke` — x402-gated invoke (returns 402 without payment)

**Core loop:** Query -> Decompose into sub-tasks -> Match to x402 endpoints -> Execute calls (sequential) -> LLM synthesizes report -> Return report + cost summary

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run server (mock mode — no USDC spent)
MOCK_MODE=true npx tsx src/server.ts

# Run CLI single query (mock mode)
MOCK_MODE=true npx tsx src/index.ts 'Should I invest in $AERO on Base?'

# Run CLI interactive mode
MOCK_MODE=true npx tsx src/index.ts

# Run with live x402 endpoints (requires funded wallet)
npx tsx src/server.ts

# TypeScript compilation check
npx tsc --noEmit

# Test server endpoints
curl http://localhost:3000/health
curl http://localhost:3000/entrypoints
curl http://localhost:3000/.well-known/agent-card.json
curl -X POST http://localhost:3000/entrypoints/intelligence-report/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"query": "Should I invest in AERO on Base?"}}'
# ^ Returns 402 Payment Required (correct — x402 payment gating)
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
- `PORT` — Server port (default: 3000)
- `AGENT_URL` — Public URL for agent card (default: `http://localhost:PORT`)
- `FACILITATOR_URL` — x402 facilitator (default: `https://facilitator.daydreams.systems`)

## Coding Standards

- TypeScript strict mode
- Zod v4 for all data validation — endpoint responses are untrusted
- All outgoing x402 calls go through the centralized client (`src/endpoints/client.ts`), never raw fetch
- Incoming x402 payments handled by Lucid `payments()` middleware automatically
- Log every endpoint call with: endpoint_id, latency_ms, cost, success/fail
- Keep synthesis prompts in separate files (`src/prompts/`) for easy iteration
- Entrypoints defined with Zod schemas for input/output — Lucid auto-generates JSON Schema for agent card

## Git Workflow

- **Do NOT include `Co-Authored-By` lines in commit messages.** No co-author attribution.
- Commit and push after each feature/module is complete so we can test modularly
- Keep commits focused on a single feature or context — one logical unit per commit
- Push to `origin` (https://github.com/0xSardius/parallax-agent.git) after each commit

## x402 Payment Pattern

**Incoming payments (Parallax as provider):** Handled automatically by Lucid `payments()` extension. Entrypoints with `price` field return 402 Payment Required. The facilitator verifies payment before the handler runs.

**Outgoing payments (Parallax calling other endpoints):** Uses `@x402/fetch` + `@x402/evm`:

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

## Lucid SDK Reference

**Packages used:**
- `@lucid-agents/core` — `createAgent()` builder pattern, agent runtime
- `@lucid-agents/http` — `http()` extension, auto-generates health/entrypoints/agent-card routes
- `@lucid-agents/payments` — `payments()` extension, x402 payment gating on entrypoints
- `@lucid-agents/a2a` — `a2a()` extension, agent-to-agent communication and discovery
- `@lucid-agents/hono` — `createAgentApp()` adapter, mounts Lucid routes on Hono
- `@lucid-agents/wallet` — wallet management (installed, not yet wired)

**Key config:**
- `payments()` config requires `payTo` (0x address), `network` (CAIP-2 format: `eip155:8453`), `facilitatorUrl`, and `storage`
- Node.js **must** use `storage: { type: 'in-memory' }` or `storage: { type: 'postgres' }` — SQLite is Bun-only
- Entrypoint `price` format: `'0.25'` (flat) or `{ invoke: '0.25', stream: '1.00' }` (separate)
- Agent card served at both `/.well-known/agent.json` and `/.well-known/agent-card.json`

## Known Issues / Tech Debt

- **Memory not wired into pipeline**: Need to add save-query-result and update-endpoint-reliability calls.
- **LLM cost estimates are hardcoded**: `$0.003` for decomposition, `$0.008` for synthesis. Should use actual token counts from AI SDK response.
- **Endpoint registry is static**: No runtime discovery. Phase 3 will add auto-discovery.
- **CLI `$` escaping**: Use single quotes for queries with `$` symbols (e.g. `'Should I invest in $AERO?'`), otherwise the shell interprets `$AERO` as a variable.
- **Lucid `bun:sqlite` patch**: `patch-package` workaround in place. Remove when Lucid ships Node-compatible build.
- **Wallet extension not wired**: `@lucid-agents/wallet` is installed but not used in server.ts. Current outgoing payments use CDP wallet via `src/endpoints/client.ts`.

## Relevant Skills

These Claude Code skills are available and useful at different phases of the build:

**Current phase:**
- `prompt-engineering-patterns` — Optimize decomposition and synthesis prompts for reliable LLM output
- `railway-docs` — Railway deployment configuration and troubleshooting
- `viem` — Low-level EVM/Base blockchain interactions (wallet ops, USDC transfers, tx signing)

**Phase 2 (chat UI):**
- `ai-sdk-core` — Vercel AI SDK backend: streaming, tool use, structured output
- `ai-sdk-ui` — `useChat`/`useCompletion` hooks for the Next.js chat interface
- `frontend-design` — Production-grade UI design for the chat interface
- `vercel-react-best-practices` — Next.js performance patterns
- `wagmi` — React hooks for wallet connection and onchain interactions in the UI
