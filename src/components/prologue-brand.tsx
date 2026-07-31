import Image from "next/image";

export function PrologueMark({
  height = 88,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src="/prologue-mark.png"
      alt="Prologue Systems"
      width={Math.round(height * 0.752)}
      height={height}
      className={`prologue-mark${className ? ` ${className}` : ""}`}
      priority
    />
  );
}

export function PrologueBrand({
  subtitle,
  className = "",
  markHeight = 88,
}: {
  subtitle?: string;
  className?: string;
  markHeight?: number;
}) {
  return (
    <span className={`prologue-brand${className ? ` ${className}` : ""}`}>
      <PrologueMark height={markHeight} />
      <span className="prologue-brand__copy">
        <strong>Prologue Forecasting and Profitability</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </span>
  );
}
