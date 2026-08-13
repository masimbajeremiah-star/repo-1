export default function InfoCard({ title, value }) {
  return (
    <div className="info-card">
      <p className="info-card-title">{title}</p>
      <p className="info-card-value">{value}</p>
    </div>
  );
}
