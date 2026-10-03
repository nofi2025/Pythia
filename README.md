# Pythia — Argo Risk Audit

An internal ingestion and audit engine with an owner-only review console for assessing technology and AI dependencies, investigating failure hypotheses, and producing explainable financial-risk reports. This is the scoped Argo Risk Audit MVP, not the broader MINA platform.

## Internal ingestion first

The hosted console remains owner-only. No customer-facing onboarding or public product UI is enabled. It opens on Import data with a file picker, drag-and-drop and a review step; the remaining tabs are internal inspection/editing surfaces. The engine also runs headlessly from local JSON files.

```sh
pnpm ingest examples/ingestion.json /path/to/new-result.json
```

The output contains a validated assessment, warnings, dependency findings and deduplicated conditional stress cases. The command makes no network or AI calls and refuses to overwrite an existing output file. Source files should come from authorized customer exports. Input is currently structured JSON, not arbitrary PDFs, contracts, CSVs, scans or automated connectors.

Inventory input requires `source`, `company.name` and `systems` with unique `id` and `name`. Optional system fields: `type`, `vendor`, `purpose`, `ai`, `critical`, `processes` (names), `dependsOn` (system IDs), `cloudProvider`, `identityProvider`, `region`, `controls`, `alternatives`, `source`. Company can include `industry`, `revenue` and `downtimeCost`. Set `illustrative: true` for samples. Unknown fields and dangling dependencies reject the import; review corrections rather than silently dropping data. Limits: 1.5 MB CLI/UI input, 100 systems, 200 normalized nodes/edges.

Matching declared providers are grouped with whitespace/case normalization. Shared provider, cyclic recovery and indirect dependency findings are hypotheses to investigate; a vendor name does not establish its undisclosed cloud infrastructure, shared outage domain or failure likelihood. Unlisted providers remain unknown. Raw input files are not retained by the hosted console; retain authorized source evidence separately.

`lib/dependencies.ts` exposes indexed graph traversal, `dependencyFindings`, `dependencyStress`, and `dependencyDowntimeCost`. A stress test uses the conditional assumption that each entered dependency propagates an interruption; it does not establish failover effectiveness or outage likelihood. The downtime cost function requires hours, a company-wide hourly cost, affected business share, and a source. It counts business interruption once, not once per affected system. Its UI inputs are temporary what-if assumptions, not report-approved estimates.

## Included

- Company intake and editable technology inventory, including arbitrary systems and AI tools.
- Durable assessments in Cloudflare D1; dependency nodes and edges are stored as structured tables.
- Dependency visualization, single-point-of-failure flags, cascading reach and vendor concentration.
- Editable template-generated failure hypotheses, with provenance, confidence and analyst notes.
- Deterministic loss ranges across nine cost categories, annual exposure estimates, exclusions and source requirements.
- Configurable annual likelihood labels; transparent severity-based prioritization; sorting and filtering.
- Editable mitigations and explicit analyst approval before a scenario enters a final report.
- A ten-section, self-contained downloadable HTML executive report with its dependency map. Use the browser's Print → Save as PDF when a PDF is needed.
- ChatGPT sign-in on the hosted private application, server-enforced ownership, transactional graph saves, optimistic concurrency and audit events.
- Clearly labeled fictional demonstration data. No live customer information is included in this repository.

## Cost boundary

Scenario generation uses deterministic templates. **No OpenAI or other paid AI API is called.** No API key is required. An analyst can record an externally generated AI hypothesis and label it accordingly. This implementation does not promise a cap on ChatGPT build credits, hosting charges or future model usage.

## Run locally

Use Node.js 24 (the test suite uses native TypeScript stripping and `node:sqlite`) and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clear_the_leader.sql
pnpm dev
```

Apply each local migration once, in filename order. The development command prints its local URL. On a portable local checkout, visit `/signin-with-chatgpt?return_to=/` to use the starter's loopback-only development identity. The mock identity is excluded from production. The framework script defaults clean clones to the portable profile. Managed Sites development uses its supervised runtime instead.

```sh
pnpm test
pnpm typecheck
pnpm build
```

`pnpm install:ci` is an optional managed Linux installation helper; ordinary local machines should use `pnpm install`.

## Analyst workflow

1. Create an assessment or explore the fictional sample.
2. Complete company intake and enter inventory systems, controls and evidence sources.
3. Add dependency nodes and connect them; arrows mean “depends on.”
4. Generate draft hypotheses or add a scenario using any supported failure category.
5. Review each scenario, likelihood, impact, sources, exclusions and mitigation.
6. Add analyst notes and explicitly approve scenarios for the report.
7. Write the executive summary, save, then download the executive report.

Blank numeric fields mean UNKNOWN. Enter zero only when confirmed. Changes to relevant inputs revoke report approval. Conflicting saves return a recoverable message without silently overwriting the newer revision.

## Architecture

- `app/workspace.tsx`: assessment workflow and dashboard.
- `lib/model.ts`: schemas, safe blank records and fictional demo.
- `lib/engine.ts`: deterministic risk, financial and dependency calculations.
- `lib/report.ts`: escaped, self-contained executive report generation.
- `lib/api.ts`: authenticated assessment API handlers and input validation.
- `db/storage.ts`: prepared SQL, ownership checks and atomic snapshot saves.
- `db/schema.ts` and `drizzle/`: versioned D1 schema and migrations.
- `app/chatgpt-auth.ts`: Sites-owned identity integration.
- `tests/`: financial, schema, report, API and SQLite persistence checks.

`.openai/hosting.json` identifies the private hosted application and declares its logical DB binding. It contains no credentials. Sites owns hosted authentication, infrastructure and deployment. A direct deployment outside Sites requires replacing that identity boundary with a trusted authentication provider; never expose an origin that accepts unverified user-ID headers.

## Financial method

Event loss = sum of included, non-overlapping cost components. Annual exposure = annual probability × event loss using low/low and high/high endpoints. Probability is the chance of at least one occurrence during the next 12 months, and annual exposure is a single-event approximation; repeated events are not modeled. Bounds represent assumptions, not statistical confidence intervals. Unknown included inputs or missing sources keep the total UNKNOWN. Excluded costs require rationales. Displayed bounds round outward to $100.

Never add scenario losses into a portfolio total without modeling dependence and overlapping losses. The app deliberately displays the largest known scenario range, not a fabricated aggregate. Downtime, lost revenue and productivity can overlap. The downtime helper uses explicitly provided hours × hourly operational cost.

Severity is analyst-rated from 1 (minimal) to 5 (critical) across five dimensions. Priority: Closed → Closed; maximum severity ≥4 → High; otherwise missing likelihood or financial inputs → Investigate; severity 3 → Medium; otherwise Low. Likelihood labels are configurable and separate from severity. Overall confidence is the weakest declared confidence across likelihood and included financial inputs.

## Release scope and remaining validation

This is an analyst-operated MVP suitable for demonstration and a controlled pilot. It is not a certification of production security or a validated actuarial/insurance model. External customer onboarding, team roles, billing, automated evidence ingestion, paid AI generation, native server-side PDF rendering and a joint-event portfolio model are outside this release.

Automated tests exercise calculations, UNKNOWN handling, validation, report exclusion/escaping, ownership, stale writes, transaction rollback and API responses. Production compilation and types are checked. Browser interaction and visual QA were unavailable in the build environment; perform a signed-in browser acceptance run (create → save → reload → approve → export) before a customer pilot. Configure data retention, backup/export procedures and operational monitoring for commercial use.
