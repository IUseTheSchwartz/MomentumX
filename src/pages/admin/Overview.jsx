import StatCard from '../../components/StatCard';

export default function Overview() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin Overview</h1>
          <p>Manage agents, tiers, distribution, and inventory.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard label="Agents" value="—" />
        <StatCard label="Unassigned Leads" value="—" />
        <StatCard label="Active Tiers" value="3" />
        <StatCard label="Distribution Rules" value="—" />
      </div>
    </div>
  );
}
