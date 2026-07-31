import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  APP_BASE_URL: z.url(),
  APP_ENV: z.enum(["development", "test", "production"]),
  TEAMWORK_SITE_URL: z.url().refine((value) => value.includes("teamwork.com"), {
    message: "TEAMWORK_SITE_URL must point to a Teamwork.com site.",
  }),
  DATABASE_URL: z.string().min(1),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  console.error("Environment validation failed:");
  console.error(z.prettifyError(result.error));
  process.exitCode = 1;
} else {
  console.log("Environment validation passed for non-secret base settings.");
  console.log(`Application environment: ${result.data.APP_ENV}`);
  console.log(`Teamwork site: ${new URL(result.data.TEAMWORK_SITE_URL).host}`);
}
