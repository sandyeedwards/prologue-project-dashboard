"use client";

import { useFormStatus } from "react-dom";

function ReviewSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button--secondary button--small" disabled={pending} type="submit">
      {pending ? (label === "Reopen" ? "Reopening…" : "Closing…") : label}
    </button>
  );
}

export function UnplannedReviewForm({
  action,
  projectId,
  taskId,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  projectId: string;
  taskId: string;
  label: "Confirm and close" | "Reopen";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <ReviewSubmitButton label={label} />
    </form>
  );
}
