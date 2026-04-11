export default function StatCard({ label, value, subtext }) {
  return (
    <div className="stat-card glass">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subtext ? <div className="stat-subtext">{subtext}</div> : null}
    </div>
  );
}
