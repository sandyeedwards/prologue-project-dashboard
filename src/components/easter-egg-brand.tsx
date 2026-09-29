"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PrologueMark } from "@/components/prologue-brand";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "c",
  "t",
] as const;
const SESSION_KEY = "prologue-cheddar-tomato-mode";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function EasterEggBrand() {
  const [active, setActive] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const progress = useRef(0);
  const lastKeyAt = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setActive(sessionStorage.getItem(SESSION_KEY) === "on"),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const now = Date.now();
      if (now - lastKeyAt.current > 4_000) progress.current = 0;
      lastKeyAt.current = now;

      if (key === SEQUENCE[progress.current]) {
        progress.current += 1;
        if (progress.current === SEQUENCE.length) {
          progress.current = 0;
          setActive((current) => {
            const next = !current;
            sessionStorage.setItem(SESSION_KEY, next ? "on" : "off");
            if (next) {
              setCelebrating(true);
              window.setTimeout(() => setCelebrating(false), 1_900);
            }
            return next;
          });
        }
        return;
      }

      progress.current = key === SEQUENCE[0] ? 1 : 0;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {active ? (
        <Image
          src="/cheddar-tomato-mark.png"
          alt="Cheddar and Tomato mode"
          width={48}
          height={48}
          className="prologue-mark prologue-mark--easter"
          priority
        />
      ) : (
        <PrologueMark height={48} />
      )}
      <span className="app-header__brand-copy">
        <strong>{active ? "CHEDDAR + TOMATO" : "PROLOGUE"}</strong>
        <small>{active ? "Estimating Mode" : "Project Intelligence"}</small>
      </span>
      {celebrating ? (
        <span className="easter-egg-splash" aria-live="polite">
          <Image
            src="/cheddar-tomato-splash.png"
            alt="Cheddar and Tomato mode activated"
            width={340}
            height={340}
            priority
          />
          <strong>Cheddar &amp; Tomato Mode</strong>
          <small>estimating curiosity activated</small>
        </span>
      ) : null}
    </>
  );
}
