import { ProjectsWorkspace } from "@/app/projects/page";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  return <ProjectsWorkspace searchParams={searchParams} basePath="/compare" />;
}
