# Scratchpad

Lessons learned, gotchas, and decisions made while building Parallax.

---

## Decisions

- **x402 v2 packages** (`@x402/fetch` + `@x402/evm`) instead of deprecated `x402-fetch`. The old package name from CLAUDE.md is obsolete.
- **CDP env vars changed**: v2 uses `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` (not `CDP_API_KEY`). Updated `.env.example`.
- **zod v3 with `as any` casts** for Daydreams schemas. Daydreams bundles zod v4 internally. We use zod v3 at project level because zod v4 causes TypeScript OOM. Runtime compat is fine; we cast schema params with `as any` for Daydreams API calls.
- **AI SDK v5** (`ai@5.0.30`) to match Daydreams' bundled version. `@ai-sdk/anthropic@2` for V2 model compatibility. `maxTokens` → `maxOutputTokens` in v5.
- **Single-query mode runs pipeline directly** instead of going through Daydreams `agent.send()`. The `send()` return type (`AnyRef[]`) doesn't expose output text easily. Interactive mode uses `agent.run()` with `cliExtension` which handles I/O.
- **Mock mode** (`MOCK_MODE=true`) returns canned JSON responses for all 19 capabilities — no USDC spent during development.

## Lucid SDK Node.js Patch (2026-02-12)

- **Problem**: `@lucid-agents/payments` v2.4.3 has a top-level `import { Database } from 'bun:sqlite'` (line 6 of dist/index.js). Since `@lucid-agents/core` and `@lucid-agents/hono` both import from `payments` transitively, the entire Lucid SDK crashes on Node.js with `ERR_UNSUPPORTED_ESM_URL_SCHEME` at module parse time.
- **Root cause**: Build config bug in Lucid's `tsup` setup — SQLite storage should use a dynamic import. The SDK already has in-memory and Postgres storage backends that are pure JS and Node-compatible, but the static `bun:sqlite` import crashes before any storage config code runs.
- **Fix**: `patch-package` replaces the static import with a lazy conditional: `if (typeof Bun !== 'undefined') { Database = (await import('bun:sqlite')).Database }`. Patch file: `patches/@lucid-agents+payments+2.4.3.patch`. Auto-applied via `postinstall` script.
- **Consequence**: On Node.js, `SQLitePaymentStorage` will fail at runtime (the existing Bun check in the constructor still throws). You **must** configure payments with `storage: { type: 'in-memory' }` or `storage: { type: 'postgres' }` — never rely on the default.
- **When to remove**: When Lucid ships a Node-compatible build (check their changelog for `bun:sqlite` → dynamic import). Pin `@lucid-agents/payments` version in package.json if you want to avoid the patch breaking on a minor update.
- **Upstream**: Consider filing a GitHub issue at https://github.com/daydreamsai/lucid-agents/issues

## Gotchas

- **zod v3 vs v4**: Daydreams v0.3.22 uses zod v4 (installed as `zod@4.1.5` in its own node_modules). Our project has zod v3.25.x. The `ZodObject` types are structurally incompatible. Fix: cast with `as any` for all schema params passed to `context()` and `action()`. Also cast handler params with `as any` and destructure manually.
- **TypeScript OOM with zod v4**: Installing `zod@4` at project level causes `tsc --noEmit` to crash with "JavaScript heap out of memory" even with 8GB heap. Known issue with zod v4's deep type inference. Staying on zod v3 with casts avoids this.
- **tsconfig `declaration: true`** breaks with nested zod versions: "The inferred type cannot be named without a reference to @daydreamsai/core/node_modules/zod". Removed `declaration` since we're not building a library.
- **tsconfig module**: Must be `NodeNext` (not `Node16`) for `import ... with { type: "json" }` syntax, though we ended up using `readFileSync` + `JSON.parse` instead.
- **Windows env vars**: `set MOCK_MODE=true && npx tsx ...` doesn't reliably propagate env vars on Windows bash. Use `process.env.MOCK_MODE = 'true'` in code or a `.env` file.

## x402 / Endpoint Notes

- **x402 v2 flow**: `@x402/fetch` `wrapFetchWithPayment(fetch, client)` returns a drop-in `fetch` replacement. On 402, it reads `PAYMENT-REQUIRED` header, signs EIP-3009 via the registered scheme, retries with `PAYMENT-SIGNATURE` header.
- **Signer setup**: `registerExactEvmScheme(client, { signer })` registers both V2 wildcard (`eip155:*`) and all V1 network names. The signer must satisfy `ClientEvmSigner` interface — viem's `privateKeyToAccount()` or CDP's `toAccount(cdpAccount)` both work via `toClientEvmSigner()`.
- **CDP Server Wallet v2**: `CdpClient()` reads from env vars automatically. Use `getOrCreateAccount({ name: "parallax-agent" })` for idempotent wallet creation.
- **Endpoint URLs**: The registry.json URLs are from the known x402 ecosystem but haven't been verified live. Use mock mode until endpoints are confirmed.

## Daydreams Framework Notes

- **Context composition**: `parentContext.use(() => [...])` composes sub-contexts. Each sub-context's actions become available to the LLM but memory stays isolated.
- **Action handler signature**: `handler: async (args, ctx, agent)`. When schema is provided, `args` is the validated input. `ctx` has `.memory`, `.args`, `.call`, etc.
- **`cliExtension`** from `@daydreamsai/cli`: Provides interactive terminal I/O. `agent.run({ context, args })` enters the read-eval-print loop.
- **`agent.send()`** returns `Promise<AnyRef[]>` — an array of log refs, not the output text. For single-shot queries, it's easier to call the pipeline logic directly.

## Prompt Iteration Log

- **v1 decomposition prompt**: Asks LLM to return JSON with `subTasks` array and `reasoning`. Uses temperature 0.3 for deterministic output. Explicitly lists all available capabilities to avoid hallucinated capability names.
- **v1 synthesis prompt**: Requires source citations, data gaps section, confidence score, and key risks. Temperature 0.5 for more creative analysis while staying grounded.
