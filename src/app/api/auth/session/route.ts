import { authorizeApi } from "@/lib/auth/session";

export async function GET() {
  const auth = await authorizeApi("VIEWER");
  if (!auth.ok) return auth.response;
  return Response.json({
    user: {
      displayName: auth.session.user.displayName,
      email: auth.session.user.email,
      role: auth.session.user.role,
    },
    expiresAt: auth.session.expiresAt,
  });
}
