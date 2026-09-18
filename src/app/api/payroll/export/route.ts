import { authorizeApi } from "@/lib/auth/session";
import { getPayrollReport, payrollCsv } from "@/lib/reporting/payroll-data";
import { payPeriod } from "@/lib/reporting/pay-period";
import { payrollPdf } from "@/lib/reporting/payroll-pdf";

export async function GET(request: Request) {
  const auth = await authorizeApi("ADMIN");
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  try {
    payPeriod(params.get("date") || undefined);
  } catch {
    return Response.json({ error: "Choose a valid pay-period date." }, { status: 400 });
  }
  const report = await getPayrollReport(params);
  if (params.get("format") === "pdf") {
    const bytes = await payrollPdf(report.rows, report.today, report.period, report.ptoOnly);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.ptoOnly ? "pto" : "time"}-${report.period.startDate}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(payrollCsv(report.rows, report.today, report.period), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.ptoOnly ? "pto" : "time"}-${report.period.startDate}-${report.period.endDate}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
