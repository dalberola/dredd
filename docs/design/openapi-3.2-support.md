# OpenAPI 3.2 Support — Feasibility & Design

Status: **implemented — shipped in v0.4.0** · Milestone: [#3 OpenAPI 3.2 support](https://github.com/stacklych/dredd/milestone/3) (closed) · Audited & implemented: 2026-06-23

> **Outcome:** all three phases shipped in v0.4.0 — routing + the QUERY method + `additionalOperations` (#107), `in: querystring` parameters + `serializedValue` examples (#108), and a warning for streaming/sequential media (`itemSchema`, Server-Sent Events) (#109). The verdict below held: the parser pin was not a blocker and the validation layer was unchanged. The rest of this document is kept as the original design record.

## Verdict (TL;DR)

**Feasible, and cheaper than it looks.** OpenAPI 3.2 is an incremental evolution of 3.1 — it keeps JSON Schema 2020-12 *and* the same OAS schema dialect URI (`…/oas/3.1/dialect/base`). Dredd already compiles 3.1 through an **in-house path that bypasses the pinned `@apielements/openapi3-parser@0.16.1`**, so:

- The core change is **routing `3.2.x` through that in-house path** — roughly a one-line regex.
- **The parser pin is not a blocker** (3.2 never touches the apielements adapter for 3.1-shaped docs).
- **The validation layer needs zero changes** (3.2 schemas carry the 3.1 dialect → already handled by the existing ajv-2020 path).

The actual work is handling a handful of genuinely-new 3.2 features — chiefly the **QUERY method** and **`additionalOperations`** — and the test/fixture/doc surface.

## How Dredd handles versions today (grounded in the code)

`packages/dredd-transactions/parse/index.js`:
- `openapi: 3.1.x` → **in-house path**: the raw document is stashed (`apiElements.openapi31`) and compiled by `compile/openapi31.js`. The apielements parser is *not* used.
- `openapi: 3.0.x` → the **apielements adapter** (`fury.parse`) parses it, plus `compile/openapi30Schema.js` back-fills response schemas.
- Anything else → `fury.detect()`; if no adapter matches, an error annotation: *"Only OpenAPI 3.0 and 3.1 descriptions are supported."*

`compile/openapi31.js` is effectively a **generic OAS-3 walker**: it iterates `document.paths` → a fixed `METHODS` list → operations, and compiles params (path/query/header/cookie), request bodies, and responses by sampling schemas/examples. The only 3.1-specific constant is `OAS_31_DIALECT`, used as the default `$schema` it stamps on extracted response schemas.

`packages/dredd/lib/TransactionRunner.ts` routes body-schema validation by **dialect**: `isAjvSchema()` accepts `…/oas/3.1/dialect/base` or `…/draft/2020-12/schema`, normalizes the former to 2020-12, and validates with `Ajv2020`.

**Empirical probe** (minimal docs through `parse` + `compile`):

| Input | Routed to in-house path? | Result |
|---|---|---|
| `openapi: 3.1.0` | yes | 1 transaction, no annotations |
| `openapi: 3.2.0` | **no** | falls to the 3.0 apielements adapter → warning *"Version '3.2.0' is not fully supported"*, parsed with **3.0** schema semantics |

So 3.2 is not hard-rejected today — it is **silently mis-routed** to the legacy 3.0 adapter, which applies the wrong (3.0) schema model. The fix is to route it to the modern in-house path instead.

## What 3.2 adds, and what it means for Dredd (RTFM)

3.2 keeps JSON Schema **2020-12** and the **`…/oas/3.1/dialect/base`** dialect (unchanged from 3.1). Relevant additions for an HTTP transaction tester:

| 3.2 feature | Spec field / keyword | Impact on Dredd | Priority |
|---|---|---|---|
| QUERY method | `query` fixed field on Path Item (safe, idempotent, allows a request body) | `METHODS` in `openapi31.js` omits it → such operations emit **no transactions** (silently untested) | **High** |
| Arbitrary methods | `additionalOperations` map on Path Item | Walker only reads the 8 classic verbs → these operations are **skipped** | **High** |
| Whole-query-string param | `in: "querystring"` (value via `content`) | `compileParameters` handles only path/query/header/cookie → **silently dropped** | Medium |
| Pre-serialized examples | `serializedValue` on Example Object | Example extraction reads `example`/`examples[].value` → may miss a `serializedValue`, falling back to schema sampling | Low–Med |
| Streaming / sequential media | `itemSchema` on Media Type Object; SSE handling | `bodyFromMediaType` only knows `schema`/`example` → stream semantics unsupported | Advanced (defer) |
| Self-identifying docs | `$self` (document base URI) | Compiler only resolves internal `#/` refs; external refs already left untouched → no action | Low |

## Design (phased, prioritized)

**Phase 1 — make 3.2 a first-class version (MVP, high value / low risk).**
1. Route `3.2.x` to the in-house path: extend the regex at `parse/index.js` (`/^3\.1\.\d+$/` → `/^3\.[12]\.\d+$/`) and update the "supported versions" error text.
2. In `compile/openapi31.js`: add `query` to `METHODS`, and iterate `pathItem.additionalOperations` (key = HTTP method, value = Operation). Request bodies already compile generically, so QUERY-with-body works once routed.
3. Fixtures + unit tests (mirror the 36 existing `openapi3` fixtures; add QUERY / `additionalOperations` cases).
4. Docs: "OpenAPI 3.0, 3.1 **and 3.2**" across `docs/` and READMEs; `parse` error message.

This alone makes the large majority of real 3.2 documents compile and validate correctly.

**Phase 2 — completeness.**
- `in: querystring` parameters (serialize via the param's `content`), or, if deferred, emit an explicit annotation instead of dropping them silently.
- `serializedValue` example extraction.

**Phase 3 — advanced (optional / likely an explicit "unsupported" annotation, not full support).**
- Sequential/streaming media (`itemSchema`, SSE). Dredd validates single request/response transactions, not consumed streams; the honest move is a clear annotation when `itemSchema` is present rather than pretending to validate a stream.

## Risks

- **R1 — mis-routing (must-fix first).** Until the regex routes 3.2 to the in-house path, 3.2 docs go through the 3.0 adapter with wrong schema semantics and only a soft warning. Phase 1 step 1 is the linchpin.
- **R2 — silent feature drop.** QUERY / `additionalOperations` / `querystring` operations currently produce **no transactions or dropped params with no error** — users wouldn't notice untested endpoints. Mitigation: implement QUERY+`additionalOperations` in Phase 1; emit annotations (not silence) for anything deferred.
- **R3 — looser structural validation.** The in-house path does less up-front OAS structural validation than the apielements adapter. This trade-off already exists for 3.1; 3.2 inherits it. Low *new* risk.
- **R4 — parser pin (de-risked).** Because 3.2 bypasses `@apielements/openapi3-parser`, the pinned 0.16.1 is **not** a blocker. (Had 3.2 needed the adapter, this would have been the dominant risk.)
- **R5 — spec recency.** 3.2.0 is recent (2025); ecosystem tooling is still maturing. Low impact here since Dredd doesn't depend on third-party 3.2 support.
- **R6 — test surface.** Need a parallel 3.2 fixture set; mostly 3.1 fixtures re-stamped `openapi: 3.2.0` plus new-feature cases.

## Open questions / to verify during implementation

- Confirm the literal 3.2 dialect handling against a published `…/oas/3.2/dialect/base` if/when one exists (search indicates 3.2 **reuses** the 3.1 dialect URI; the in-house default and `TransactionRunner.isAjvSchema` already cover it — verify with a 3.2 fixture that sets `jsonSchemaDialect` explicitly).
- Decide Phase-2/3 scope for `querystring` and streaming: implement vs. annotate-as-unsupported.
- Whether to keep the 3.0 apielements path or eventually converge 3.0 onto the in-house walker too (out of scope here; separate effort).

## Rough effort

- Phase 1: small — ~1 parser-routing change + a bounded `openapi31.js` addition + fixtures/tests/docs.
- Phase 2: small–medium.
- Phase 3: medium, or trivial if scoped to an "unsupported" annotation.

## Sources

- OpenAPI Specification v3.2.0 — https://spec.openapis.org/oas/v3.2.0.html
- "What's New in OpenAPI 3.2.0" — https://apinotes.io/blog/openapi-3-2-whats-new
- Swagger: OpenAPI 3.2.0 support — https://swagger.io/blog/swagger-launches-support-for-openapi-3-2-0/
- quobix: OpenAPI 3.2 is here — https://quobix.com/articles/openapi-3.2/
- Code audited: `packages/dredd-transactions/parse/index.js`, `compile/index.js`, `compile/openapi31.js`, `compile/openapi30Schema.js`; `packages/dredd/lib/TransactionRunner.ts` (validation routing).
