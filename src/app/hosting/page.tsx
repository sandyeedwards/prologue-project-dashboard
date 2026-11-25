import { requireUser } from "@/lib/auth/session";
import { getHostingDashboardData } from "@/lib/hosting/reporting";
import { HostingReport, hostingDataQuery } from "./hosting-report";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HostingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/hosting");
  const params = await searchParams;
  const data = await getHostingDashboardData(hostingDataQuery(params));
  return <HostingReport session={session} params={params} data={data} />;
}
