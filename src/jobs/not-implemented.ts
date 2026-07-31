export function stopUntilImplemented(jobName: string, implementationStep: string): never {
  throw new Error(`${jobName} is intentionally unavailable until ${implementationStep}.`);
}
