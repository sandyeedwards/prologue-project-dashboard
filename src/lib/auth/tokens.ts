import { createHash } from "node:crypto";

export function hashSessionToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
