# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Parallax** is a live x402 orchestration agent built on the Lucid Agents SDK. It chains multiple x402-paid endpoints into compound intelligence workflows — accepting complex queries, decomposing them into sub-tasks, calling multiple x402 endpoints (paying USDC micropayments on Base), and synthesizing results into premium actionable reports.

Parallax is both a **consumer** (pays other x402 endpoints for data) and a **provider** (charges callers USDC via x402 to run reports). Other agents discover it via the A2A agent card or ERC-8004 on-chain registry.

**Stack:** TypeScript (strict mode), Lucid Agents SDK, Vercel AI SDK, Hono, x402 protocol, USDC on Base, CDP Server Wallet v2
**Deployment:** Railway (https://parallax-agent-production.up.railway.app)
**Status:** LIVE — Phase 1.9, deployed to Railway, registered on ERC-8004, 54 active x402 endpoints across 10 providers

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

### Live x402 Testing

**Latest test (2026-02-19, post-optimization):** 6/6 endpoints succeeded including Neynar (restored). Synthesis cost cut 6x via data truncation.
- **Endpoints:** CoinGecko, CryptoRugMunch, Otto AI, Neynar, Silverback x2
- **Data truncation:** 85,230 → 5,327 chars (94% reduction)
- **Synthesis:** 2,662 input tokens → $0.028 (was ~48K tokens → $0.17)
- **Total cost:** $0.124 (was $0.23) — **~50% margin on $0.25 charge**

**Production end-to-end (2026-02-19):** Full production invoke via x402 payment — caller pays $0.25 USDC, server runs pipeline, returns report.
- **Status:** 200 OK in 68s
- **On-chain tx:** [`0x3ef4b655...`](https://basescan.org/tx/0x3ef4b655aeb8d33e2a9963d54e6c5abcab6c6bc63359a11580c2d4edaf9ea762)
- **Facilitator:** PayAI (`facilitator.payai.network`) — switched after Daydreams facilitator broke (see Known Issues)

**Local tests (2026-02-18, Phase 1.8):** 3 new providers tested — CoinGecko, Otto AI, CryptoRugMunch. All 3 working.

| Test | Query | Endpoints | Success | x402 Cost | Total Cost |
|------|-------|-----------|---------|-----------|------------|
| 1 | AERO safety + rug + Twitter | CoinGecko, RugMunch, Otto, Silverback, Neynar | 5/5 | $0.071 | $0.231 |
| 2 | Contract address rug check | RugMunch, Otto, Silverback x2 | 4/4 | $0.052 | $0.114 |
| 3 | DeFi yield + funding + macro | Silverback, Otto x3 | 3/4 | $0.040 | $0.085 |

**Actual costs per query (live data, post-optimization):**
- x402 endpoints: ~$0.04-0.08 USDC (varies by query)
- LLM decomposition: ~$0.015 (2300in/500out tokens)
- LLM synthesis: ~$0.03 (2500-3000in/1300out tokens — truncation caps input)
- **Total: ~$0.08-0.13 per query** — healthy margin on $0.25 charge

### Wallet Balances
- **CDP Wallet:** `0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A` — ~$7.10 USDC + ETH (as of 2026-02-19, after ~10 live tests)
- **Self-funding model:** Incoming x402 payments go to CDP wallet, same wallet pays outgoing endpoint calls. Margin accumulates. Sweep profits periodically via CDP SDK.
- Check balance: `npx tsx src/check-balance.ts`

### What's Done (2026-02-19 session #2)

**Synthesis cost optimization:**
- **Data truncation before synthesis** — `trimArrays()` trims arrays to 3 items (depth 2), compact JSON (no indentation), dynamic per-endpoint budget (16K chars total), hard cap with truncation marker.
- **Result:** 85K chars → 5.3K chars (94% reduction). Synthesis input dropped from ~48K tokens to ~2.7K tokens. Synthesis cost: $0.17 → $0.028 (6x reduction).
- **Margin improvement:** Total query cost $0.23 → $0.12. Margin on $0.25 charge: 8% → 50%.

**Neynar x402 v1 fix:**
- **Root cause:** `@x402/evm` 2.3.0 produced a v1 payment payload that Neynar rejected (Zod validation: signature type mismatch + missing transaction field).
- **Fix:** Updated `@x402/evm` to 2.3.1 — patch fixes `ExactEvmSchemeV1` payload format.
- **Result:** Neynar cast-search now succeeds. 6/6 endpoints working (was 5/6).
- **Note:** This was the same class of v1 incompatibility as Zapper, but the 2.3.1 patch resolved it for Neynar. Zapper may also work now — worth testing.

**Zapper re-enabled (17 endpoints):**
- Tested token-ranking and search with POST — both return real data (trending tokens, AERO token search).
- Root cause of original failure: `@x402/evm` 2.3.0 v1 payload format was incompatible. 2.3.1 fixed it.
- All 17 Zapper endpoints already had `method: "POST"` set correctly — just needed tier changed from `"disabled"` to `"standard"`.
- **New capabilities restored:** NFT data, historical token prices, wallet identity (ENS/Farcaster/Lens), transaction interpretation, DeFi balances, swap feeds.
- **Total active endpoints: 54 across 10 providers.**

**Bazaar search for Farcaster alternatives:**
- Searched x402 bazaar for Farcaster/social data providers — no new v2 alternatives found beyond Neynar and Zapper.

### What's Done (2026-02-18/19 session #1)

**Facilitator migration (2026-02-19):**
- **Daydreams facilitator broke** — `facilitator.daydreams.systems` started requiring Bearer token auth, breaking all incoming payment verification with 401 Unauthorized.
- **Tried Coinbase CDP facilitator** (`api.cdp.coinbase.com/platform/v2/x402`) — also requires auth that Lucid payments middleware doesn't pass.
- **Tried x402.rs facilitator** (`facilitator.x402.rs`) — server started fine but crashed on first request: "fetch failed" + "Facilitator does not support scheme exact on network eip155:8453".
- **Switched to PayAI facilitator** (`facilitator.payai.network`) — works immediately, public, no auth, supports Base mainnet with exact scheme. Full production test succeeded with on-chain payment.
- **Lesson:** Facilitator is a critical dependency. Consider adding facilitator health check on startup or fallback logic.

**New endpoint providers (Phase 1.8):**
- **CoinGecko x402** (3 endpoints) — simple-price, trending-pools, search-pools. All $0.01/call. Fills the token_price and token_search gaps left by Elsa being down.
- **Otto AI** (6 endpoints) — twitter-summary, token-details, funding-rates, token-security, tradfi-data ($0.01 each), kol-sentiment ($0.05 premium). Fills the **Twitter/X sentiment gap** and adds new capabilities: funding rates, TradFi macro data, KOL sentiment.
- **CryptoRugMunch** (4 endpoints) — check-risk ($0.04), token-intel ($0.06), market-risk ($0.02), scammer-check ($0.005). Adds completely new **rug detection** and **scammer detection** capabilities.
- **Path parameter substitution** — Added `{param}` template support in `client.ts` for endpoints like CoinGecko (`{network}`) and CryptoRugMunch (`{token_address}`).
- **6 new capability types** — twitter_sentiment, funding_rates, tradfi_data, kol_sentiment, rug_detection, scammer_detection.

**Live x402 payment fixes (Phase 1.7):**
- **BigInt serialization fix** — Global `BigInt.prototype.toJSON` polyfill in `client.ts` for `@x402/core` bug.
- **Retry with jittered backoff** — 2-4s random delay on 402 after payment. Improved success rate from 2/6 → 5/6.
- **Cost accounting fix** — Failed 402 responses report $0 cost.
- **Gloria param name fix** — `feed_categories` not `categories`.

**Prompt tuning:**
- **Decomposition** — Overlap avoidance, concise param values, prefer direct-answer capabilities.
- **Synthesis** — Analyst tone, fact/inference labels, ranked data gaps, "What To Do Next" section.

**Previous session (2026-02-17):**
- Parallel endpoint execution (`Promise.allSettled`), real LLM cost tracking, defensive param merge, x402 diagnostic logging
- ERC-8004 metadata fields (agentType, tags, categories), re-set agentURI on-chain
- Zapper v1 investigation → disabled 17 endpoints
- Gloria paramHints updated, 8004scan score 27 → 57

**Earlier (2026-02-16):**
- Neynar fixes, Gloria param fix, prompt iteration, code fence stripping, ERC-8004 metadata route, logo, Zapper endpoints

### Next Session — Ready to Action

**1. Chat UI (Phase 2)** (high impact)
- Next.js frontend opens Parallax to humans, not just agents
- `useChat` hooks, wallet connection, streaming output

**2. Farcaster/Telegram bot** (medium impact)
- Lower friction entry point for building initial usage and reputation

**3. Facilitator resilience** (low priority)
- Add facilitator health check on startup or fallback to a secondary facilitator
- Known working facilitators: PayAI (current), x402.org (testnet only), CDP (needs auth)

### Full Roadmap (prioritized)

**High impact:**
1. ~~Parallel endpoint execution~~ — DONE
2. ~~Prompt tuning~~ — DONE (analyst tone, fact/inference, ranked gaps, action items)
3. ~~Live x402 payments~~ — DONE (5/6 success, retry with jitter)
4. ~~Expand endpoint coverage~~ — DONE (CoinGecko, Otto AI, CryptoRugMunch — 13 new endpoints)
5. ~~Deploy to production~~ — DONE (Phase 1.8 deployed, facilitator migrated to PayAI, production test passed)
6. ~~Reduce synthesis cost~~ — DONE (truncation: 94% data reduction, synthesis cost $0.17 → $0.03, margin 8% → 50%)
7. ~~Neynar v1 fix~~ — DONE (`@x402/evm` 2.3.1 fixes v1 payload format, 6/6 endpoints working)
8. **Chat UI (Phase 2)** — Next.js frontend

**Medium impact:**
8. ~~Elsa alternatives~~ — MOSTLY DONE (token_price + token_search covered by CoinGecko/Otto; wallet_analysis + gas_data still missing)
9. **Streaming responses** — Return partial results as they arrive
10. **Postgres payment storage** — Replace in-memory storage for persistence
11. **Memory integration** — Save query results, track endpoint reliability
12. **Farcaster/Telegram bot** — Lower friction entry point
13. **Profit sweep script** — Transfer excess USDC from CDP wallet

**Lower priority:**
14. **Daydreams Router** — USDC-native LLM calls, no API keys
15. ~~Re-enable Zapper~~ — DONE (`@x402/evm` 2.3.1 fixed v1 compat, 17 endpoints re-enabled)
16. **TEE migration** — Deploy to Phala Network for TEE badge on 8004scan
17. **IPFS-pinned metadata** — Content-addressed agentURI for trust bump
18. **Error edge cases** — Test: all endpoints fail, no matching endpoints, malformed LLM output

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

### Phase 1.8 — COMPLETE (Endpoint Expansion)

| Step | What | Status |
|------|------|--------|
| 1 | Add URL path parameter substitution to client.ts | Done |
| 2 | Add CoinGecko x402 endpoints (3: simple-price, trending-pools, search-pools) | Done |
| 3 | Add Otto AI endpoints (6: twitter-summary, token-details, funding-rates, token-security, tradfi-data, kol-sentiment) | Done |
| 4 | Add CryptoRugMunch endpoints (4: check-risk, token-intel, market-risk, scammer-check) | Done |
| 5 | Add mock responses for 6 new capability types | Done |
| 6 | Live test all 3 providers (3 queries, 12/13 calls succeeded) | Done |

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
│   ├── registry.json             # 54 x402 endpoints (37 active, 17 Zapper disabled)
│   └── client.ts                 # x402 HTTP client (mock mode, CDP wallet, retry+jitter, BigInt fix, path params)
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
Caller pays $0.25 USDC → CDP wallet → spends ~$0.08-0.26 on x402 + LLM → variable margin
```
**Margin note:** Cost varies significantly by query type. Simple queries (no Neynar) cost ~$0.08-0.12, giving healthy 2-3x margin. Neynar-heavy queries cost ~$0.22-0.26 (thin margin). Priority fix: truncate verbose endpoint data before synthesis.

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
- `FACILITATOR_URL` — x402 facilitator for incoming payment verification (default: `https://facilitator.payai.network`)

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

**Note:** Works with both x402 v2 and v1 endpoints as of `@x402/evm` 2.3.1 (fixed v1 `ExactEvmSchemeV1` payload format). Neynar (v1) now works. Zapper (v1) untested but may work — see Known Issues.

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

### Active (37 endpoints across 9 providers)

**Silverback DeFi** (`x402.silverbackdefi.app`) — 8 endpoints:
- top-coins ($0.001), trending-tokens ($0.001), top-pools ($0.001), dex-metrics ($0.002)
- whale-moves ($0.01), token-audit ($0.01), technical-analysis ($0.02), defi-yield ($0.02)

**CoinGecko x402** (`pro-api.coingecko.com`) — 3 endpoints, $0.01 each:
- simple-price (by symbol), trending-pools (by network, uses path params), search-pools (by query)
- Fills token_price and token_search gaps left by Elsa being down

**Otto AI** (`x402.ottoai.services`) — 6 endpoints:
- twitter-summary ($0.01), token-details ($0.01), funding-rates ($0.01), token-security ($0.01), tradfi-data ($0.01)
- kol-sentiment ($0.05, premium) — Top 50 KOL analysis
- New capabilities: twitter_sentiment, funding_rates, tradfi_data, kol_sentiment

**CryptoRugMunch** (`cryptorugmunch.app`) — 4 endpoints:
- check-risk ($0.04, POST), token-intel ($0.06, path params), market-risk ($0.02), scammer-check ($0.005, path params)
- New capabilities: rug_detection, scammer_detection

**Neynar** (`api.neynar.com`) — 4 endpoints, $0.001 each:
- cast-search, user-search, channel-search, feed (requires FID)

**Gloria AI** (`api.itsgloria.ai`) — 3 endpoints:
- news ($0.03), recaps ($0.10, premium), news-ticker-summary ($0.031)

**Elsa x402** (`x402-api.heyelsa.ai`) — 6 endpoints (currently DOWN — 524 timeout):
- search-token ($0.001), token-price ($0.002), gas-prices ($0.001)
- portfolio ($0.01), analyze-wallet ($0.02), yield-suggestions ($0.02)
- Most unique capabilities now covered by CoinGecko/Otto; wallet_analysis and gas_data still exclusive

**Einstein AI** (`emc2ai.io`) — 2 endpoints (premium, expensive):
- latest-pairs ($0.25), smart-money-leaderboard ($0.85)

**Firecrawl** (`api.firecrawl.dev`) — 1 endpoint (premium):
- search ($0.01)

### Zapper (17 endpoints — RE-ENABLED)

All `public.zapper.xyz/x402/*` endpoints re-enabled as of 2026-02-19 after `@x402/evm` 2.3.1 fixed v1 payment compat. All use POST method. Tested: token-ranking, search — both return real data.

**Zapper** (`public.zapper.xyz`) — 17 endpoints, $0.001-0.005 each:
- token-price, token-holders, token-ranking, token-activity-feed, token-balances
- search, portfolio-totals, defi-balances, general-swap-feed
- transaction-history, transaction-details, account-identity
- historical-token-price, nft-balances, nft-ranking, nft-collection-metadata, nft-token-metadata

### Capability Gaps to Explore

Remaining gaps after Phase 1.8 expansion. Several previously-missing capabilities are now covered.

| Gap | Impact | Notes |
|-----|--------|-------|
| ~~**Twitter/X sentiment**~~ | ~~High~~ | **FILLED** — Otto AI twitter-summary + kol-sentiment |
| ~~**Token price by symbol**~~ | ~~High~~ | **FILLED** — CoinGecko simple-price + Otto token-details (Elsa replacement) |
| ~~**Rug detection**~~ | ~~High~~ | **FILLED** — CryptoRugMunch check-risk, token-intel, market-risk, scammer-check |
| ~~**Funding rates**~~ | ~~Medium~~ | **FILLED** — Otto AI funding-rates (cross-exchange perps data) |
| ~~**TradFi macro**~~ | ~~Medium~~ | **FILLED** — Otto AI tradfi-data (S&P, VIX, DXY, yields) |
| ~~**Wallet analysis**~~ | ~~Medium~~ | **FILLED** — Zapper portfolio-totals, token-balances, defi-balances, transaction-history re-enabled |
| **Gas prices** | Low-Medium | Current gas across networks. Elsa had this but is down. Not critical for intelligence queries. |
| **Protocol revenue/TVL tracking** | Medium | DefiLlama-style data. Otto defi-analytics provides some coverage. |
| **On-chain governance** | Medium | DAO proposals, votes, quorum status. No x402 provider exists yet. |
| ~~**Historical price data**~~ | ~~Low-Medium~~ | **FILLED** — Zapper historical-token-price re-enabled |
| ~~**NFT data**~~ | ~~Low~~ | **FILLED** — Zapper nft-balances, nft-ranking, nft-collection-metadata, nft-token-metadata re-enabled |

## LLM Cost Tracking

Pipeline uses real token counts from `generateText().usage` to calculate costs:
- **Sonnet 4.5 pricing**: $3.00/MTok input, $15.00/MTok output, $0.30/MTok cached input
- **Decomposition**: ~2300 input / ~500 output tokens → ~$0.015
- **Synthesis (mock data)**: ~700 input / ~1200 output → ~$0.021
- **Synthesis (live data, post-truncation)**: ~2,500-3,000 input / ~1,300 output → ~$0.028
- **Total per query (mock)**: ~$0.035
- **Total per query (live)**: ~$0.08-0.13 (consistent thanks to truncation)

**Data truncation (2026-02-19):** `truncateEndpointData()` in `synthesize.ts` trims arrays to 3 items (depth 2), uses compact JSON (no indentation), allocates a 16K char total budget split evenly across endpoints, and hard-caps with a truncation marker. Raw endpoint data (85K+ chars with Neynar) gets reduced to ~5K chars (94% cut). This dropped synthesis cost from $0.17 to $0.028 — a 6x improvement. Pipeline logs before/after stats: `Data truncation: 85,230 → 5,327 chars (94% reduction, ~1332 tokens)`.

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
- `payments()` config requires `payTo` (0x address), `network` (CAIP-2 format: `eip155:8453`), `facilitatorUrl` (currently `https://facilitator.payai.network`), and `storage`
- Node.js **must** use `storage: { type: 'in-memory' }` or `storage: { type: 'postgres' }` — SQLite is Bun-only
- Entrypoint `price` format: `'0.25'` (flat) or `{ invoke: '0.25', stream: '1.00' }` (separate)
- Agent card served at both `/.well-known/agent.json` and `/.well-known/agent-card.json`

## Known Patch: Lucid SDK bun:sqlite

`@lucid-agents/payments` v2.4.3 has a top-level `import { Database } from 'bun:sqlite'` that crashes Node.js. We applied a `patch-package` fix that defers the import behind a `typeof Bun` check. Patch file: `patches/@lucid-agents+payments+2.4.3.patch`, auto-applied via `postinstall` script.

**Important:** The server uses `storage: { type: 'in-memory' }` for payments. For production persistence, switch to `storage: { type: 'postgres' }`.

**To remove the patch:** When Lucid ships a Node-compatible build, delete `patches/` dir and the `postinstall` script.

## Known Issues / Tech Debt

- **Facilitator dependency**: Incoming x402 payment verification depends on a third-party facilitator. The Daydreams facilitator (`facilitator.daydreams.systems`) broke on 2026-02-19 by adding Bearer token auth without notice. Coinbase CDP facilitator also requires auth. x402.rs was unreachable. **Currently using PayAI** (`facilitator.payai.network`) — public, no auth, supports Base. If PayAI goes down, incoming payments will fail. Consider adding fallback logic.
- **Elsa x402 server down**: All 6 Elsa endpoints return 524 (Cloudflare timeout). Most capabilities now covered by alternatives: `token_search` → CoinGecko search-pools, `token_price` → CoinGecko simple-price / Otto token-details. Still missing: `wallet_analysis` and `gas_data`. Monitor for recovery.
- **BigInt.prototype.toJSON polyfill**: Global monkey-patch in `client.ts` to fix `@x402/core`'s `encodePaymentSignatureHeader`. Remove when upstream fixes this (they already have a `toJsonSafe` helper that handles it, just not in the standalone function).
- **CDP wallet concurrency limit**: Parallel x402 payment signing causes nonce collisions. Mitigated with retry + jitter (2-4s random delay), but still adds latency. Root fix would be a signing queue or upstream CDP SDK fix.
- ~~**Synthesis cost is high with live data**~~: FIXED. Added `truncateEndpointData()` in `synthesize.ts` — trims arrays to 3 items, compact JSON, 16K char total budget. 85K → 5.3K chars (94% cut). Synthesis cost $0.17 → $0.028.
- ~~**Zapper x402 v1 incompatible**~~: FIXED. `@x402/evm` 2.3.1 fixed v1 payload format. All 17 Zapper endpoints re-enabled and tested. All use POST method.
- **Memory not wired into pipeline**: Need to add save-query-result and update-endpoint-reliability calls.
- **Endpoint registry is static**: No runtime discovery. Phase 3 will add auto-discovery.
- **Otto tradfi-data returning nulls**: Endpoint accepts payment but returns null values for all fields. Their data source may be intermittent. Keep in registry — will self-heal.
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
