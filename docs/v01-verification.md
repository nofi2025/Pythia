# Pythia v0.1 verification — 2026-10-05

## Inspection and preserved behavior

The existing product is a React/Vinext application compiled to a Cloudflare Worker with owner-scoped D1 persistence. The internal console includes company context, inventory, structural dependency graph, failure hypotheses, deterministic loss ranges, analyst approval, JSON import and printable HTML reports. There is no PDF intake, OCR, CSV parsing or LLM client. No original functionality or data migration was removed. Existing assessment JSON receives empty baseline, draft and simulation defaults; database tables/migration are unchanged.

Before simulator changes: 18 existing tests passed; the existing headless import ran; the actual built Worker rendered and successfully saved/reloaded an assessment in isolated D1. Anonymous access was rejected. No critical existing failure was observed in those paths.

## Added capability

Two versioned deterministic models; saved baseline and draft; three explicit user cases; capacity-constrained revenue and operating profit; unmet demand and break-even; same-demand expansion comparison; one-at-a-time sensitivity including an interior capacity kink; threshold explanation; rule-based observations; selected audit context; immutable saved inputs; comparison and escaped executive export. The current model contract can be extended later without implementing Risk Storms now. No paid API calls, billing or new deployment platform.

## Executed verification

- `pnpm test`: 27 passed, zero failures. Includes existing risk/graph/import tests, eight simulation tests and new API persistence coverage.
- `pnpm typecheck`: passed.
- Managed production build: passed.
- `pnpm test:runtime`: actual built Worker rendered, denied anonymous API access, created/read/updated an assessment in D1, retained draft and saved snapshot inputs, calculated/reported from the reloaded snapshot, rejected stale updates and denied another owner.
- Headless import CLI: ran on the existing illustrative inventory example, 2 systems / 6 dependency findings.
- `pnpm simulate examples/simulation.json <new-output>`: generated deterministic JSON and executive HTML.
- Independent Python Decimal arithmetic matched growth profits and threshold.

### Growth acceptance fixture (illustrative, not company data)

Annual demand/capacity: 10,000 units. Price: $100. Unit COGS: $60. Fixed expenses: $200,000. Expansion: 25%, annual expense $10 per added unit of capacity ($25,000/year). Demand changes: −10%, +10%, +30%.

| Result | Downside | Base | Upside |
|---|---:|---:|---:|
| Revenue | $900,000 | $1,100,000 | $1,250,000 |
| Operating profit | $135,000 | $215,000 | $275,000 |
| Profit delta vs current baseline | −$65,000 | $15,000 | $75,000 |
| Expansion benefit vs unchanged capacity at same demand | −$25,000 | $15,000 | $75,000 |

Current baseline profit: $200,000. Expansion break-even demand: 10,625 units, or 6.25% growth. Tests verify equality at threshold and opposite signs on either side. Upside unmet demand: 500 units.

### Cost-pressure acceptance fixture

Same baseline, no expansion expense required. Demand changes −20%, −10%, 0%; unit COGS changes +20%, +10%, 0%. Operating profits: $24,000, $106,000, $200,000. Capacity stays fixed. Interpretation explains variable-cost and fixed-cost effects.

### Uncertainty and evidence acceptance

Missing numbers or provenance, non-finite/negative baseline values, invalid percentage changes and zero capacity do not produce numerical outcomes. Zero demand/revenue and nonpositive contribution are handled explicitly. Cases are never silently reordered. Reports escape untrusted input. Old audit evidence classifications and explicit report approval remain intact. Changing current baseline does not alter earlier saved snapshots.

## Remaining validation / limitations

Manual browser interactions and visual QA were not performed: the required control-browser skill was unavailable. Runtime HTTP/D1 tests are not a replacement for clicking through the UI. Smallest remaining acceptance action: sign into the private console and complete baseline → run → keep → save → reload → compare → report, and the existing audit approval/report flow.

One annual period, one blended unit model; constant price and costs except selected changes; full-year capacity and demand-to-sales conversion assumptions. No cash flow, tax, financing, one-time capital investment, working capital or probabilistic dependency losses. PDF input remains unsupported; PDF output uses browser print. Source evidence is referenced rather than stored as raw documents. Not an actuarial certification or a production security certification.

## Next three improvements

1. Complete signed-in browser acceptance and add repeatable interaction tests with an available browser harness.
2. Add evidence-linked PDF/CSV extraction with analyst confirmation before it changes inputs.
3. Add phased capacity/cash investment and dependency downtime effects using explicit, non-overlapping assumptions.
