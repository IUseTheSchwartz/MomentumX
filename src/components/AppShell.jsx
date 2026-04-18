// src/components/AppShell.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useRef, useState } from 'react';

const agentLinks = [
  ['/app/dashboard', 'Dashboard'],
  ['/app/leads', 'Leads'],
  ['/app/kpi', 'KPI'],
  ['/app/requirements', 'Requirements'],
  ['/app/recordings', 'Recordings'],
  ['/app/scripts', 'Scripts'],
  ['/app/book', 'Book of Business'],
  ['/app/support', 'Support']
];

const adminLinks = [
  ['/admin/overview', 'Overview'],
  ['/admin/agents', 'Agents'],
  ['/admin/agents-requirements', 'Agents Requirements'],
  ['/admin/leads', 'Leads'],
  ['/admin/replacement-requests', 'Replacement Requests'],
  ['/admin/support', 'Support'],
  ['/admin/tiers', 'Tiers'],
  ['/admin/distribution', 'Distribution'],
  ['/admin/logs', 'Logs']
];

const PROFILE_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), ms);
    })
  ]);
}

function NavBadge({ count }) {
  if (!count) return null;

  return (
    <span
      style={{
        minWidth: 22,
        height: 22,
        padding: '0 7px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 800,
        background: 'rgba(17,217,140,0.18)',
        border: '1px solid rgba(17,217,140,0.3)',
        color: '#34d399',
        lineHeight: 1
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function AppShell({ admin = false }) {
  const navigate = useNavigate();
  const links = admin ? adminLinks : agentLinks;

  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [navCounts, setNavCounts] = useState({
    replacementRequests: 0,
    support: 0
  });

  const mountedRef = useRef(true);
  const lastProfileRef = useRef(null);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    async function loadProfileForSession(nextSession, { keepPreviousOnFailure = true } = {}) {
      if (!mountedRef.current) return;

      if (!nextSession) {
        lastProfileRef.current = null;
        setProfile(null);
        return;
      }

      const result = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', nextSession.user.id)
          .maybeSingle(),
        PROFILE_TIMEOUT_MS
      );

      if (!mountedRef.current) return;

      if (result?.timedOut) {
        if (keepPreviousOnFailure && lastProfileRef.current) {
          setProfile(lastProfileRef.current);
        }
        return;
      }

      const { data, error } = result;

      if (error) {
        if (keepPreviousOnFailure && lastProfileRef.current) {
          setProfile(lastProfileRef.current);
        } else {
          setProfile(null);
        }
        return;
      }

      const safeProfile = data || null;
      lastProfileRef.current = safeProfile;
      setProfile(safeProfile);
    }

    async function refreshFromSession({ keepPreviousOnFailure = true } = {}) {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        setSession(currentSession ?? null);
        await loadProfileForSession(currentSession ?? null, { keepPreviousOnFailure });
      } finally {
        refreshInFlightRef.current = false;
      }
    }

    refreshFromSession({ keepPreviousOnFailure: false });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        lastProfileRef.current = null;
        setSession(null);
        setProfile(null);
        setNavCounts({
          replacementRequests: 0,
          support: 0
        });
        return;
      }

      setSession(nextSession ?? null);
      await loadProfileForSession(nextSession ?? null, { keepPreviousOnFailure: true });
    });

    const handleVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      await refreshFromSession({ keepPreviousOnFailure: true });
    };

    const handleFocus = async () => {
      await refreshFromSession({ keepPreviousOnFailure: true });
    };

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNavCounts() {
      if (!session?.user?.id) {
        if (!cancelled) {
          setNavCounts({
            replacementRequests: 0,
            support: 0
          });
        }
        return;
      }

      const userId = session.user.id;

      try {
        let replacementRequests = 0;

        if (admin) {
          const { count, error } = await supabase
            .from('lead_replacement_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

          if (!error) {
            replacementRequests = count || 0;
          }
        }

        let support = 0;

        const { data: visibleTickets, error: ticketsError } = await supabase
          .from('support_tickets')
          .select('id');

        if (!ticketsError) {
          const ticketIds = (visibleTickets || []).map((row) => row.id).filter(Boolean);

          if (ticketIds.length) {
            const [{ data: messageRows, error: messagesError }, { data: readRows, error: readsError }] =
              await Promise.all([
                supabase
                  .from('support_messages')
                  .select('id, ticket_id, sender_id, created_at')
                  .in('ticket_id', ticketIds),
                supabase
                  .from('support_message_reads')
                  .select('message_id')
                  .eq('user_id', userId)
              ]);

            if (!messagesError && !readsError) {
              const readMessageIds = new Set((readRows || []).map((row) => row.message_id));

              support = (messageRows || []).filter(
                (row) => row.sender_id !== userId && !readMessageIds.has(row.id)
              ).length;
            }
          }
        }

        if (!cancelled) {
          setNavCounts({
            replacementRequests,
            support
          });
        }
      } catch (error) {
        console.error('Failed to load sidebar notification counts:', error);

        if (!cancelled) {
          setNavCounts({
            replacementRequests: admin ? navCounts.replacementRequests : 0,
            support: navCounts.support
          });
        }
      }
    }

    loadNavCounts();

    const channel = session?.user?.id
      ? supabase
          .channel(`app-shell-notifications-${session.user.id}-${admin ? 'admin' : 'agent'}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'lead_replacement_requests' },
            () => {
              loadNavCounts();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'support_tickets' },
            () => {
              loadNavCounts();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'support_messages' },
            () => {
              loadNavCounts();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'support_message_reads' },
            () => {
              loadNavCounts();
            }
          )
          .subscribe()
      : null;

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id, admin]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  function switchMode() {
    if (!session) return;

    if (admin) {
      navigate('/app/dashboard');
      return;
    }

    if (profile?.is_admin) {
      navigate('/admin/overview');
    }
  }

  function getBadgeCountForPath(path) {
    if (path === '/admin/replacement-requests') {
      return navCounts.replacementRequests;
    }

    if (path === '/admin/support' || path === '/app/support') {
      return navCounts.support;
    }

    return 0;
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
          {links.map(([to, label]) => {
            const badgeCount = getBadgeCountForPath(to);

            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <span>{label}</span>
                <NavBadge count={badgeCount} />
              </NavLink>
            );
          })}
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
