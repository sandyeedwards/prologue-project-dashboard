type StatusCardProps = {
  title: string;
  value: string;
  detail: string;
};

export function StatusCard({ title, value, detail }: StatusCardProps) {
  return (
    <article className="status-card">
      <p className="status-card__label">{title}</p>
      <p className="status-card__value">{value}</p>
      <p className="status-card__detail">{detail}</p>
    </article>
  );
}
