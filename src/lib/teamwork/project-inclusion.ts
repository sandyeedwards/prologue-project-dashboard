import { REPORTING_RULES } from "@/config/reporting-rules";
import { normalizeTeamworkLabel } from "@/lib/teamwork/normalize";

const excludedTagKeys = new Set(
  REPORTING_RULES.excludedProjectTags.map((tag) => normalizeTeamworkLabel(tag)),
);
const dataHallTagKey = normalizeTeamworkLabel(REPORTING_RULES.dataHallProjectTag);
const readySetTagKey = normalizeTeamworkLabel(REPORTING_RULES.readySetProjectTag);
const scanningTagKey = normalizeTeamworkLabel(REPORTING_RULES.projectTypeTags.scanning);
const modelingTagKey = normalizeTeamworkLabel(REPORTING_RULES.projectTypeTags.modeling);
const timeReportingProjectKey = REPORTING_RULES.timeReportingProjectName.trim().toLowerCase();

function normalizedTagKeys(tagNames: readonly unknown[]): Set<string> {
  return new Set(
    tagNames
      .map((tagName) => normalizeTeamworkLabel(tagName))
      .filter((tagName) => tagName.length > 0),
  );
}

export type ProjectReportingPolicy = {
  excluded: boolean;
  exclusionReason: string | null;
  isDataHall: boolean;
  isReadySet: boolean;
  projectType: string | null;
};

export function isExcludedProjectTag(tagName: unknown): boolean {
  return excludedTagKeys.has(normalizeTeamworkLabel(tagName));
}

export function isDataHallProjectTag(tagName: unknown): boolean {
  return normalizeTeamworkLabel(tagName) === dataHallTagKey;
}

export function isTimeReportingProjectName(projectName: unknown): boolean {
  return (
    typeof projectName === "string" && projectName.trim().toLowerCase() === timeReportingProjectKey
  );
}

export function projectReportingPolicy(tagNames: readonly unknown[]): ProjectReportingPolicy {
  const keys = normalizedTagKeys(tagNames);
  const excluded = [...keys].some((key) => excludedTagKeys.has(key));
  const isDataHall = keys.has(dataHallTagKey);
  const isReadySet = keys.has(readySetTagKey);
  const hasScanning = keys.has(scanningTagKey);
  const hasModeling = keys.has(modelingTagKey);

  let projectType: string | null = null;
  if (isDataHall) projectType = "DataHall";
  else if (hasScanning && hasModeling) projectType = "Scanning + Modeling";
  else if (hasScanning) projectType = "Scanning";
  else if (hasModeling) projectType = "Modeling";
  else if (isReadySet) projectType = "Ready Set";

  return {
    excluded,
    exclusionReason: excluded ? "NoReport tag" : null,
    isDataHall,
    isReadySet,
    projectType,
  };
}

export function shouldIncludeProject(tagNames: readonly unknown[]): boolean {
  return !projectReportingPolicy(tagNames).excluded;
}
