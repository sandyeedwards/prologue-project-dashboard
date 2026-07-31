export type EligibilityRecord = {
  isActive: boolean;
  isClientUser: boolean;
  isServiceAccount: boolean;
  email: string | null;
};

export function isEligibleEmployee(record: EligibilityRecord): boolean {
  return (
    record.isActive &&
    !record.isClientUser &&
    !record.isServiceAccount &&
    Boolean(record.email?.trim())
  );
}
