import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { payrollStatus, type PayrollRow } from "./payroll-data";

export async function payrollPdf(
  rows: PayrollRow[],
  today: string,
  period: { startDate: string; endDate: string },
  ptoOnly: boolean,
) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Prologue ${ptoOnly ? "PTO" : "time"} payroll report ${period.startDate}`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.06, 0.17, 0.3);
  const blue = rgb(0.1, 0.4, 0.75);
  let page = doc.addPage([842, 595]);
  let y = 0;
  const clean = (text: string) => text.normalize("NFKD").replace(/[^\x20-\x7e]/g, "?");
  function text(value: string, x: number, at: number, size = 9, strong = false, maxWidth = 750) {
    const font = strong ? bold : regular;
    let label = clean(value);
    while (font.widthOfTextAtSize(label, size) > maxWidth && label.length)
      label = label.slice(0, -1);
    page.drawText(label, { x, y: at, size, font, color: navy });
  }
  function header(continued = false) {
    page.drawRectangle({ x: 0, y: 490, width: 842, height: 105, color: navy });
    page.drawText("PROLOGUE SYSTEMS", { x: 36, y: 564, size: 11, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`${ptoOnly ? "PTO" : "Time"} payroll report${continued ? " - continued" : ""}`, {
      x: 36,
      y: 535,
      size: 23,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(`${period.startDate} through ${period.endDate} | Generated ${today}`, {
      x: 36,
      y: 511,
      size: 10,
      font: regular,
      color: rgb(0.8, 0.88, 1),
    });
    y = 465;
  }
  function space(height: number) {
    if (y - height < 40) {
      page = doc.addPage([842, 595]);
      header(true);
    }
  }
  function line(value: string, strong = false) {
    space(20);
    text(value, 36, y, strong ? 11 : 9, strong);
    y -= 20;
  }
  header();
  line(
    `${(rows.reduce((sum, row) => sum + row.minutes, 0) / 60).toFixed(2)} total hours | ${rows.length} entries | ${rows.filter((r) => r.changed_after_lock).length} source changes to review`,
    true,
  );
  line(
    "PTO locks 30 days after the work date. Locked values are preserved; other time remains live.",
  );
  line(
    "Initial baseline = older PTO first captured by this feature. Earlier changes cannot be reconstructed.",
  );
  line(
    "This report reflects selected filters. ADP import requires a separately verified CSV mapping.",
  );
  y -= 8;
  line("EMPLOYEE TOTALS", true);
  const totals = new Map<string, { name: string; minutes: number; pto: number }>();
  for (const row of rows) {
    const key = row.person_id || "unassigned";
    const item = totals.get(key) || { name: row.employee_name, minutes: 0, pto: 0 };
    item.minutes += row.minutes;
    if (row.is_pto) item.pto += row.minutes;
    totals.set(key, item);
  }
  for (const value of totals.values())
    line(
      `${value.name}     ${(value.minutes / 60).toFixed(2)} hours     PTO: ${(value.pto / 60).toFixed(2)} hours`,
    );
  y -= 8;
  line("ENTRY DETAIL", true);
  for (const row of rows) {
    space(72);
    page.drawRectangle({ x: 36, y: y - 57, width: 770, height: 69, color: rgb(0.95, 0.97, 0.99) });
    text(
      `${row.employee_name} | ${row.logged_date} | ${(row.minutes / 60).toFixed(2)} hours | ${row.is_pto ? "PTO" : "Time"}`,
      44,
      y,
      10,
      true,
    );
    text(`${row.project_name} / ${row.task_name}`, 44, y - 15, 9, false, 748);
    text(`${payrollStatus(row, today)} | Teamwork entry ${row.teamwork_id}`, 44, y - 30, 8, true);
    text(row.description || "No description", 44, y - 45, 8, false, 748);
    y -= 78;
  }
  if (!rows.length) line("No entries match the selected filters.");
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: 36, y: 29 }, end: { x: 806, y: 29 }, thickness: 1, color: blue });
    p.drawText(`CONFIDENTIAL - Payroll administration     Page ${i + 1} of ${pages.length}`, {
      x: 36,
      y: 15,
      size: 8,
      font: regular,
      color: navy,
    });
  });
  return doc.save();
}
