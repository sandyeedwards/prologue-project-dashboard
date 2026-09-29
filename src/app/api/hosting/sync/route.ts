import { authorizeApi } from "@/lib/auth/session";
import { HostingSyncAlreadyRunningError, runHostingSync } from "@/lib/hosting/sync";

export async function POST() {
  const authorization = await authorizeApi("ADMIN");
  if (!authorization.ok) return authorization.response;

  try {
    const result = await runHostingSync("MANUAL", authorization.session.user.id);
    return Response.json(result);
  } catch (error) {
    if (error instanceof HostingSyncAlreadyRunningError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
