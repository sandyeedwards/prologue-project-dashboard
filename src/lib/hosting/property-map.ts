import { getDealProperties, type HubSpotProperty } from "./hubspot";

const desiredLabels = {
  dealName: ["Deal Name", "Deal name"],
  siteName: ["Site Name"],

  ivionInstance: ["Ivion Instance", "IVION Instance"],

  ivionHostingStart: ["Ivion Term Hosting Start", "IVION Term Hosting Start"],
  ivionHostingEnd: ["Ivion Term Hosting End", "IVION Term Hosting End"],

  ivionContractedFee: ["Ivion Contracted Term Fee", "IVION Contracted Term Fee"],

  ivionTotalPanos: ["Ivion Total Panos", "IVION Total Panos"],
  ivionActivePanos: ["Ivion Active Panos", "IVION Active Panos"],

  ivionCompStart: ["Ivion Complimentary Term Start", "IVION Complimentary Term Start"],
  ivionCompEnd: ["Ivion Complimentary Term End", "IVION Complimentary Term End"],
  ivionCalculatedQuarterlyFee: ["Ivion Calculated Fee/quarterly", "IVION Calculated Fee/quarterly"],
  ivionContractedQuarterlyFee: ["Ivion Contracted Fee/quarterly", "IVION Contracted Fee/quarterly"],
  ivionDateAdded: ["Ivion Date Added", "IVION Date Added"],
  ivionDateSentToClient: ["Ivion Date sent to Client", "IVION Date sent to Client"],
  ivionBundleArchiveDate: ["Ivion Bundle Archive Date", "IVION Bundle Archive Date"],

  benacoHostingStart: ["Benaco Hosting Start"],
  benacoHostingEnd: [
    "Benaco Expiration Date",
    "Benaco Hosting End",
    "Benaco Hosting Expiration Date",
  ],
  benacoContractedFee: ["Benaco Contracted Fee", "Benaco Contracted Fee/quarterly"],
  benacoTotalPanos: ["Benaco Total Panos", "Total Panos"],

  benacoCompStart: ["Complimentary Benaco Hosting Start", "Benaco Complimentary Hosting Start"],
  benacoCompEnd: [
    "Complimentary Benaco Hosting End",
    "Complimentary Benaco Expiration Date",
    "Benaco Complimentary Expiration Date",
    "Benaco Complimentary Hosting End",
  ],
  benacoCompContractedFee: [
    "Complimentary Benaco Contracted Fee",
    "Benaco Complimentary Contracted Fee",
    "Complimentary Benaco Contracted Fee/quarterly",
  ],
  benacoUrl: ["Benaco URL"],
  benacoCalculatedCost: ["Benaco Cost Calculated", "Benaco Calculated Cost"],
  benacoAnnualFee: ["Benaco Annual Fee"],

  hostingNotes: ["Hosting Notes"],
  hostingCommunicationsContact: ["Hosting Communications Contact"],
};

function normalizePropertyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type HostingPropertyMap = Record<keyof typeof desiredLabels, string | null>;

export function resolveHostingPropertyMap(properties: HubSpotProperty[]): HostingPropertyMap {
  const byLabel = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const property of properties) {
    if (property.label) {
      byLabel.set(normalizePropertyName(property.label), property.name);
    }

    if (property.name) {
      byName.set(normalizePropertyName(property.name), property.name);
    }
  }

  const map = {} as HostingPropertyMap;

  for (const [key, labels] of Object.entries(desiredLabels) as Array<
    [keyof typeof desiredLabels, string[]]
  >) {
    let found: string | null = null;

    for (const label of labels) {
      found =
        byLabel.get(normalizePropertyName(label)) ||
        byName.get(normalizePropertyName(label)) ||
        null;

      if (found) {
        break;
      }
    }

    map[key] = found;
  }

  return map;
}

export async function buildHostingPropertyMap(): Promise<HostingPropertyMap> {
  return resolveHostingPropertyMap(await getDealProperties());
}

export function hostingPropertiesToFetch(map: HostingPropertyMap): string[] {
  const mappedProperties = Object.values(map).filter((value): value is string => Boolean(value));

  return Array.from(new Set(["dealname", ...mappedProperties]));
}
