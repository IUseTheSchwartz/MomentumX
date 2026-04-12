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
  ['/admin/agents-requirements', 'Agents Requirements'],
  ['/admin/leads', 'Leads'],
  ['/admin/tiers', 'Tiers'],
  ['/admin/distribution', 'Distribution'],
  ['/admin/kpi', 'KPI'],
  ['/admin/logs', 'Logs']
];

export default function AppShell({ admin = false }) {
  const navigate = useNavigate();
  const links = admin ? adminLinks : agentLinks;

  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(nextSession) {
      if (!mounted) return;

      if (!nextSession) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      if (!mounted) return;
      setProfile(data || null);
    }

    async function refreshFromSession() {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession ?? null);
      await loadProfile(currentSession ?? null);
    }

    async function init() {
      await refreshFromSession();
    }

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession ?? null);
      await loadProfile(nextSession ?? null);
    });

    async function handleVisibilityWake() {
      if (document.visibilityState !== 'visible') return;
      await refreshFromSession();
    }

    async function handleWindowFocus() {
      await refreshFromSession();
    }

    document.addEventListener('visibilitychange', handleVisibilityWake);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityWake);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  function switchMode() {
    if (!session) return;

    if (admin) {
      navigate('/app/dashboard');
    } else if (profile?.is_admin) {
      navigate('/admin/overview');
    }
  }

  const canSwitchToAdmin = Boolean(profile?.is_admin);

  return (
    <div
      className="shell"
      style={{
        display: 'flex',
        height: '100vh',
        minHeight: '100vh',
        overflow: 'hidden'
      }}
    >
      <aside
        className="sidebar glass"
        style={{
          flexShrink: 0,
          width: 260,
          height: '100vh',
          minHeight: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div>
          <div className="brand">Momentum X</div>
          <div className="brand-sub">{admin ? 'Admin Control' : 'Agent Ops'}</div>
        </div>

        <nav
          className="nav"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto'
          }}
        >
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0
          }}
        >
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

      <main
        className="content"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
