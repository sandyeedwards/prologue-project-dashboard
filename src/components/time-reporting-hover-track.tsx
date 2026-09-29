"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

export function TimeReportingHoverTrack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;

    const tooltipWidth = Math.min(320, Math.max(220, rect.width - 16));

    const edgePadding = 8;
    const desiredLeft = pointerX - tooltipWidth / 2;

    const maximumLeft = Math.max(edgePadding, rect.width - tooltipWidth - edgePadding);

    const left = Math.min(Math.max(desiredLeft, edgePadding), maximumLeft);

    element.style.setProperty("--time-reporting-tooltip-left", `${left}px`);
  }

  return (
    <div ref={ref} className="time-reporting-hover-track" onPointerMove={handlePointerMove}>
      {children}
    </div>
  );
}
