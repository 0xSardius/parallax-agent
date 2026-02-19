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
- **ERC-8004 registration:** https://parallax-agent-production.up.railway.app/.well-known/agent-registration.json
- **Mock mode:** OFF — real x402 payments active
- **ERC-8004:** Agent #17653 on Base mainnet ([registration tx](https://basescan.org/tx/0xd3b2a333c4dcb7ffad254f4e22bf4d02d41da35b01aa98179daf236dfd9daa1f))
- **8004scan:** https://www.8004scan.io/agents/base/17653 — metadata score 57/100, waiting for re-crawl to pick up new fields
- **xgate:** `tokenUri` set on-chain ([tx](https://basescan.org/tx/0x0c3d97deec86a7668443cf46afb6756756816d63fb4dc90057b604b11f84d877)), waiting for indexer to crawl

### Live x402 Testing (2026-02-18)

Pipeline tested end-to-end with **real USDC payments**. Final run: **5/6 endpoints succeeded**.

| Provider | Endpoint | Result | Cost |
|----------|----------|--------|------|
| Neynar | Cast Search | SUCCESS | $0.001 |
| Silverback | Whale Moves | SUCCESS (retry) | $0.01 |
| Silverback | Token Audit | SUCCESS (retry) | $0.01 |
| Silverback | Technical Analysis | SUCCESS (retry) | $0.02 |
| Gloria AI | News | SUCCESS (retry) | $0.03 |
| Elsa | Search Token | FAIL (524 timeout) | $0.001 |

**Actual costs per query (live data):**
- x402 endpoints: ~$0.07 USDC
- LLM decomposition: ~$0.014 (1900in/500out tokens)
- LLM synthesis: ~$0.14-0.17 (40-48K input tokens with real endpoint data)
- **Total: ~$0.22-0.26 per query**

Note: Synthesis is the biggest cost driver. Real endpoint data (especially Neynar Farcaster casts) can be 40K+ tokens. The $0.25 charge to callers provides thin margin — consider raising price or truncating verbose endpoint responses before synthesis.

### Wallet Balances
- **CDP Wallet:** `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A` — ~$7.50 USDC + ~$2 ETH (as of 2026-02-18)
- **Self-funding model:** Incoming x402 payments go to CDP wallet, same wallet pays outgoing endpoint calls. Margin accumulates. Sweep profits periodically via CDP SDK.
- Check balance: `npx tsx src/check-balance.ts`

### What's Done (2026-02-18 session)

**Live x402 payment fixes:**
- **BigInt serialization fix** — `@x402/core`'s `encodePaymentSignatureHeader` uses raw `JSON.stringify` which crashes on BigInt values from the EVM signer. Added global `BigInt.prototype.toJSON` polyfill in `client.ts`. Remove when upstream fixes this.
- **Retry with jittered backoff** — CDP wallet signing fails when multiple payments are signed concurrently (nonce collisions). Added retry loop: on 402 after payment attempt, wait 2-4s (random jitter) and retry once. Jitter prevents retries from colliding with each other. Improved success rate from 2/6 → 5/6.
- **Cost accounting fix** — Failed 402 responses (payment rejected) no longer report `costPerCall` since USDC was never spent on-chain. Only successful responses record cost.
- **Gloria param name fix** — Server expects `feed_categories` not `categories`. Updated defaultParams to `"feed_categories": "crypto,defi,base"` for both gloria-news and gloria-recaps.

**Prompt tuning:**
- **Decomposition** — Added rule against overlapping capabilities, enforced concise param values, prefer direct-answer capabilities over tangential data.
- **Synthesis** — Decisive analyst tone ("briefing a trader"), explicit fact vs. inference labels, data gaps ranked by impact (HIGH/MEDIUM/LOW), new "What To Do Next" section with concrete action items, cross-signal validation across data sources.

**Previous session (2026-02-17):**
- Parallel endpoint execution (`Promise.allSettled`), real LLM cost tracking, defensive param merge, x402 diagnostic logging
- ERC-8004 metadata fields (agentType, tags, categories), re-set agentURI on-chain
- Zapper v1 investigation → disabled 17 endpoints
- Gloria paramHints updated, 8004scan score 27 → 57

**Earlier (2026-02-16):**
- Neynar fixes, Gloria param fix, prompt iteration, code fence stripping, ERC-8004 metadata route, logo, Zapper endpoints

### Next Session — Ready to Action

**1. Reduce synthesis cost** (high impact on margin)
- Synthesis eats ~$0.14-0.17 per query because Neynar returns 40K+ tokens of raw Farcaster casts
- Fix: truncate/summarize verbose endpoint responses before passing to synthesis prompt
- Target: cap endpoint data at ~5K tokens total → synthesis cost drops to ~$0.03-0.05
- This turns the $0.25 charge from thin margin into ~3-4x markup

**2. Elsa investigation** (medium impact)
- All 6 Elsa endpoints consistently return 524 (Cloudflare timeout) — their server is down
- 4 capabilities are unique to Elsa: `token_search`, `token_price`, `wallet_analysis`, `gas_data`
- For token-specific queries, missing price data is a real gap (synthesis notes it, confidence drops)
- Options: wait for Elsa to recover, find alternative providers on xgate, or build custom endpoints

**3. Daydreams Router integration** (15 min, medium impact)
- Install `@daydreamsai/ai-sdk-provider`, change 2 lines in `pipeline.ts`
- Benefits: unified USDC billing (no API keys), provider fallback, ecosystem visibility

**4. Chat UI (Phase 2)** (high impact)
- Next.js frontend opens Parallax to humans, not just agents
- `useChat` hooks, wallet connection, streaming output

**5. Farcaster/Telegram bot** (medium impact)
- Lower friction entry point for building initial usage and reputation

### Full Roadmap (prioritized)

**High impact:**
1. ~~Parallel endpoint execution~~ — DONE
2. ~~Prompt tuning~~ — DONE (analyst tone, fact/inference, ranked gaps, action items)
3. ~~Live x402 payments~~ — DONE (5/6 success, retry with jitter)
4. **Reduce synthesis cost** — Truncate verbose endpoint data before synthesis
5. **Chat UI (Phase 2)** — Next.js frontend
6. **Daydreams Router** — USDC-native LLM calls, no API keys

**Medium impact:**
7. **Elsa alternatives** — Find/build replacements for token_price, token_search, wallet_analysis
8. **Streaming responses** — Return partial results as they arrive
9. **Postgres payment storage** — Replace in-memory storage for persistence
10. **Memory integration** — Save query results, track endpoint reliability
11. **Farcaster/Telegram bot** — Lower friction entry point
12. **Profit sweep script** — Transfer excess USDC from CDP wallet

**Lower priority:**
13. **Re-enable Zapper** — When x402 v1 compat is resolved or Zapper upgrades to v2
14. **TEE migration** — Deploy to Phala Network for TEE badge on 8004scan
15. **IPFS-pinned metadata** — Content-addressed agentURI for trust bump
16. **Error edge cases** — Test: all endpoints fail, no matching endpoints, malformed LLM output

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

### Phase 1.6 — COMPLETE (Reliability + Discoverability)

| Step | What | Status |
|------|------|--------|
| 1 | Parallel endpoint execution | Done |
| 2 | Real LLM cost tracking (token-based) | Done |
| 3 | Defensive param merge for defaultParams | Done |
| 4 | ERC-8004 metadata: agentType, tags, categories | Done |
| 5 | Re-set agentURI on-chain for xgate indexing | Done |
| 6 | Zapper v1 investigation + disable | Done |
| 7 | x402 diagnostic logging | Done |

### Phase 1.7 — COMPLETE (Live Payments + Prompt Tuning)

| Step | What | Status |
|------|------|--------|
| 1 | BigInt serialization fix for @x402/core | Done |
| 2 | Retry with jittered backoff for CDP concurrency | Done |
| 3 | Cost accounting fix (402 = no charge) | Done |
| 4 | Gloria feed_categories param fix | Done |
| 5 | Prompt tuning: decomposition (overlap, params, focus) | Done |
| 6 | Prompt tuning: synthesis (tone, fact/inference, gaps, actions) | Done |
| 7 | Live x402 test: 5/6 success rate | Done |

### Phase 2 — Chat UI (upcoming)
- Next.js chat interface with Vercel AI SDK (`useChat` hooks)
- Streaming report output via Lucid SSE
- User wallet connection (wagmi + ConnectKit)
- User pays USDC -> Parallax pays endpoints -> retains margin

### Phase 3 — Growth (future)
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
├── pipeline.ts                   # Core pipeline: decompose → execute (parallel) → synthesize
├── check-balance.ts              # Utility: view CDP wallet balances (ETH + USDC)
├── register-8004.ts              # Utility: register/update agent on ERC-8004 IdentityRegistry
├── agent/
│   ├── types.ts                  # Zod-validated types (endpoints, sub-tasks, results, reports)
│   └── contexts/
│       └── registry.ts           # Endpoint registry — load, search by capability (pure functions)
├── endpoints/
│   ├── registry.json             # 41 x402 endpoints (24 active, 17 Zapper disabled)
│   └── client.ts                 # x402 HTTP client (mock mode, CDP wallet, retry+jitter, BigInt fix)
├── prompts/
│   ├── decompose.ts              # Decomposition prompt template (includes paramHints)
│   └── synthesize.ts             # Synthesis prompt template
└── utils/
    └── logger.ts                 # Structured endpoint call logging
```

**Server (`src/server.ts`):** Uses Lucid SDK builder pattern:
```
createAgent() → .use(http()) → .use(payments()) → .use(a2a()) → .build()
→ createAgentApp(runtime) → addEntrypoint() → serve()
```

Routes:
- `GET /health` — `{ ok: true, version }`
- `GET /entrypoints` — List skills with streaming info
- `GET /.well-known/agent.json` / `agent-card.json` — Full A2A agent card (auto-generated by Lucid)
- `GET /.well-known/agent-registration.json` — ERC-8004 registration metadata (agentType, tags, categories, services)
- `GET /logo.png` — Agent logo (512x512 PNG)
- `POST /entrypoints/:key/invoke` — x402-gated invoke (returns 402 without payment)

**Core loop:** Query → Decompose into sub-tasks → Match to x402 endpoints → Execute calls (parallel via Promise.allSettled) → LLM synthesizes report → Return report + cost summary

**Payment flow:**
```
Caller pays $0.25 USDC → CDP wallet → spends ~$0.22-0.26 on x402 + LLM → thin margin
```
**Margin warning:** At current synthesis costs (~$0.15-0.17 with verbose endpoint data), the $0.25 price barely covers costs. Priority fix: truncate endpoint data before synthesis to reduce LLM input tokens.

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

# Update ERC-8004 agentURI on-chain
npx tsx src/register-8004.ts update-uri

# Deploy to Railway
railway up --detach

# Set Railway env vars
railway variables set KEY="value"

# View Railway logs
railway service logs
```

### Test production endpoints
```bash
curl https://parallax-agent-production.up.railway.app/health
curl https://parallax-agent-production.up.railway.app/entrypoints
curl https://parallax-agent-production.up.railway.app/.well-known/agent-card.json
curl https://parallax-agent-production.up.railway.app/.well-known/agent-registration.json

# Invoke (returns 402 — correct, x402 payment required)
curl -X POST https://parallax-agent-production.up.railway.app/entrypoints/intelligence-report/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"query": "Should I invest in AERO on Base?"}}'
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

**Note:** This only works with x402 v2 endpoints. Zapper uses v1 and is currently incompatible — see Known Issues.

## Error Handling

- Endpoint returns non-200 (excluding 402 payment flow): log, skip, note gap in report
- Endpoint timeout (>10s standard, >90s expensive): skip with timeout note
- Decomposition returns capabilities with no matching endpoint: note "data unavailable" in report
- Never let a single endpoint failure kill the entire workflow — always produce a partial report
- Empty/null LLM params are stripped before merging with `defaultParams` (defensive merge in `client.ts`)

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
- **Agent ID**: 17653
- **Registration tx**: [0xd3b2a3...](https://basescan.org/tx/0xd3b2a333c4dcb7ffad254f4e22bf4d02d41da35b01aa98179daf236dfd9daa1f)
- **Agent URI**: `https://parallax-agent-production.up.railway.app/.well-known/agent-registration.json`
- **Latest URI update tx**: [0x0c3d97...](https://basescan.org/tx/0x0c3d97deec86a7668443cf46afb6756756816d63fb4dc90057b604b11f84d877)
- **8004scan**: https://www.8004scan.io/agents/base/17653 — score 57/100
- **Agent wallet**: `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A` (auto-set to msg.sender on register)
- **Register new agent**: `npx tsx src/register-8004.ts`
- **Update URI**: `npx tsx src/register-8004.ts update-uri`
- **Registration metadata includes**: agentType ("orchestrator"), tags, categories, services (A2A, web, agentWallet), x402Support, image

## Live x402 Endpoints

### Active (24 endpoints across 6 providers)

**Silverback DeFi** (`x402.silverbackdefi.app`) — 8 endpoints:
- top-coins ($0.001), trending-tokens ($0.001), top-pools ($0.001), dex-metrics ($0.002)
- whale-moves ($0.01), token-audit ($0.01), technical-analysis ($0.02), defi-yield ($0.02)

**Elsa x402** (`x402-api.heyelsa.ai`) — 6 endpoints:
- search-token ($0.001), token-price ($0.002), gas-prices ($0.001)
- portfolio ($0.01), analyze-wallet ($0.02), yield-suggestions ($0.02)

**Neynar** (`api.neynar.com`) — 4 endpoints, $0.001 each:
- cast-search, user-search, channel-search, feed (requires FID)

**Gloria AI** (`api.itsgloria.ai`) — 3 endpoints:
- news ($0.03), recaps ($0.10, premium), news-ticker-summary ($0.031)

**Einstein AI** (`emc2ai.io`) — 2 endpoints (premium, expensive):
- latest-pairs ($0.25), smart-money-leaderboard ($0.85)

**Firecrawl** (`api.firecrawl.dev`) — 1 endpoint (premium):
- search ($0.01)

### Disabled (17 Zapper endpoints — x402 v1 incompatible)

All `public.zapper.xyz/x402/*` endpoints are set to `tier: "disabled"` in `registry.json`. They use x402 v1 protocol which our v2 client library can't complete payments for. Full diagnostic in commit `a9ba1ed`. Re-enable by changing tier back to `"standard"` when v1 compat is resolved.

Capabilities temporarily lost: NFT data, historical token prices, ENS/Farcaster identity resolution, human-readable transaction interpretation. Core DeFi intelligence capabilities remain fully covered.

### Capability Gaps to Explore

These are genuinely missing capabilities with no x402 provider available yet. Watch for new endpoints on xgate or build custom integrations.

| Gap | Impact | Notes |
|-----|--------|-------|
| **Twitter/X sentiment** | High | Crypto Twitter is where most alpha/FUD originates. Only have Farcaster via Neynar. No x402 provider exists yet. |
| **Protocol revenue/TVL tracking** | Medium | DefiLlama-style data. Silverback has DEX metrics but not protocol-level revenue, fees, or TVL history. |
| **On-chain governance** | Medium | DAO proposals, votes, quorum status. Relevant for protocol health assessment. |
| **Token holder distribution** | Medium | Holder counts, concentration metrics, Gini coefficient. Zapper had partial coverage. |
| **Historical price data** | Low-Medium | Can't answer "how has X performed over 30 days?" Zapper had this. |
| **NFT data** | Low | Collection stats, floor prices, holder analysis. Zapper had this. Not critical for DeFi intelligence. |

## LLM Cost Tracking

Pipeline uses real token counts from `generateText().usage` to calculate costs:
- **Sonnet 4.5 pricing**: $3.00/MTok input, $15.00/MTok output, $0.30/MTok cached input
- **Decomposition**: ~1900 input / ~500 output tokens → ~$0.013
- **Synthesis (mock data)**: ~600 input / ~900 output → ~$0.015
- **Synthesis (live data)**: ~40,000-48,000 input / ~1,500 output → ~$0.14-0.17
- **Total per query (mock)**: ~$0.03
- **Total per query (live)**: ~$0.22-0.26 (x402 ~$0.07 + LLM ~$0.19)

**Why synthesis is expensive live:** Real endpoint data is verbose. Neynar returns full Farcaster cast objects (author, text, reactions, timestamps) — a single query can produce 40K+ tokens of raw data. This is the #1 cost optimization target: truncating endpoint responses before synthesis could cut LLM cost 3-5x.

Helper function `calculateLlmCost()` in `pipeline.ts` handles the math. Token counts logged per step.

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

- **Elsa x402 server down**: All 6 Elsa endpoints return 524 (Cloudflare timeout). 4 capabilities are unique to Elsa (`token_search`, `token_price`, `wallet_analysis`, `gas_data`) with no alternative provider. Reports still work but miss price data for token-specific queries. Monitor for recovery.
- **BigInt.prototype.toJSON polyfill**: Global monkey-patch in `client.ts` to fix `@x402/core`'s `encodePaymentSignatureHeader`. Remove when upstream fixes this (they already have a `toJsonSafe` helper that handles it, just not in the standalone function).
- **CDP wallet concurrency limit**: Parallel x402 payment signing causes nonce collisions. Mitigated with retry + jitter (2-4s random delay), but still adds latency. Root fix would be a signing queue or upstream CDP SDK fix.
- **Synthesis cost is high with live data**: Real endpoint responses (especially Neynar) can be 40K+ tokens. Synthesis costs ~$0.14-0.17 per query. Need to truncate/summarize endpoint data before passing to synthesis prompt.
- **Zapper x402 v1 incompatible**: 17 endpoints disabled. Set to `tier: "disabled"`. Re-enable when v1 compat resolved.
- **Memory not wired into pipeline**: Need to add save-query-result and update-endpoint-reliability calls.
- **Endpoint registry is static**: No runtime discovery. Phase 3 will add auto-discovery.
- **Firecrawl returning 401**: Their x402 endpoint may be temporarily broken. Keep in registry, will self-heal when they fix it.
- **Payment storage is in-memory**: Payment tracking resets on server restart. Switch to Postgres for persistence when needed.
- **8004scan score 57/100**: Remaining gaps are usage-based (quality, wallet, popularity). Need real agent-to-agent transactions and feedback to improve.
- **xgate indexing pending**: `tokenUri` set on-chain and verified, but xgate hasn't re-crawled yet. Should resolve automatically.
- **CLI `$` escaping**: Use single quotes for queries with `$` symbols (e.g. `'Should I invest in $AERO?'`), otherwise the shell interprets `$AERO` as a variable.

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
