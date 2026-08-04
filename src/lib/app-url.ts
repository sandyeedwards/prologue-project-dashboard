export function applicationUrl(path: string, requestUrl: string): URL {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  return new URL(path, configuredBaseUrl || requestUrl);
}
