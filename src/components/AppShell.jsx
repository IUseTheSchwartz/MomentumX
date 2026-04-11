import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useState } from 'react';

const agentLinks = [
  ['/app/dashboard', 'Dashboard'],
  ['/app/leads', 'Leads'],
  ['/app/kpi', 'KPI'],
  ['/app/requirements', 'Requirements'],
  ['/app/recordings', 'Recordings'],
  ['/app/book', 'Book of Business'],
  ['/app/support', 'Support']
];

const adminLinks = [
  ['/admin/overview', 'Overview'],
  ['/admin/agents', 'Agents'],
  ['/admin/leads', 'Leads'],
  ['/admin/tiers', 'Tiers'],
  ['/admin/distribution', 'Distribution'],
  ['/admin/kpi', 'KPI'],
  ['/admin/logs', 'Logs']
];

export default function AppShell({ admin = false }) {
  const navigate = useNavigate();
  const links = admin ? adminLinks : agentLinks;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        if (mounted) setProfile(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (mounted) {
        setProfile(data || null);
      }
    }

    loadProfile();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  function switchMode() {
    if (admin) {
      navigate('/app/dashboard');
    } else {
      navigate('/admin/overview');
    }
  }

  const canSwitchToAdmin = Boolean(profile?.is_admin);

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {admin ? (
            <button className="btn btn-primary" onClick={switchMode} type="button">
              Switch to Agent
            </button>
          ) : canSwitchToAdmin ? (
            <button className="btn btn-primary" onClick={switchMode} type="button">
              Switch to Admin
            </button>
          ) : null}

          <button className="btn btn-ghost" onClick={signOut} type="button">
            Sign Out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
