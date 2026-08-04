import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  APP_BASE_URL: z.url(),
  APP_ENV: z.enum(["development", "test", "production"]),

  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),

  TEAMWORK_SITE_URL: z.url().refine((value) => value.includes("teamwork.com"), {
    message: "TEAMWORK_SITE_URL must point to a Teamwork.com site.",
  }),
  TEAMWORK_CLIENT_ID: z.string().min(1),
  TEAMWORK_CLIENT_SECRET: z.string().min(1),
  TEAMWORK_REDIRECT_URI: z.url(),
  TEAMWORK_SETUP_KEY: z.string().min(32),
  TEAMWORK_TOKEN_ENCRYPTION_KEY: z.string().min(32),

  DASHBOARD_BOOTSTRAP_ADMIN_EMAILS: z.string().min(1),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  console.error("Environment validation failed:");
  console.error(z.prettifyError(result.error));
  process.exitCode = 1;
} else {
  console.log("Environment validation passed.");
  console.log(`Application environment: ${result.data.APP_ENV}`);
  console.log(`Application URL: ${new URL(result.data.APP_BASE_URL).host}`);
  console.log(`Teamwork site: ${new URL(result.data.TEAMWORK_SITE_URL).host}`);
  console.log("Database and required secret settings are present.");
}
