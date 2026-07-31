import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = new URLSearchParams();
  next.set("mode", "compare");
  const projectValues = Array.isArray(params.project)
    ? params.project
    : params.project
      ? [params.project]
      : [];
  for (const project of projectValues) next.append("project", project);
  redirect(`/projects?${next.toString()}#project-selection`);
}
