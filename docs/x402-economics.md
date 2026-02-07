# Parallax x402 Economics — Value Proposition Design Doc

**Date:** February 7, 2026
**Purpose:** Pressure-test the unit economics and identify what must be true for Parallax to generate revenue within 2-4 weeks.

---

## The Core Bet

Other agents (and eventually humans) will pay a premium for **synthesized multi-source intelligence** rather than orchestrating 3-5 x402 endpoint calls themselves.

Parallax sells synthesis, not data. The raw data comes from the endpoints — the value-add is decomposition, orchestration, error handling, and LLM-powered synthesis into actionable output.

---

## Revenue Model

### Primary: Agent-to-Agent (x402 endpoint)

Parallax exposes itself as an x402 endpoint. Other agents call it, pay USDC, get a synthesized report back.

| Report Type | Price to Caller | Why an agent pays this |
|---|---|---|
| Token Due Diligence | $0.50–1.00 | Caller avoids managing 4-5 endpoint calls + synthesis logic |
| Macro Context Brief | $0.30–0.75 | Instant market context without building orchestration |
| Yield Rotation Thesis | $0.50–1.00 | Complex multi-source analysis the caller can't do alone |

### Secondary: Human Users (Phase 2+)

Per-report pricing via chat UI. Higher margins but requires UI investment.

| Report Type | Price | Target User |
|---|---|---|
| Token DD | $2–5 | Traders, researchers |
| Macro Brief | $1–2 | Daily briefing users |
| Custom Query | $3–5 | Power users |

---

## Cost Structure Per Report

| Line Item | Cost | Notes |
|---|---|---|
| x402 endpoint calls (3-5 calls) | $0.15–0.25 | At $0.05/call average |
| LLM inference — decomposition | ~$0.01 | Single structured output call |
| LLM inference — synthesis | ~$0.02–0.08 | Depends on context size + model |
| Infrastructure (Railway) | ~$0.005 | Negligible at low volume |
| **Total cost per report** | **$0.18–0.34** | |

### Margin Analysis

| Scenario | Revenue | Cost | Gross Margin |
|---|---|---|---|
| Agent-to-agent (low end) | $0.30 | $0.20 | 33% ($0.10) |
| Agent-to-agent (mid) | $0.75 | $0.25 | 67% ($0.50) |
| Human user (per-report) | $3.00 | $0.30 | 90% ($2.70) |

**Break-even volume at agent-to-agent mid pricing:** ~$20/month infrastructure → 40 reports/month → ~1.3 reports/day.

---

## Critical Dependency: Do the Endpoints Exist?

**This is the single biggest risk.** If there are no live, reliable x402 endpoints returning useful data, there is nothing to orchestrate.

### Action Required Before Building

- [ ] Audit https://github.com/langoustine69 — which repos have live deployments?
- [ ] Test each endpoint: hit the URL, check for 402 response, verify data quality
- [ ] Check x402.org ecosystem directory for other live endpoints
- [ ] Search for other x402 endpoint builders beyond goust

### If Endpoints Are Thin or Not Live

**Option A: Build 1-2 lightweight endpoints ourselves**
- Wrap free APIs (DeFiLlama, CoinGecko, DefiPulse) behind x402 paywalls
- Cost: 1-2 days of work, demonstrates the full loop
- Risk: We're both producer and consumer — less compelling

**Option B: Use mock endpoints for development, ship when ecosystem matures**
- Build the orchestration layer with mocks, swap in real endpoints later
- Risk: No revenue until real endpoints exist

**Option C: Skip x402 for v1, charge humans directly**
- Build the synthesis engine, use free APIs directly (no x402 middleman)
- Charge users via Stripe or direct USDC transfer
- Add x402 endpoint consumption later when the ecosystem exists
- Risk: Loses the x402 narrative, but gets to revenue faster

**Recommendation:** Start with Option A + C hybrid. Use free APIs directly for v1 to validate synthesis quality and get to revenue. Simultaneously wrap 1-2 behind x402 to prove the protocol integration. Switch to full x402 consumption as ecosystem matures.

---

## Path to First Dollar (2-4 Week Target)

### Week 1: Validate the Supply Side
1. Audit live x402 endpoints
2. If thin: build 1-2 simple x402 wrappers around free APIs (DeFiLlama yield data, CoinGecko prices)
3. Get the x402 payment flow working end-to-end with at least one real call

### Week 2: Build the Orchestration Core
4. Types, x402 client, endpoint registry, query decomposition, synthesis
5. CLI producing real reports from real (or self-built) endpoints
6. Test with "Should I invest in $AERO on Base?" end-to-end

### Week 3: Expose as x402 Endpoint + Ship
7. Wrap Parallax itself as an x402 endpoint (other agents can call it)
8. Deploy to Railway
9. Announce in x402 ecosystem channels, goust community, Farcaster

### Week 4: First Revenue
10. Get one other agent builder to integrate Parallax as a data source
11. Alternatively: ship a simple chat UI for human users, charge per report

---

## What Must Be True for This to Work

| Assumption | Risk Level | Mitigation |
|---|---|---|
| Live x402 endpoints exist and return useful data | **HIGH** | Audit first, build our own if needed |
| Other agents will pay for synthesis vs. DIY | MEDIUM | Price low enough that orchestration overhead isn't worth building |
| x402 payment flow works reliably | MEDIUM | Test early, have fallback payment method |
| LLM synthesis quality justifies the premium | LOW | This is where our differentiation lives — invest in prompt quality |
| Base USDC gas costs don't eat margins | LOW | Base L2 fees are minimal |

---

## Key Metrics to Track from Day 1

- **Reports generated** (total, per workflow type)
- **Cost per report** (actual x402 spend + LLM spend)
- **Revenue per report** (what callers/users actually paid)
- **Endpoint reliability** (success rate, latency per endpoint)
- **Synthesis quality** (manual review — does the report actually answer the question?)

---

## Open Questions

1. **Pricing discovery:** $0.50-1.00 per agent-to-agent call is a guess. Need to see what other x402 endpoints charge and what callers will bear.
2. **Payment UX for humans:** If we add a chat UI, how do non-crypto-native users pay? USDC-only is a friction point.
3. **Competitive moat:** If synthesis is the value, what stops someone from copying the prompts? Answer: endpoint reliability data, workflow curation, and speed of iteration compound over time.
4. **Regulatory:** Selling crypto investment analysis ("Should I invest in $TOKEN?") has potential regulatory surface. Consider framing as "data aggregation" not "financial advice."
