// Source: prologue-billing-table-2026-08-31.xlsx, billing_table, TOBILL rows.
// The user confirmed that the total comprises an earlier payment and a catch-up
// payment. These payments settle the same charges; they are not extra tour costs.
export const BENACO_VERIFIED_ANNUAL_GRID_RATE = 0.38;
export const BENACO_PREVIOUSLY_PAID = 2393.04;
export const BENACO_CATCH_UP_PAYMENT = 8466.71;
export const BENACO_VERIFIED_PANO_TOTAL = 10859.75;

export type BenacoBillingRecord = {
  shortId: string;
  name: string;
  created: string;
  billedDays: number;
  gridPanos: number;
  panoCost: number;
  removedOn: string | null;
};

type BillingTuple = readonly [string, string, string, number, number, number, string | null];
const entries: readonly BillingTuple[] = [
  ["111fed51", "prologue-maury", "2021-12-16", 1718, 0, 32.95, null],
  ["e291ded8", "prologue-meadow", "2021-12-16", 1718, 0, 37.65, null],
  ["0ef4ee13", "prologue-stuart", "2021-12-16", 1718, 0, 32.95, null],
  ["7a9c1d4f", "prologue-wykham", "2021-12-16", 1718, 0, 18.83, null],
  ["7286edf3", "prologue-aphill", "2021-12-16", 1718, 0, 75.31, null],
  ["63e7db71", "prologue-jackson", "2021-12-16", 1718, 0, 56.48, null],
  ["23db7735", "prologue-soldierssailors", "2021-12-16", 1718, 0, 75.31, null],
  ["dc498701", "prologue-maury (new model)", "2021-12-28", 1706, 0, 32.72, null],
  ["3db8d104", "prologue-meadow (new model)", "2021-12-28", 1706, 0, 37.39, null],
  ["306f55b5", "prologue-stuart (new model)", "2021-12-28", 1706, 0, 32.72, null],
  ["a23d55fc", "prologue-wykham (new model)", "2021-12-28", 1706, 0, 18.7, null],
  ["12bd8d64", "910 Sabot Ridge Ln", "2023-09-07", 896, 0, 230.75, "2026-02-19"],
  ["bf343299", "8 Studio Lane", "2023-09-14", 580, 213, 128.62, "2025-04-16"],
  ["8d9be489", "8045 Scottsville Road", "2023-09-14", 1081, 78, 87.78, null],
  ["5278ab0e", "820 Southlake Blvd", "2024-03-08", 905, 355, 334.48, null],
  [
    "c48fb24c",
    "The Scottsdale Plaza Resort & Villas",
    "2024-11-22",
    448,
    4208,
    1962.66,
    "2026-02-13",
  ],
  ["a4404168", "1305 Sophia Street", "2024-12-12", 68, 107, 50, "2025-02-19"],
  ["0e57eeb5", "Four Seasons Resort Maui", "2025-02-14", 562, 4969, 2907.34, null],
  ["a0d68796", "Science Museum of Virginia", "2025-02-19", 54, 1673, 94.05, "2025-04-14"],
  ["6598d381", "Fairmont Olympic Seattle", "2025-04-18", 464, 3348, 1617.31, "2026-07-27"],
  ["c53cdaed", "Ojai Valley Inn", "2025-05-28", 459, 2246, 1073.28, null],
  ["c370b066", "400 Amaret Street", "2025-06-30", 426, 257, 113.98, null],
  ["872ac132", "The Boca Raton Cloisters (Mobs 1-4)", "2025-10-21", 313, 3425, 1116.08, null],
  ["ef392542", "2101 N Australian Ave", "2026-02-03", 208, 403, 87.27, null],
  ["2658edfd", "350 Seminole Drive", "2026-02-13", 198, 352, 72.56, null],
  ["9a52df36", "Hilton Union Square", "2026-03-30", 119, 1573, 194.88, "2026-07-27"],
  ["c4ce2454", "Parc 55 Hilton", "2026-03-30", 119, 1928, 238.86, "2026-07-27"],
  ["0afa1ba8", "Country Club of Virginia", "2026-04-19", 99, 766, 78.95, "2026-07-27"],
  ["6be67ce2", "Neikirk and Cabell Hall, VMI", "2026-06-09", 82, 233, 19.89, null],
];

export const BENACO_BILLING_HISTORY: readonly BenacoBillingRecord[] = entries.map(
  ([shortId, name, created, billedDays, gridPanos, panoCost, removedOn]) => ({
    shortId,
    name,
    created,
    billedDays,
    gridPanos,
    panoCost,
    removedOn,
  }),
);

export function benacoTourId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "benaco.com" && !parsed.hostname.endsWith(".benaco.com")) return null;
    return (
      parsed.pathname
        .match(/\/(?:view|scan|scans)\/([0-9a-f]{8})(?:-[0-9a-f-]+)?(?:\/|$)/i)?.[1]
        .toLowerCase() ?? null
    );
  } catch {
    return null;
  }
}

export function benacoBillingRecord(url: string | null | undefined) {
  const id = benacoTourId(url);
  return BENACO_BILLING_HISTORY.find((record) => record.shortId === id) ?? null;
}
