# SIGNALPOINT · Phase 23 PREP — Governance / Audit Console (S13 + B11)
**Prepared 2026-08-31 from the staged P23 work order
(`2026-08-31_SIGNALPOINT_phase-23-work-order.md`).**

> **Scope of this prep — read this first.** This document was assembled in a
> remote session that has only the work order; the standing chain (the board /
> SYSTEMS-LEDGER, the venture memory, signalpoint-platform README + BUILDLOG
> tail + PHASE-INDEX + GLOSSARY, the plan's P23 entry through the amendments)
> lives on the launch machine and was NOT readable here. **The P23 kickoff
> session must still run the full read-in and prove it** — this prep does not
> substitute for it. Nothing here is a ruling; every "recommend" below is a
> staged proposal awaiting GW's cut at the freeze table.

---

## 1 · State at the P22 close (per the work order)

- P1–P3, P5–P8, P12–P22 **GREEN** · P4 framework green, stamps per-lab
  (reconstruction ruling stands) · P9 **parked**.
- **The floor: TWENTY suites, 995 checks ×2 before any commit** —
  `ops/identity-up.sh` FIRST · the machine lane · phase22 additionally needs
  `ops/dataapi-up.sh`.
- Everything DOWN at the wrap; the dev warehouse ACCUMULATES — derive live.
- **⚑ THE HOLD stands** — the entity legal name awaits the LLC registration.
- The road after P22 = GW's call; the board holds P23 as the next build.

## 2 · What P23 is

Plan L242–244, read through the amendments: **the governance service and its
surface as one program** — data-classification levels · immutable audit ledger
for reads, exports, and admin changes across all surfaces · suppression-rule
administration *(pre-A10 wording — see flag 1)* · retention/deletion policies
by data class *(collides with house law — see flag 2)* · report and alert
approval logs · DUA registry · incident review and breach-response workflow ·
periodic access- and export-review reporting.

**Exit criterion (§4 S13 acceptance):** every privileged read/export/change
across the entire platform traces to a **user, tenant, purpose, and
timestamp** — probed adversarially at M3.

### Exists vs adds
Most trails already stand; P23 is chiefly **the console over them, plus the
gaps**:

| Already EXISTS | Phase built it |
|---|---|
| Access-audit logbook (sign-ins, refusals, doors) | P19 |
| Usage ledger (every judged consultation) | P20/P22 |
| Mandatory attribution law + Decisions trail (who/role/reason on overrides) | P15 |
| Alert walk + distribution ledger | P16/P17 |
| Acceptance/terms records = the DUA registry (gate-active since P22) | P21 |
| Append-only everywhere → "immutable audit ledger" is the house construction | all |

**ADDS (candidates):** the SEVENTH family screen (governance/audit console —
an ADMIN surface reading the standing trails in one place) ·
data-classification levels as config · the read-audit wire (the one genuinely
new stream — see row 2) · the periodic access/export review REPORT (composed
document, P14 artifact law) · incident review as a RECORDED workflow (A1 —
real incidents only, zero seeded).

## 3 · THE FREEZE TABLE — GW's cuts to collect

*(Row order per work order §2/§6. "Recommend" = staged proposal only.)*

| # | Question | Staged proposal | GW's cut |
|---|---|---|---|
| 1 | **Where it lives + what it's called.** One program = service + surface (the plan's own words). | `services/governance` · port **:8240** (next slot). Audience per A10 = **the OPERATOR** — an ADMIN surface alongside Console/Alerts/Accounts. Screen NAME on the family grid = GW's alone; candidate one-worders to react to: *Governance · Ledger · Oversight · Registry*. | ☐ screen name ☐ dir ☐ port |
| 2 | **The read-audit grain** — the phase's one genuinely new wire. Today the platform logs judged/refused calls, never every read. | **Privileged = tenant-scoped serves** (already on the usage ledger) **+ ADMIN-lane reads** (new — recorded at the door, the P20 usage pattern's way). **NEVER a firehose** of every health probe. | ☐ grain |
| 3 | **Classification levels.** | A small **closed grid as versioned config** (the tier-set pattern). Level names = real names only (A1 — no invented compliance vocabulary); candidates = GW's cut. | ☐ level grid ☐ names |
| 4 | **Retention/deletion posture** (flag 2). | **Record-only REGISTRY** as recorded config — A1-honest, **enforcing nothing**. Deletion machinery **NOT built** until counsel rules (legal-era decision, GW + counsel). | ☐ posture |
| 5 | **The review report.** | Periodic access/export review as a **composed document** under the P14 artifact law: byte-identical, papers baked, the reading its anchor. Scheduling itself = hosted era (the P14 ruling). Scope + cadence vocabulary = GW's cut. | ☐ scope ☐ cadence words |
| 6 | **Incident workflow** (A1 posture). | A **recorded walk**: reported → reviewed → closed, reason-coded on the standing grid. A new family = a **WHOLE reason-code generation** (crossing #12). **ZERO seeded incidents.** Shape = GW's cut. | ☐ walk shape |
| 7 | **Module split (A9).** | **M1** records layer (classification config · ADMIN-read event lane · the reason-code generation if ruled) → **M2** the console (seventh family screen over the standing trails + the review document) → **M3** THE EXIT (traceability proof, adversarially probed) + the full floor. Green per module. | ☐ boundaries |

### The two pre-ruling flags (re-derive FIRST, the P13/P22 precedent)

1. **"Suppression-rule administration" is PRE-A10 vocabulary — there is NO
   suppression, ever.** The living analog is per-audience **SHAPING config**
   (severity bands, dials, templates, audience catalogs). Whether its
   administration belongs on this console at all — and **read-only vs
   write** — is GW's cut. *Staged lean: read-only view on the console for
   P23; write administration deferred unless GW rules otherwise.*
2. **"Retention/deletion policies" collides head-on with the house law** —
   append-only everywhere, keep-but-seal, prior versions indestructible. A
   deletion policy is a **LEGAL-ERA decision** (GW + counsel), not a build
   default. Row 4 carries the staged posture.

## 4 · Laws in force (checklist for the build)

A1 (real records; no invented incidents, levels, or legal prose) · A9 (module
split, green per module) · A10 (audience named; no suppression) · A11 · the
naming law (service dir, port, screen name, level names, every persistent
name = GW's cut BEFORE use) · the language law + GLOSSARY · the artifact law
(composed review document byte-identical, no run stamp) · crossings #10–#12
(a new surface joins BOTH rosters by migration — the P22 sharpening; new
doors take the attribution contract; a reason generation is a WHOLE set) ·
**the floor: TWENTY suites, 995 checks ×2, machine lane, before any green.**

## 5 · Traps carried forward

- `curl -q` FIRST-parameter past the machine curlrc · a gate asserts the
  session's SERVED display name · an up-script's export roster is part of a
  consult's contract (`dataapi-up` carries `SPU_SERVICE_CREDENTIAL` — the
  pattern to copy for any new consult).
- Python probes carry `MACHINE_TOKEN` · never compare two refusals as
  answers · commit-before-raise on logged refusals · stored probe ids consume
  all eight trailing epoch digits · the bash-3.2 family (four members) · the
  boolean-print scar · census-asserting gates in the blast (probe residue =
  `SP?-P<n>PROBE-`).
- The phase20 seed-census precedent: a census gate meeting lawful config
  growth is re-aimed **ERA-PROOF** (founding rows exact forever + a growth
  law), never loosened.
- Services session-run, 127.0.0.1 only; everything down at every wrap.

## 6 · Exit ritual (staged for the wrap)

Full floor ×2 · the P23 exit criterion whole, probed adversarially ·
acceptance doc · BUILDLOG · the P23 index row · grow the GLOSSARY · **stage
the P24-candidate work order** (the road after P23 = GW's call — P24 LE
gateway is LAST by law; P25 observability; P4 per-lab; P9 parked) · ledger
rewrite · memory update · flight log · everything down · commit at green.

## 7 · Standing cuts GW may drop any time

⚑ THE HOLD (entity legal name) · the P22 word eyeballs (four draft refusal
sentences + the field-grid sentence) · the P21–P15 word eyeballs · terms/DUA
prose · methodology/limitations wording · the payer-plan row · LEO cues ·
region names · the watch-substance list set 1.

---

**Next step:** GW opens the P23 session on the launch machine with the
kickoff line from the work order box, the session proves the full standing
read-in, then works this freeze table top to bottom — rows 1–7, flags first.
