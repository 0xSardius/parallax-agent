# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Parallax** is a live x402 orchestration agent built on the Lucid Agents SDK. It chains multiple x402-paid endpoints into compound intelligence workflows — accepting complex queries, decomposing them into sub-tasks, calling multiple x402 endpoints (paying USDC micropayments on Base), and synthesizing results into premium actionable reports.

Parallax is both a **consumer** (pays other x402 endpoints for data) and a **provider** (charges callers USDC via x402 to run reports). Other agents discover it via the A2A agent card or ERC-8004 on-chain registry.

**Stack:** TypeScript (strict mode), Lucid Agents SDK, Vercel AI SDK, Hono, x402 protocol, USDC on Base, CDP Server Wallet v2
**Deployment:** Railway (https://parallax-agent-production.up.railway.app)
**Status:** LIVE — Phase 1.5 complete, deployed to Railway, registered on ERC-8004, real x402 payments active

## RESUME HERE — Current Status

**When starting a new session, give the user a rundown of this section before proceeding.**

### Parallax is LIVE

- **Production URL:** https://parallax-agent-production.up.railway.app
- **Railway dashboard:** https://railway.com/project/e90648fd-3915-492d-9fdf-5f15324905be
- **Agent card:** https://parallax-agent-production.up.railway.app/.well-known/agent-card.json
- **Mock mode:** OFF — real x402 payments active
- **ERC-8004:** Registered on Base mainnet ([tx](https://basescan.org/tx/0xd3b2a333c4dcb7ffad254f4e22bf4d02d41da35b01aa98179daf236dfd9daa1f))
- **xgate:** Indexed automatically from ERC-8004 registry + agent card crawling

### Live-tested (2025-02-15)
- Ran real query "What are the top trending tokens on Base right now?" with `MOCK_MODE=false`
- 3/4 x402 endpoints succeeded (Silverback trending, top-coins, dex-metrics), 1 failed (Neynar param format issue)
- Total cost: $0.016 (x402: $0.005, LLM: $0.011)
- Full report generated with confidence scoring, data gaps, and risk analysis

### Wallet Balances
- **CDP Wallet:** `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A` — ~$7.98 USDC + ~$2 ETH (for gas)
- **Self-funding model:** Incoming x402 payments go to CDP wallet, same wallet pays outgoing endpoint calls. Margin accumulates. Sweep profits periodically via CDP SDK.
- Check balance: `npx tsx src/check-balance.ts`

### What's Next
- **Fix Neynar endpoint** — Needs `q` query param instead of body JSON. Update `client.ts` or registry `defaultParams`
- **Prompt iteration** — Test decomposition and synthesis prompts with varied queries, tune for quality
- **Memory integration** — Wire memory into the pipeline (save query results, update endpoint reliability)
- **Error edge cases** — Test: all endpoints fail, no matching endpoints, LLM returns malformed JSON
- **Profit sweep script** — Write a script to transfer excess USDC from CDP wallet to personal wallet
- **Phase 2: Chat UI** — Next.js frontend with wallet connection and streaming reports

## Build Progress

### Phase 1 — COMPLETE
Core pipeline works end-to-end in mock mode and with real Anthropic API.

### Phase 1.5 — COMPLETE (Lucid Migration + Deploy)

| Step | What | Status |
|------|------|--------|
| 1 | Extract pipeline to `src/pipeline.ts` | Done |
| 2 | Install Lucid packages, remove Daydreams | Done |
| 3 | Simplify registry to pure functions | Done |
| 4 | Wire server to Lucid SDK (`createAgent`, `createAgentApp`) | Done |
| 5 | Runtime test all routes (health, entrypoints, agent card, invoke) | Done |
| 6 | Delete old Daydreams files | Done |
| 7 | Deploy to Railway | Done |
| 8 | Register on ERC-8004 (Base mainnet) | Done |
| 9 | Test live x402 payments (real USDC) | Done |
| 10 | Go live (`MOCK_MODE=false` on Railway) | Done |

### Phase 2 — Chat UI (upcoming)
- Next.js chat interface with Vercel AI SDK (`useChat` hooks)
- Streaming report output via Lucid SSE
- User wallet connection (wagmi + ConnectKit)
- User pays USDC -> Parallax pays endpoints -> retains margin

### Phase 3 — Growth (future)
- Parallel endpoint execution
- Endpoint auto-discovery via xgate Bazaar API
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
├── check-balance.ts              # Utility: view CDP wallet balances (ETH + USDC)
├── register-8004.ts              # Utility: register agent on ERC-8004 IdentityRegistry
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

**Payment flow:**
```
Caller pays $0.25 USDC → CDP wallet → spends ~$0.005-0.05 on x402 endpoints → margin stays in wallet
```

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run server locally (mock mode)
MOCK_MODE=true npx tsx src/server.ts

# Run server locally (live x402 — spends real USDC)
npx tsx src/server.ts

# Run CLI single query
MOCK_MODE=true npx tsx src/index.ts 'Should I invest in $AERO on Base?'

# Run CLI interactive mode
MOCK_MODE=true npx tsx src/index.ts

# TypeScript compilation check
npx tsc --noEmit

# Check CDP wallet balance
npx tsx src/check-balance.ts

# Register on ERC-8004 (already done — only run if re-registering)
npx tsx src/register-8004.ts

# Deploy to Railway
railway up --detach

# Set Railway env vars
railway variables set KEY="value"

# Check Railway deployment status
railway service status

# View Railway logs
railway service logs
```

### Test production endpoints
```bash
curl https://parallax-agent-production.up.railway.app/health
curl https://parallax-agent-production.up.railway.app/entrypoints
curl https://parallax-agent-production.up.railway.app/.well-known/agent-card.json

# Invoke (returns 402 — correct, x402 payment required)
curl -X POST https://parallax-agent-production.up.railway.app/entrypoints/intelligence-report/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"query": "Should I invest in AERO on Base?"}}'

# Check xgate indexing status
curl -s "https://api.xgate.run/agents?wallet=0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A" | python -m json.tool
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

All env vars are set on Railway. To update: `railway variables set KEY="value"`

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
- **Tokens**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) + ETH (for gas)
- **Wallet name**: `parallax-agent` (idempotent via `getOrCreateAccount`)
- **Role**: Receives incoming x402 payments AND pays outgoing x402 endpoint calls (self-funding)
- Created via CDP Server Wallet v2 — keys secured in AWS Nitro Enclave TEE
- Check balance: `npx tsx src/check-balance.ts`

## ERC-8004 On-Chain Identity

- **Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Base mainnet)
- **Registration tx**: [0xd3b2a3...](https://basescan.org/tx/0xd3b2a333c4dcb7ffad254f4e22bf4d02d41da35b01aa98179daf236dfd9daa1f)
- **Agent URI**: `https://parallax-agent-production.up.railway.app/.well-known/agent-card.json`
- **Agent wallet**: `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A` (auto-set to msg.sender on register)
- **Re-register**: `npx tsx src/register-8004.ts` (mints new agent NFT — only if needed)

## Live x402 Endpoints

Registry with verified live endpoints (all return 402 Payment Required):

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

## Known Patch: Lucid SDK bun:sqlite

`@lucid-agents/payments` v2.4.3 has a top-level `import { Database } from 'bun:sqlite'` that crashes Node.js. We applied a `patch-package` fix that defers the import behind a `typeof Bun` check. Patch file: `patches/@lucid-agents+payments+2.4.3.patch`, auto-applied via `postinstall` script.

**Important:** The server uses `storage: { type: 'in-memory' }` for payments. For production persistence, switch to `storage: { type: 'postgres' }`.

**To remove the patch:** When Lucid ships a Node-compatible build, delete `patches/` dir and the `postinstall` script.

## Known Issues / Tech Debt

- **Neynar endpoint param format**: Neynar Cast Search expects `q` as a query param, not in the request body. Returned HTTP 400 during live test. Fix in `client.ts` or update `defaultParams` in registry.
- **Memory not wired into pipeline**: Need to add save-query-result and update-endpoint-reliability calls.
- **LLM cost estimates are hardcoded**: `$0.003` for decomposition, `$0.008` for synthesis. Should use actual token counts from AI SDK response.
- **Endpoint registry is static**: No runtime discovery. Phase 3 will add auto-discovery.
- **CLI `$` escaping**: Use single quotes for queries with `$` symbols (e.g. `'Should I invest in $AERO?'`), otherwise the shell interprets `$AERO` as a variable.
- **Wallet extension not wired**: `@lucid-agents/wallet` is installed but not used in server.ts. Current outgoing payments use CDP wallet via `src/endpoints/client.ts`.
- **Payment storage is in-memory**: Payment tracking resets on server restart. Switch to Postgres for persistence when needed.

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
