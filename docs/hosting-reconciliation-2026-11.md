# Hosting reconciliation — November 3, 2026

## Agreed reporting model

- Hosting history begins January 1, 2024.
- Client revenue uses the agreed full contracted term fee once, at the paid
  hosting start. A quote for hosting that was never sold is not revenue.
- The main Benaco profitability view records the full recorded-plus-estimated tour
  cost once at tour start. For new tours, the estimate is actual grid panos × $0.38
  × hosted days ÷ 365. For billed tours, retain the actual listed charge and estimate
  only days after its billed coverage ends. Merge overlapping complimentary and
  paid intervals. Prior waived/replaced-tour days are not charged again. Future
  duration and unchanged pano counts remain assumptions, not invoiced actuals.
- Benaco's company subscription remains $100 per month, once across the company.
  Monthly invoice totals are retained for reconciliation and are not added to
  the same tour costs or used to multiply the subscription.
- Vendor bills reconcile covered tour costs. Do not add the full vendor bill to
  those same tour costs a second time. Keep invoice activity and estimated
  full-term profitability distinguishable.
- Current IVION instance rates must not be added to historical NavVis invoices.
- New pricing does not rewrite existing contracted fees: IVION monthly client
  price is max($100, $0.25 × counted panos); prepaid annual price is nine monthly
  charges. Proposed annual Benaco price is one-third of that annual IVION quote,
  max($300, $0.75 × IVION-counted panos). Benaco grid counts determine vendor
  costs, not the IVION comparison count.

## User-confirmed reconciliation corrections

Sources: `prologue-billing-table-2026-08-31.xlsx`, sheet `billing_table`, and
`hubspot-crm-exports-all-hosting-records-2026-11-03.xlsx`, sheet
`All Hosting Records`. Files were analyzed read-only. Corrections below come from
the user's subsequent clarification; source exports were not overwritten.

| Tour                     | HubSpot record ID | Client revenue | Pano charges listed in bill | Treatment                                 |
| ------------------------ | ----------------- | -------------: | --------------------------: | ----------------------------------------- |
| Scottsdale Plaza         | 19331217159       |             $0 |                   $1,962.66 | Unsold hosting; retain vendor expense     |
| 2101 N Australian Ave    | 54210461515       |             $0 |                      $87.27 | Retain vendor expense as a loss           |
| Neikirk/Cabell Hall, VMI | 59418593099       |             $0 |                      $19.89 | Retain vendor expense as a loss           |
| Boca Raton               | 19117859971       |         $5,000 |                   $1,116.08 | Paid contract; 3,425 grid panos confirmed |

The three loss-only tours total $2,069.82 in listed vendor charges and zero
revenue. Boca must not be grouped with them. Scottsdale's exported $6,000 fee is
an unsold amount, not missing revenue. With that correction, the export supports
$21,600 in contracted Benaco revenue, all of which has paid hosting start dates.
These are contract-based amounts, not independently verified cash receipts.

The live source still needs Scottsdale's contracted fee cleared or set to zero
and Boca's counted-grid field filled with 3,425. The local reconciliation records
the user's corrections; no HubSpot records or production database values were
changed during this review.

## Confirmed source checks

- The billing formula $0.38 per grid pano per year matches 16 of the 17 grid-pano
  rows marked TOBILL to the cent. The remaining row, 1305 Sophia Street, lists a
  flat $50 rather than the formula's $7.58. Do not invent a universal minimum.
- Nine of ten Benaco HubSpot URLs match billing short IDs exactly. Jackson Hole's
  October complimentary term has no match in the August billing table. Blanket
  coverage based on being active October 30 is not supported by this source.
- All five populated HubSpot grid counts with matching bill rows agree. Four
  source fields are blank: Boca 3,425 (now user-confirmed), Scottsdale 4,208,
  Australian Ave 403, and VMI 233 (the latter three are August bill counts).
- The table lists $10,859.75 as TOBILL: $7,687.54 matches the nine Benaco URLs and
  $3,172.21 lacks a matching Benaco URL in the current export. Some older project
  names occur elsewhere in HubSpot without a Benaco URL, so an unmatched URL is
  not proof that the underlying project is absent or unbilled to its client.

## Reconciled prior and catch-up payments

The user confirmed that $2,393.04 had already been paid. Adding the catch-up
payment of $8,466.71 reconciles exactly to the worksheet's $10,859.75. This is not
a credit or a discrepancy. Both payments settle the same 29 pano-charge rows.
The three loss-only charges remain costs. The company subscription is separate.

The reporting replacement now uses those charge rows, identified by tour URL,
once at tour start. It does not also add the two payment amounts in their payment
months. HubSpot dates place matched tour costs; unmatched/unsold records use the
vendor's created date. Tour starts before 2024 are excluded from this report.
That leaves $9,961.59 of the listed charges in the 2024-onward tour cohort before
remaining-term estimates and the subscription. The full $10,859.75 remains visible
as source reconciliation, including the earlier-starting tours.

Excel supplies creation/removal dates and hosting durations, not payment dates.
Do not treat these as actual payment dates or label contribution as cash flow.
IVION continues using its historical invoice cost basis; that data has not been
re-audited against a freshly supplied NavVis workbook in this pass.

The per-tour cost breakdown shows recorded charges separately from remaining-term
estimates. Missing grids/term ends are exposed instead of replaced with the former
28% guess or a fabricated one-year term. Billing history supplies missing grid
counts for matched tours, including Boca's confirmed 3,425. Jackson Hole is costed
as a new tour because it does not occur in the August detail.

## Independent date-filter repair

Custom dates now keep exact inclusive-day cutoffs across monthly, quarterly,
half-year, and annual charts. Rolling twelve-month dates also stay fixed when
changing grouping. Invoice-date costs and hosting-start revenue outside the
selected interval are excluded. Chart buckets are clipped at both ends.

The subscription is assigned once to the first of the month. Saved monthly bill
totals remain available as reconciliation records and do not change tour-cost
recognition. Chart labels now describe contracted revenue and contribution,
including estimated costs, rather than claiming verified cash receipts/payments.

## Hosting source-data issues

The admin issue center now includes a Hosting Data queue alongside Teamwork
project issues. It checks imported HubSpot records for missing/incomplete terms,
invalid or reversed dates, blank/negative fees, positive quotes without paid
dates, missing or impossible pano counts, invalid Benaco tour links, unrecognized
current IVION instances, and overlapping paid deals sharing a Benaco tour URL.
Warnings and errors also appear in Needs Attention and the navigation count.

Each item includes the source values, its reporting effect, a correction action,
and a direct HubSpot record link. Checks are computed from the current imported
data on each request and clear after corrected source values are synced. No
source edits or new issue-table migration are required. All historical rows
retained for reporting are checked, including rows no longer in the current list.

Paid/complimentary overlap and a grid count differing from the August billing
snapshot are review notes, not proof of incorrect billing. Zero fees and zero-day
complimentary placeholders are valid. Known loss-only tours do not get false
missing-revenue or missing-grid warnings; Scottsdale's remaining positive quote
is flagged as an unsold fee. Boca retains its paid revenue and receives a missing
grid flag with the bill's verified 3,425 count until HubSpot is filled in.

Against the supplied 206-record export, the initial checks identify 12 actionable
items and six overlap review notes. These describe the supplied snapshot, not a
new live HubSpot audit. Source changes since the export may change those counts.

## Rebuild validation

The supplied November 3 export produces the same totals across monthly, quarterly,
half-year and annual groupings: $21,600 contracted Benaco revenue, $9,961.59 in
listed pano charges for tour starts from 2024, $2,526.34 estimated uncovered-term
costs, and $3,500 subscription through November 2026. Estimated contribution is
$5,612.07. This is a preview from the supplied export, not a live database audit
or a verified cash balance. The original export and the user-corrected analysis
inputs produce identical report totals under the paid-term and bill-match rules.

The workbook gives one current set of client term fields. It cannot independently
establish prior client renewals or older fees overwritten in HubSpot. Monthly
invoice totals also lack tour allocations; future line-item invoices will be
needed to replace further remaining-term estimates with recorded tour charges.
