# Vendored dependencies

## `gavel.js`

`gavel.js` is a **bundled build of [Gavel](https://github.com/apiaryio/gavel.js)**,
the HTTP request/response validation engine that decides whether a real response
matches what the API description expects. It is committed here as a self-contained
artifact rather than installed from npm.

### Why it is vendored

Upstream Gavel is **unmaintained**: the npm `gavel` package's last release was
`10.0.4` on 2021-12-09, published under the now-defunct `apiaryio` organization,
and it pulls in further abandoned `@apiaryio` dependencies. Vendoring a single
bundled file keeps Dredd self-contained and off those abandoned packages.
Because it is a build artifact, **do not hand-edit it** — changes here cannot be
reproduced from source.

### What Dredd uses from it

Only one entry point, from `lib/TransactionRunner.js`:

```js
gavel.validate(expected, real) // -> { fields: {...}, valid: boolean }
```

For **OpenAPI 3.1 / JSON Schema 2020-12** response bodies, Dredd already
**bypasses** Gavel's body validation and uses its own `ajv`-based
`validateBodySchemaWithAjv` (see `lib/TransactionRunner.js`); Gavel then only
covers headers, status code and overall structure. For OpenAPI 3.0 bodies,
Gavel still performs the full validation.

### Direction

The intended long-term path is to **incrementally replace Gavel with in-house
`ajv`-based validation** (already started for 3.1 bodies) and eventually drop
this bundle. Until then it is treated as a frozen, deliberately-owned
dependency. Its behavior is exercised indirectly by the `TransactionRunner`
unit/integration tests; it is excluded from coverage reports (it is not our
source).

> Note: the exact Gavel version captured in this bundle is not recorded in the
> file. To verify, diff against a known `gavel` release or check the commit that
> introduced it.
