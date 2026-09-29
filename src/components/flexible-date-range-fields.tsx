"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

type ParsedDate = {
  iso: string;
  display: string;
};

type DateFieldState = {
  iso: string;
  display: string;
  error: string;
  manual: boolean;
};

type CalendarDay = {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  date: Date;
};

type HistoricalRangeSyncDetail = {
  from?: string;
  to?: string;
  focus?: boolean;
  source?: "preset" | "unlimited" | "zoom" | "reset" | "custom";
};

type HistoricalRangeChangeDetail = {
  from: string;
  to: string;
  source: string;
};

const HISTORICAL_RANGE_SYNC_EVENT = "prologue:historical-range-sync";
const HISTORICAL_RANGE_CHANGE_EVENT = "prologue:historical-range-change";

const EMPTY_DATE: DateFieldState = {
  iso: "",
  display: "",
  error: "",
  manual: false,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromIso(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFlexibleDateInput(value: string): ParsedDate | null {
  const normalized = value.trim();
  if (!normalized) return { iso: "", display: "" };

  const match = normalized.match(/^(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{2}|\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const inputYear = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + inputYear : inputYear;

  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return {
    iso: `${year}-${pad(month)}-${pad(day)}`,
    display: `${pad(month)}/${pad(day)}/${year}`,
  };
}

function fromIso(value: string | undefined): DateFieldState {
  if (!value) return EMPTY_DATE;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return EMPTY_DATE;
  const parsed = parseFlexibleDateInput(`${match[2]}/${match[3]}/${match[1]}`);
  return parsed
    ? { iso: parsed.iso, display: parsed.display, error: "", manual: false }
    : EMPTY_DATE;
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOffset = new Date(year, monthIndex, 1).getDay();
  const firstCell = new Date(year, monthIndex, 1 - firstDayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      firstCell.getFullYear(),
      firstCell.getMonth(),
      firstCell.getDate() + index,
    );
    return {
      iso: dateToIso(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === monthIndex,
      date,
    };
  });
}

function CalendarPopover({
  id,
  month,
  selectedIso,
  minimumIso,
  onMonthChange,
  onSelect,
  onClose,
}: {
  id: string;
  month: Date;
  selectedIso: string;
  minimumIso?: string;
  onMonthChange: (month: Date) => void;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const todayIso = dateToIso(new Date());
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(month);

  return (
    <div
      id={id}
      className="flexible-date__popover"
      role="dialog"
      aria-label={`Choose a date in ${monthLabel}`}
    >
      <div className="flexible-date__popover-header">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="flexible-date__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="flexible-date__days">
        {days.map((day) => {
          const disabled = Boolean(minimumIso && day.iso < minimumIso);
          const selected = day.iso === selectedIso;
          const today = day.iso === todayIso;
          return (
            <button
              key={day.iso}
              type="button"
              className={[
                "flexible-date__day",
                day.inCurrentMonth ? "" : "flexible-date__day--outside",
                selected ? "flexible-date__day--selected" : "",
                today ? "flexible-date__day--today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(day.date)}
              onClick={() => onSelect(day.iso)}
            >
              {day.day}
            </button>
          );
        })}
      </div>
      <div className="flexible-date__popover-footer">
        <button
          type="button"
          onClick={() => onSelect(todayIso)}
          disabled={Boolean(minimumIso && todayIso < minimumIso)}
        >
          Today
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function DateField({
  label,
  name,
  state,
  setState,
  minimumIso,
  onUserInteraction,
}: {
  label: string;
  name: string;
  state: DateFieldState;
  setState: (value: DateFieldState | ((current: DateFieldState) => DateFieldState)) => void;
  minimumIso?: string;
  onUserInteraction?: () => void;
}) {
  const inputId = useId();
  const calendarId = `${inputId}-calendar`;
  const visibleRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValid = useRef({ iso: state.iso, display: state.display });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const selected = dateFromIso(state.iso);
    const source = selected ?? new Date();
    return new Date(source.getFullYear(), source.getMonth(), 1);
  });

  useEffect(() => {
    if (!state.error) lastValid.current = { iso: state.iso, display: state.display };
  }, [state.display, state.error, state.iso]);

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!calendarOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setCalendarOpen(false);
        visibleRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [calendarOpen]);

  const openCalendar = () => {
    onUserInteraction?.();
    const selected = dateFromIso(state.iso);
    const source = selected ?? new Date();
    setVisibleMonth(new Date(source.getFullYear(), source.getMonth(), 1));
    setState((current) => ({ ...current, manual: false, error: "" }));
    setCalendarOpen(true);
  };

  const commitManualValue = (): boolean => {
    const parsed = parseFlexibleDateInput(state.display);
    if (!parsed) {
      setState((current) => ({
        ...current,
        error: "Enter a valid date such as 4/4/24 or 04/04/2024.",
      }));
      return false;
    }
    if (minimumIso && parsed.iso && parsed.iso < minimumIso) {
      setState((current) => ({
        ...current,
        error: "The through date cannot be earlier than the from date.",
      }));
      return false;
    }
    setState({ iso: parsed.iso, display: parsed.display, error: "", manual: false });
    return true;
  };

  const handleClick = (event: MouseEvent<HTMLInputElement>) => {
    if (state.manual) return;
    const clickCount = event.detail;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      if (clickCount === 1) openCalendar();
    }, 220);
  };

  const handleDoubleClick = () => {
    onUserInteraction?.();
    if (clickTimer.current) clearTimeout(clickTimer.current);
    setCalendarOpen(false);
    setState((current) => ({ ...current, manual: true, error: "" }));
    requestAnimationFrame(() => {
      visibleRef.current?.focus();
      visibleRef.current?.select();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      !state.manual &&
      (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      openCalendar();
      return;
    }
    if (!state.manual) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitManualValue()) visibleRef.current?.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setState({
        iso: lastValid.current.iso,
        display: lastValid.current.display,
        error: "",
        manual: false,
      });
      visibleRef.current?.blur();
    }
  };

  const selectDate = (iso: string) => {
    onUserInteraction?.();
    if (minimumIso && iso < minimumIso) return;
    setState(fromIso(iso));
    setCalendarOpen(false);
    requestAnimationFrame(() => visibleRef.current?.focus());
  };

  return (
    <div
      className={`filter-field filter-field--date flexible-date${state.error ? " flexible-date--error" : ""}`}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="flexible-date__control" ref={controlRef}>
        <input
          id={inputId}
          ref={visibleRef}
          className="flexible-date__visible"
          type="text"
          inputMode="numeric"
          value={state.display}
          placeholder="MM/DD/YYYY"
          readOnly={!state.manual}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? `${inputId}-error` : `${inputId}-help`}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onChange={(event) => {
            onUserInteraction?.();
            setState((current) => ({ ...current, display: event.target.value, error: "" }));
          }}
          onBlur={() => {
            if (state.manual) commitManualValue();
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="flexible-date__calendar"
          aria-label={`Open ${label.toLowerCase()} calendar`}
          aria-haspopup="dialog"
          aria-controls={calendarId}
          aria-expanded={calendarOpen}
          onClick={() => {
            onUserInteraction?.();
            setCalendarOpen((current) => {
              if (current) return false;
              const selected = dateFromIso(state.iso);
              const source = selected ?? new Date();
              setVisibleMonth(new Date(source.getFullYear(), source.getMonth(), 1));
              setState((value) => ({ ...value, manual: false, error: "" }));
              return true;
            });
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" />
          </svg>
        </button>
        <input type="hidden" name={name} value={state.iso} />
        {calendarOpen ? (
          <CalendarPopover
            id={calendarId}
            month={visibleMonth}
            selectedIso={state.iso}
            minimumIso={minimumIso}
            onMonthChange={setVisibleMonth}
            onSelect={selectDate}
            onClose={() => setCalendarOpen(false)}
          />
        ) : null}
      </div>
      {state.error ? (
        <small className="flexible-date__error" id={`${inputId}-error`} role="alert">
          {state.error}
        </small>
      ) : (
        <small className="flexible-date__help" id={`${inputId}-help`}>
          Click for calendar · double-click to type
        </small>
      )}
    </div>
  );
}

export function FlexibleDateRangeFields({
  initialFrom,
  initialTo,
  className = "",
  fromName = "dateFrom",
  toName = "dateTo",
  fromLabel = "Project date from",
  toLabel = "Project date through",
}: {
  initialFrom?: string;
  initialTo?: string;
  className?: string;
  fromName?: string;
  toName?: string;
  fromLabel?: string;
  toLabel?: string;
}) {
  const [from, setFrom] = useState<DateFieldState>(() => fromIso(initialFrom));
  const [to, setTo] = useState<DateFieldState>(() => fromIso(initialTo));
  const [historicalAttention, setHistoricalAttention] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const changeSourceRef = useRef("initial");

  const markUserChange = () => {
    changeSourceRef.current = "user";
    setHistoricalAttention(false);
  };

  useEffect(() => {
    const handleHistoricalRangeSync = (event: Event) => {
      const detail = (event as CustomEvent<HistoricalRangeSyncDetail>).detail ?? {};
      changeSourceRef.current = detail.source ?? "custom";
      setFrom(fromIso(detail.from));
      setTo(fromIso(detail.to));
      setHistoricalAttention(Boolean(detail.focus));

      if (detail.focus) {
        requestAnimationFrame(() => {
          rootRef.current?.querySelector<HTMLInputElement>(".flexible-date__visible")?.focus();
        });
      }
    };

    window.addEventListener(HISTORICAL_RANGE_SYNC_EVENT, handleHistoricalRangeSync);
    return () => window.removeEventListener(HISTORICAL_RANGE_SYNC_EVENT, handleHistoricalRangeSync);
  }, []);

  useEffect(() => {
    const source = changeSourceRef.current;
    const detail: HistoricalRangeChangeDetail = {
      from: from.iso,
      to: to.iso,
      source,
    };
    window.dispatchEvent(new CustomEvent(HISTORICAL_RANGE_CHANGE_EVENT, { detail }));
    if (from.iso && to.iso && source !== "custom") setHistoricalAttention(false);
    changeSourceRef.current = "user";
  }, [from.iso, to.iso]);

  useEffect(() => {
    const form = rootRef.current?.closest("form") as HTMLFormElement | null;
    if (!form) return;

    const handleSubmit = (event: SubmitEvent) => {
      let fromValid = true;
      let toValid = true;

      const parsedFrom = parseFlexibleDateInput(from.display);
      if (!parsedFrom) {
        fromValid = false;
        setFrom((current) => ({
          ...current,
          error: "Enter a valid date such as 4/4/24 or 04/04/2024.",
          manual: true,
        }));
      } else {
        const hiddenFrom = rootRef.current?.querySelector<HTMLInputElement>(
          `input[name="${fromName}"]`,
        );
        if (hiddenFrom) hiddenFrom.value = parsedFrom.iso;
        setFrom({ iso: parsedFrom.iso, display: parsedFrom.display, error: "", manual: false });
      }

      const parsedTo = parseFlexibleDateInput(to.display);
      if (!parsedTo) {
        toValid = false;
        setTo((current) => ({
          ...current,
          error: "Enter a valid date such as 4/4/24 or 04/04/2024.",
          manual: true,
        }));
      } else if (parsedFrom?.iso && parsedTo.iso && parsedTo.iso < parsedFrom.iso) {
        toValid = false;
        setTo((current) => ({
          ...current,
          error: "The through date cannot be earlier than the from date.",
          manual: true,
        }));
      } else {
        const hiddenTo = rootRef.current?.querySelector<HTMLInputElement>(
          `input[name="${toName}"]`,
        );
        if (hiddenTo) hiddenTo.value = parsedTo.iso;
        setTo({ iso: parsedTo.iso, display: parsedTo.display, error: "", manual: false });
      }

      if (!fromValid || !toValid) {
        event.preventDefault();
        requestAnimationFrame(() => {
          rootRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
        });
      }
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [from.display, fromName, to.display, toName]);

  return (
    <div
      ref={rootRef}
      className={`flexible-date-range ${className}${historicalAttention ? " flexible-date-range--historical-attention" : ""}`.trim()}
      data-historical-range-target="true"
    >
      <DateField
        label={fromLabel}
        name={fromName}
        state={from}
        setState={setFrom}
        onUserInteraction={markUserChange}
      />
      <DateField
        label={toLabel}
        name={toName}
        state={to}
        setState={setTo}
        minimumIso={from.iso}
        onUserInteraction={markUserChange}
      />
    </div>
  );
}
