// Source: user's NavVis purchase-history screenshot supplied 2026-11-04.
// Product names distinguish Processing from Core incl. Support. This screenshot
// has no invoice numbers or amounts, so clues do not establish invoice allocation.
// User confirmed "Effective Date" means license start date. It is not the
// invoice date or a service end date, and future starts do not add new bills.
export type NavvisPurchaseEvidence = {
  category: "likely-processing" | "likely-instance" | "ambiguous";
  products: string;
  effectiveDates: string[];
  explanation: string;
};

export const NAVVIS_PURCHASE_EVIDENCE: Readonly<Record<string, NavvisPurchaseEvidence>> = {
  INUS20250103070: {
    category: "likely-processing",
    products: "IVION Processing 5",
    effectiveDates: ["2025-01-23"],
    explanation:
      "Exact-date match to a Processing 5 purchase. Strong non-instance candidate; the bill allocation still needs confirmation.",
  },
  INUS20260404639: {
    category: "likely-processing",
    products: "IVION Processing 5",
    effectiveDates: ["2026-04-27"],
    explanation:
      "Exact-date match to a Processing 5 purchase. Strong non-instance candidate; the bill allocation still needs confirmation.",
  },
  INUS20260504732: {
    category: "likely-processing",
    products: "IVION Processing 10",
    effectiveDates: ["2026-05-20"],
    explanation:
      "Bill is one day after the Processing 10 purchase. Strong non-instance candidate; dates alone cannot allocate a mixed bill.",
  },
  INUS20250403328: {
    category: "likely-instance",
    products: "IVION Core 200 incl. Support",
    effectiveDates: ["2025-04-18"],
    explanation:
      "Exact-date Core 200 purchase. Its small amount is not evidence of a non-hosting charge; retain pending invoice confirmation.",
  },
  INUS20240802584: {
    category: "likely-instance",
    products: "IVION Core 100 incl. Support",
    effectiveDates: ["2024-08-02"],
    explanation:
      "Core 100 appears ten days before the bill. May be a hosting adjustment; the amount alone cannot establish proration.",
  },
  INUS20260604853: {
    category: "likely-instance",
    products: "IVION Core 175 incl. Support",
    effectiveDates: ["2026-06-10"],
    explanation:
      "Core 175 appears one day after the bill. Likely an instance purchase or adjustment.",
  },
  INUS20241102862: {
    category: "likely-instance",
    products: "Two IVION Core 300 subscriptions incl. Support",
    effectiveDates: ["2024-11-16"],
    explanation:
      "Two Core 300 entries appear three days before the bill. May cover multiple instances; do not count each purchase row as another bill.",
  },
  INUS20241203008: {
    category: "likely-instance",
    products: "Two Core 300 subscriptions and one Core 100 incl. Support",
    effectiveDates: ["2025-01-01", "2025-01-08"],
    explanation:
      "Multiple Core entries follow the bill by two to nine days. A combined instance invoice is plausible; no per-instance allocation is inferred.",
  },
  INUS20260104214: {
    category: "likely-instance",
    products: "Two IVION Core 300 subscriptions incl. Support",
    effectiveDates: ["2026-01-07"],
    explanation:
      "Two Core 300 entries appear one day before the bill. Keep the invoice once; purchase rows do not add separate costs.",
  },
  UNUS20260704987: {
    category: "likely-instance",
    products: "Core 200 and two Core 300 subscriptions incl. Support",
    effectiveDates: ["2026-07-02", "2026-07-08"],
    explanation:
      "Three nearby Core entries support a possible combined instance bill. Future-dated 2027 entries are not additional 2026 charges.",
  },
  INUS20250803706: {
    category: "ambiguous",
    products: "IVION Processing 5",
    effectiveDates: ["2025-08-13"],
    explanation:
      "A Processing 5 purchase falls between this July 31 bill and the August 19 bill. The screenshot cannot identify which bill or lines belong to it.",
  },
  INUS20250703657: {
    category: "ambiguous",
    products: "IVION Processing 5",
    effectiveDates: ["2025-08-13"],
    explanation:
      "A Processing 5 purchase is six days earlier, but the July 31 bill is also a candidate. Do not exclude either whole bill on date proximity alone.",
  },
  INUS20240602462: {
    category: "ambiguous",
    products: "IVION Processing 5 and four Core subscriptions",
    effectiveDates: ["2024-06-28"],
    explanation:
      "Core and Processing purchases share June 28. Itemized detail is needed to allocate the June bills; a Processing purchase does not make the whole bundle non-hosting.",
  },
  INUS20240602473: {
    category: "ambiguous",
    products: "IVION Processing 5 and four Core subscriptions",
    effectiveDates: ["2024-06-28"],
    explanation:
      "Several Core and Processing purchases share June 28. No unique amount match is available for this bill.",
  },
};
