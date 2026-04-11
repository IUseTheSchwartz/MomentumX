import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useRef, useState } from 'react';

const agentLinks = [
  ['/app/dashboard', 'Dashboard'],
  ['/app/leads', 'Leads'],
  ['/app/kpi', 'KPI'],
  ['/app/requirements', 'Requirement Checklist'],
  ['/app/recordings', 'Recordings'],
  ['/app/book', 'Book of Business'],
  ['/app/support', 'Support']
];

const adminLinks = [
  ['/admin/overview', 'Overview'],
  ['/admin/agents', 'Agents'],
  ['/admin/agent-requirements', 'Agents Requirements'],
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function loadProfile(nextSession) {
      if (!mountedRef.current) return;

      if (!nextSession) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      if (!mountedRef.current) return;
      setProfile(data || null);
    }

    async function refreshAuthState() {
      const {
        data: { session: nextSession }
      } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      setSession(nextSession ?? null);
      await loadProfile(nextSession ?? null);
    }

    refreshAuthState();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) return;

      setSession(nextSession ?? null);
      await loadProfile(nextSession ?? null);
    });

    const handleFocus = () => {
      refreshAuthState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAuthState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
