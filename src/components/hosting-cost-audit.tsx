import { dateLabel } from "@/lib/reporting/format";
import { ivionInvoiceEntriesBetween } from "@/lib/hosting/ivion-invoice-history";
import type { HostingReportRow, HostingView } from "@/lib/hosting/reporting";
import { NAVVIS_PURCHASE_EVIDENCE } from "@/lib/hosting/navvis-purchase-evidence";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function HostingCostAudit({
  rows,
  view,
  from,
  to,
}: {
  rows: HostingReportRow[];
  view: HostingView;
  from: string;
  to: string;
}) {
  const sum = (field: keyof HostingReportRow) =>
    rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const components: Array<{ label: string; amount: number; basis: string }> = [];
  if (view !== "benaco") {
    components.push({
      label: "NavVis bills included in hosting",
      amount: sum("ivionCost") - sum("ivionEstimatedCost"),
      basis:
        "Vendor bills after excluding the identified Processing allocations. Remaining ambiguous bills are included provisionally. Current instance rates are not added again.",
    });
    if (sum("ivionEstimatedCost"))
      components.push({
        label: "IVION future estimate",
        amount: sum("ivionEstimatedCost"),
        basis: "Configured instance rates for future forecast months only.",
      });
  }
  if (view !== "ivion")
    components.push(
      {
        label: "Benaco recorded tour charges",
        amount: sum("benacoBilledCost") + sum("benacoHistoricalCost"),
        basis:
          "Matched billing detail counted once per tour at its start. The prior payment and catch-up payment are not separate extra costs.",
      },
      {
        label: "Benaco estimated remaining term",
        amount: sum("benacoEstimatedPanoCosts"),
        basis: "Actual grid count × $0.38/year for uncovered hosting days; assigned at tour start.",
      },
      {
        label: "Benaco company subscription",
        amount: sum("benacoOverhead"),
        basis: "$100 per month, once for the company.",
      },
    );
  const endExclusive = new Date(`${to}T00:00:00Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const invoices = ivionInvoiceEntriesBetween(new Date(`${from}T00:00:00Z`), endExclusive);
  const processingInvoices = invoices.filter((invoice) => invoice.classification === "processing");
  const vendorTotal = invoices.reduce((total, invoice) => total + invoice.amount, 0);
  const processingTotal = invoices.reduce((total, invoice) => total + invoice.processingAmount, 0);
  const hostingTotal = invoices.reduce((total, invoice) => total + invoice.hostingAmount, 0);
  return (
    <details className="report-section hosting-report-section hosting-table-disclosure">
      <summary>
        <span>
          <strong>Where the direct costs come from</strong>
          <small>
            Trace the selected total to IVION invoices, Benaco charges, estimates, and subscription
          </small>
        </span>
        <i aria-hidden="true" />
      </summary>
      <p>
        {dateLabel(from)} through {dateLabel(to)}. The amounts below add up to the direct costs
        shown above.
      </p>
      <div className="table-wrap report-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cost source</th>
              <th>Included amount</th>
              <th>How it is counted</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.label}>
                <td>
                  <strong>{component.label}</strong>
                </td>
                <td>{money(component.amount)}</td>
                <td>{component.basis}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total direct costs</strong>
              </td>
              <td>
                <strong>
                  {money(components.reduce((total, component) => total + component.amount, 0))}
                </strong>
              </td>
              <td>Same cost total as the selected-period report.</td>
            </tr>
          </tbody>
        </table>
      </div>
      {view !== "benaco" ? (
        <>
          <h3>NavVis hosting and Processing reconciliation</h3>
          <p>
            The recovered expense export contains only Date, Type, No., Payee and Total. It has no
            descriptions or account categories. The reporting allocations below use the supplied
            purchase history and your instruction to keep Processing with fieldwork. Remaining
            uncertain bills retain their review notes. These dates are the export’s bill dates, not
            payment dates.
          </p>
          <p>
            <strong>
              {money(vendorTotal)} vendor total − {money(processingTotal)} Processing ={" "}
              {money(hostingTotal)} included in hosting.
            </strong>
          </p>
          {processingInvoices.length ? (
            <p>
              <strong>
                {money(processingTotal)} across {processingInvoices.length} Processing bills is
                excluded from hosting.
              </strong>{" "}
              Processing is already accounted for with fieldwork; this report does not create
              another fieldwork expense. Original bill totals remain visible for reconciliation.
            </p>
          ) : null}
          <div className="table-wrap report-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice date</th>
                  <th>Invoice number</th>
                  <th>Imported bill amount</th>
                  <th>Included in hosting</th>
                  <th>Hosting classification</th>
                  <th>Purchase-history evidence</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoiceNumber}>
                    <td>{dateLabel(invoice.date)}</td>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{money(invoice.amount)}</td>
                    <td>{money(invoice.hostingAmount)}</td>
                    <td>
                      {invoice.classification === "processing"
                        ? "Processing — excluded from hosting"
                        : "Included provisionally — see evidence"}
                    </td>
                    <td>
                      {NAVVIS_PURCHASE_EVIDENCE[invoice.invoiceNumber] ? (
                        <>
                          <strong>
                            {NAVVIS_PURCHASE_EVIDENCE[invoice.invoiceNumber].products}
                          </strong>
                          <small>
                            License starts:{" "}
                            {NAVVIS_PURCHASE_EVIDENCE[invoice.invoiceNumber].effectiveDates
                              .map(dateLabel)
                              .join(", ")}
                          </small>
                          <p>{NAVVIS_PURCHASE_EVIDENCE[invoice.invoiceNumber].explanation}</p>
                        </>
                      ) : (
                        "No unique product match in the supplied purchase history."
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>{invoices.length} recorded entries</th>
                  <th />
                  <th>{money(vendorTotal)}</th>
                  <th>{money(hostingTotal)}</th>
                  <th>{money(processingTotal)} excluded Processing</th>
                  <th>Purchase history supplies clues, not additional bill amounts</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
      <p>
        Revenue uses the contracted fee at the paid hosting start recorded in HubSpot. Older renewal
        fees that were overwritten are not recreated. This report is a contribution estimate from
        the available records, not an independently reconciled bank balance.
      </p>
    </details>
  );
}
