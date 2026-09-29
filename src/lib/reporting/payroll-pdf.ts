import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { type PayrollRow } from "./payroll-data";

type Period = { startDate: string; endDate: string };
type FontSet = { regular: PDFFont; bold: PDFFont };
const PAGE: [number, number] = [842, 595];
const NAVY = rgb(0.05, 0.16, 0.29);
const BLUE = rgb(0.12, 0.4, 0.72);
const PALE = rgb(0.95, 0.97, 0.99);
const LINE = rgb(0.82, 0.87, 0.92);
const MUTED = rgb(0.34, 0.43, 0.54);

function clean(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "?");
}

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)} h`;
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  size = 9,
  color = NAVY,
  maxWidth = 760,
) {
  let label = clean(value);
  while (font.widthOfTextAtSize(label, size) > maxWidth && label.length > 4)
    label = `${label.slice(0, -4)}...`;
  page.drawText(label, { x, y, size, font, color });
}

function header(
  page: PDFPage,
  fonts: FontSet,
  logo: PDFImage | null,
  title: string,
  subtitle: string,
) {
  page.drawRectangle({ x: 0, y: 507, width: PAGE[0], height: 88, color: NAVY });
  if (logo) page.drawImage(logo, { x: 34, y: 528, width: 31, height: 42 });
  drawText(page, fonts.bold, "PROLOGUE", 76, 561, 13, rgb(1, 1, 1));
  drawText(page, fonts.bold, "PROJECT INTELLIGENCE", 76, 548, 6.5, rgb(0.48, 0.75, 1));
  drawText(page, fonts.bold, title, 300, 552, 20, rgb(1, 1, 1), 505);
  drawText(page, fonts.regular, subtitle, 300, 531, 8, rgb(0.83, 0.89, 0.96), 505);
}

function footer(page: PDFPage, fonts: FontSet, index: number, total: number) {
  page.drawLine({ start: { x: 34, y: 27 }, end: { x: 808, y: 27 }, thickness: 0.7, color: LINE });
  drawText(page, fonts.regular, "Confidential | Payroll administration", 34, 14, 7, MUTED);
  drawText(page, fonts.regular, `Page ${index} of ${total}`, 760, 14, 7, MUTED);
}

function stat(page: PDFPage, fonts: FontSet, x: number, label: string, value: string, width = 180) {
  page.drawRectangle({
    x,
    y: 435,
    width,
    height: 52,
    color: PALE,
    borderColor: LINE,
    borderWidth: 0.7,
  });
  drawText(page, fonts.bold, label.toUpperCase(), x + 12, 469, 7, MUTED, width - 24);
  drawText(page, fonts.bold, value, x + 12, 446, 17, NAVY, width - 24);
}

function employeeTotals(rows: PayrollRow[]) {
  const result = new Map<
    string,
    { name: string; minutes: number; pto: number; billable: number }
  >();
  for (const row of rows) {
    const key = row.person_id || row.employee_name;
    const current = result.get(key) ?? { name: row.employee_name, minutes: 0, pto: 0, billable: 0 };
    current.minutes += row.minutes;
    if (row.is_pto) current.pto += row.minutes;
    if (row.is_billable) current.billable += row.minutes;
    result.set(key, current);
  }
  return [...result.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

function drawPtoReport(
  doc: PDFDocument,
  fonts: FontSet,
  logo: PDFImage | null,
  rows: PayrollRow[],
  today: string,
  period: Period,
) {
  let page = doc.addPage(PAGE);
  header(
    page,
    fonts,
    logo,
    "PTO payroll summary",
    `${period.startDate} through ${period.endDate} | Exported ${today}`,
  );
  const people = employeeTotals(rows);
  stat(page, fonts, 34, "PTO logged", hours(rows.reduce((sum, row) => sum + row.minutes, 0)));
  stat(page, fonts, 222, "Employees", String(people.length));
  stat(page, fonts, 410, "Entries", String(rows.length));
  stat(page, fonts, 598, "Pay period", period.startDate, 210);
  let y = 405;
  drawText(page, fonts.bold, "EMPLOYEE TOTALS", 34, y, 8, BLUE);
  y -= 18;
  for (const person of people.slice(0, 4)) {
    drawText(page, fonts.bold, person.name, 42, y, 9, NAVY, 250);
    drawText(page, fonts.bold, hours(person.pto), 300, y, 9);
    y -= 16;
  }
  y -= 2;
  page.drawLine({ start: { x: 34, y }, end: { x: 808, y }, thickness: 0.7, color: LINE });
  y -= 24;
  const headings = ["Employee", "PTO date", "Hours"];
  const xs = [34, 430, 690];
  const drawHeadings = () =>
    headings.forEach((label, index) =>
      drawText(page, fonts.bold, label.toUpperCase(), xs[index], y, 7, MUTED),
    );
  drawHeadings();
  y -= 14;
  for (const row of rows) {
    if (y < 48) {
      page = doc.addPage(PAGE);
      header(page, fonts, logo, "PTO payroll summary", `Exported ${today} | continued`);
      y = 478;
      drawHeadings();
      y -= 15;
    }
    drawText(page, fonts.regular, row.employee_name, xs[0], y, 8, NAVY, 360);
    drawText(page, fonts.regular, row.logged_date, xs[1], y, 8);
    drawText(page, fonts.bold, hours(row.minutes), xs[2], y, 8);
    page.drawLine({
      start: { x: 34, y: y - 7 },
      end: { x: 808, y: y - 7 },
      thickness: 0.35,
      color: LINE,
    });
    y -= 21;
  }
  if (!rows.length) drawText(page, fonts.bold, "No PTO was logged for this pay period.", 34, y, 11);
}

function drawTimeInsights(
  doc: PDFDocument,
  fonts: FontSet,
  logo: PDFImage | null,
  rows: PayrollRow[],
  today: string,
  period: Period,
) {
  const total = rows.reduce((sum, row) => sum + row.minutes, 0);
  const billable = rows.filter((row) => row.is_billable).reduce((sum, row) => sum + row.minutes, 0);
  const pto = rows.filter((row) => row.is_pto).reduce((sum, row) => sum + row.minutes, 0);
  const people = employeeTotals(rows);
  const projects = new Map<string, number>();
  for (const row of rows.filter((entry) => !entry.is_pto))
    projects.set(row.project_name, (projects.get(row.project_name) ?? 0) + row.minutes);
  const topProjects = [...projects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const page = doc.addPage(PAGE);
  header(
    page,
    fonts,
    logo,
    "Time & Utilization Insights",
    `${period.startDate} through ${period.endDate} | Exported ${today}`,
  );
  stat(page, fonts, 34, "Total logged", hours(total));
  stat(page, fonts, 222, "Billable", hours(billable));
  stat(
    page,
    fonts,
    410,
    "Utilization",
    `${total ? ((billable / total) * 100).toFixed(1) : "0.0"}%`,
  );
  stat(page, fonts, 598, "PTO", hours(pto), 210);
  drawText(page, fonts.bold, "TOP PROJECTS BY LOGGED TIME", 34, 405, 8, BLUE);
  let y = 380;
  const largest = Math.max(1, ...topProjects.map(([, minutes]) => minutes));
  topProjects.forEach(([name, minutes]) => {
    drawText(page, fonts.bold, name, 34, y, 8, NAVY, 250);
    page.drawRectangle({ x: 292, y: y - 2, width: 350, height: 9, color: PALE });
    page.drawRectangle({
      x: 292,
      y: y - 2,
      width: (minutes / largest) * 350,
      height: 9,
      color: BLUE,
    });
    drawText(page, fonts.bold, hours(minutes), 660, y, 8);
    y -= 25;
  });
  drawText(page, fonts.bold, "EMPLOYEE SUMMARY", 34, y, 8, BLUE);
  y -= 23;
  ["Employee", "Total", "Billable", "Utilization", "PTO"].forEach((label, index) =>
    drawText(page, fonts.bold, label.toUpperCase(), [34, 330, 430, 540, 665][index], y, 7, MUTED),
  );
  y -= 15;
  for (const person of people) {
    if (y < 48) break;
    const utilization = person.minutes ? (person.billable / person.minutes) * 100 : 0;
    drawText(page, fonts.regular, person.name, 34, y, 8, NAVY, 280);
    drawText(page, fonts.bold, hours(person.minutes), 330, y, 8);
    drawText(page, fonts.regular, hours(person.billable), 430, y, 8);
    drawText(page, fonts.regular, `${utilization.toFixed(1)}%`, 540, y, 8);
    drawText(page, fonts.regular, hours(person.pto), 665, y, 8);
    y -= 18;
  }
  if (!rows.length)
    drawText(page, fonts.bold, "No time entries match the selected filters.", 34, 380, 11);
}

export async function payrollPdf(
  rows: PayrollRow[],
  today: string,
  period: Period,
  ptoOnly: boolean,
) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Prologue ${ptoOnly ? "PTO Export" : "Time Insights"} ${today}`);
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(
      await readFile(path.join(process.cwd(), "public", "prologue-mark.png")),
    );
  } catch {
    logo = null;
  }
  if (ptoOnly) drawPtoReport(doc, fonts, logo, rows, today, period);
  else drawTimeInsights(doc, fonts, logo, rows, today, period);
  const pages = doc.getPages();
  pages.forEach((page, index) => footer(page, fonts, index + 1, pages.length));
  return doc.save();
}
