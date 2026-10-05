# Pythia — Argo Risk Audit

An internal decision simulator and risk engine with an owner-only review console. Model two-variable business decisions, preserve evidence, investigate technology dependencies, and produce explainable executive reports. This is the scoped Argo Risk Audit MVP, not the broader MINA platform.

## Import and dependency assessment

The hosted console remains owner-only. No customer-facing onboarding or public product UI is enabled. It opens with a manual simulation entry point. Import data retains its file picker, drag-and-drop and explicit review step; the audit tabs remain internal inspection/editing surfaces. The engine also runs headlessly from local JSON files.

```sh
pnpm ingest examples/ingestion.json /path/to/new-result.json
```

The output contains a validated assessment, warnings, dependency findings and deduplicated conditional stress cases. The command makes no network or AI calls and refuses to overwrite an existing output file. Source files should come from authorized customer exports. Input is currently structured JSON, not arbitrary PDFs, contracts, CSVs, scans or automated connectors.

Inventory input requires `source`, `company.name` and `systems` with unique `id` and `name`. Optional system fields: `type`, `vendor`, `purpose`, `ai`, `critical`, `processes` (names), `dependsOn` (system IDs), `cloudProvider`, `identityProvider`, `region`, `controls`, `alternatives`, `source`. Company can include `industry`, `revenue` and `downtimeCost`. Set `illustrative: true` for samples. Unknown fields and dangling dependencies reject the import; review corrections rather than silently dropping data. Limits: 1.5 MB CLI/UI input, 100 systems, 200 normalized nodes/edges.

Matching declared providers are grouped with whitespace/case normalization. Shared provider, cyclic recovery and indirect dependency findings are hypotheses to investigate; a vendor name does not establish its undisclosed cloud infrastructure, shared outage domain or failure likelihood. Unlisted providers remain unknown. Raw input files are not retained by the hosted console; retain authorized source evidence separately.

`lib/dependencies.ts` exposes indexed graph traversal, `dependencyFindings`, `dependencyStress`, and `dependencyDowntimeCost`. A stress test uses the conditional assumption that each entered dependency propagates an interruption; it does not establish failover effectiveness or outage likelihood. The downtime cost function requires hours, a company-wide hourly cost, affected business share, and a source. It counts business interruption once, not once per affected system. Its UI inputs are temporary what-if assumptions, not report-approved estimates.

## Executive simulator

1. Choose **Start a simulation** (or **New**) and name the company.
2. Choose Growth / capacity or Cost pressure; describe the decision.
3. Enter annual demand, capacity, selling price, variable COGS and fixed expenses with sources/classifications/confidence. Growth also requires annual expense per added unit of capacity. Blank values stay UNKNOWN.
4. Enter Downside, Base and Upside percentages for the two selected variables and explain the assumptions. No defaults fabricate business data.
5. Optionally select audit dependencies, include relevant risk evidence, and add analyst review/mitigation notes.
6. **Run simulation**. Review operating profit, margins, utilization, unmet demand, sensitivity, break-even and formula details.
7. **Keep run for comparison**, then **Save assessment**. Baseline and draft inputs are also saved; each kept run is an independent snapshot (maximum 30).
8. Change inputs, rerun and select an earlier run to compare. Saved simulations → Load inputs restores that run for editing.
9. Download an executive HTML report, open it and use Print → Save as PDF. Reports without review notes are marked DRAFT. The audit report retains its separate explicit approval gate.

Two deterministic models use one annual period and blended unit economics. Growth varies demand and capacity; cost pressure varies demand and unit COGS. The simulator caps sales at capacity, prices expansion via an explicit annual expense, and compares expansion with unchanged capacity under the same demand. Sensitivity varies one input at a time over the entered range and checks the capacity kink. It does not infer probabilities, cash returns or dependency outage losses. Observations are rule-based; no LLM calls. The annual baseline is scoped to this decision and is not silently substituted for company-wide audit revenue.

Headless simulation (fictional example; choose a new output path):

```sh
pnpm simulate examples/simulation.json /tmp/pythia-result.json
```

This writes deterministic JSON plus `/tmp/pythia-result.json.html`. The input is a versioned snapshot with baseline, two-variable cases, sources, confidence, dependency context and notes.

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
pnpm test:runtime
```

`test:runtime` executes the actual built Worker in an ephemeral local Miniflare/D1 instance. It renders the application and checks authenticated create/update/reload, saved simulation drafts and snapshots, conflict handling and ownership. Test identity headers are only used inside this isolated harness.

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
- `lib/model.ts`: backward-compatible assessment schemas, safe blank records and fictional demo.
- `app/simulator.tsx`: baseline, two-variable simulation, saved runs and comparison interface.
- `lib/simulation.ts`: version-1 input/snapshot contracts and pure deterministic engine.
- `lib/simulation-observation.ts`: rule-based interpretations, separated from arithmetic.
- `lib/simulation-report.ts`: reproducible escaped decision reports.
- `scripts/simulate.mjs`: headless engine entry point.
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

27 automated tests exercise risk and simulation calculations, UNKNOWN handling, validation, report exclusion/escaping, ownership, stale writes, transaction rollback and persistence. The built application also passes a local Worker/D1 runtime check. Growth results were independently checked using Python Decimal arithmetic. Production compilation and types are checked. Browser interaction and visual QA were unavailable because this environment did not expose the required control-browser skill. Manual browser acceptance remains unverified: perform create → enter baseline → run → keep → save → reload → compare → export, plus audit approval/export, before a customer pilot. Configure data retention, backup/export procedures and operational monitoring for commercial use.
