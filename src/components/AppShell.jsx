import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const agentLinks = [
  ['/app/dashboard', 'Dashboard'],
  ['/app/leads', 'Leads'],
  ['/app/kpi', 'KPI'],
  ['/app/requirements', 'Requirements'],
  ['/app/content', 'Content'],
  ['/app/recordings', 'Recordings'],
  ['/app/support', 'Support']
];

const adminLinks = [
  ['/admin/overview', 'Overview'],
  ['/admin/agents', 'Agents'],
  ['/admin/leads', 'Leads'],
  ['/admin/tiers', 'Tiers'],
  ['/admin/distribution', 'Distribution'],
  ['/admin/kpi', 'KPI']
];

export default function AppShell({ admin = false }) {
  const navigate = useNavigate();
  const links = admin ? adminLinks : agentLinks;

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div className="shell">
      <aside className="sidebar glass">
        <div>
          <div className="brand">Momentum X</div>
          <div className="brand-sub">{admin ? 'Admin Control' : 'Agent Ops'}</div>
        </div>

        <nav className="nav">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <button className="btn btn-ghost" onClick={signOut}>
          Sign Out
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
