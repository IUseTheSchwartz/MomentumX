import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useRef, useState } from 'react';

export const VIEW_AS_AGENT_STORAGE_KEY = 'momentumx_view_as_agent';

const fullAgentLinks = [
  ['/app/course', 'Course'],
  ['/app/dashboard', 'Dashboard'],
  ['/app/leads', 'Leads'],
  ['/app/ai-trainer', 'AI Sales Trainer'],
  ['/app/kpi', 'KPI'],
  ['/app/recordings', 'Recordings'],
  ['/app/scripts', 'Scripts'],
  ['/app/book', 'Book of Business'],
  ['/app/support', 'Support']
];

const lockedAgentLinks = [['/app/course', 'Course']];

const adminLinks = [
  ['/admin/overview', 'Overview'],
  ['/admin/agents', 'Agents'],
  ['/admin/course', 'Course Progress'],
  ['/admin/leads', 'Leads'],
  ['/admin/replacement-requests', 'Replacement Requests'],
  ['/admin/distribution', 'Distribution'],
  ['/admin/support', 'Support'],
  ['/admin/logs', 'Logs']
];

const PROFILE_TIMEOUT_MS = 8000;
const REFRESH_INTERVAL_MS = 10000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), ms);
    })
  ]);
}

function getStoredViewAsAgent() {
  try {
    const raw = window.localStorage.getItem(VIEW_AS_AGENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [viewAsAgent, setViewAsAgent] = useState(() => getStoredViewAsAgent());
  const [viewAsProfile, setViewAsProfile] = useState(null);
  const [courseStatus, setCourseStatus] = useState(null);
  const [navCounts, setNavCounts] = useState({
    replacementRequests: 0,
    support: 0
  });

  const mountedRef = useRef(true);
  const lastProfileRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const navRefreshInFlightRef = useRef(false);

  const isViewingAsAgent = Boolean(viewAsAgent?.id && profile?.is_admin);
  const effectiveAgentId = isViewingAsAgent ? viewAsAgent.id : session?.user?.id || null;
  const effectiveProfile = isViewingAsAgent ? viewAsProfile || viewAsAgent : profile;

  const courseApproved =
    courseStatus?.status === 'approved' || !!effectiveProfile?.course_override_complete;

  const isLockedAgent = !admin && !courseApproved;
  const links = admin ? adminLinks : isLockedAgent ? lockedAgentLinks : fullAgentLinks;

  async function loadViewAsProfile(agentId) {
    if (!agentId) {
      setViewAsProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', agentId)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (error) {
      setViewAsProfile(viewAsAgent || null);
      return;
    }

    setViewAsProfile(data || viewAsAgent || null);
  }

  async function loadCourseStatus(userId) {
    if (!userId) {
      setCourseStatus(null);
      return;
    }

    const { data, error } = await supabase
      .from('agent_course_status')
      .select('*')
      .eq('agent_id', userId)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (error) {
      setCourseStatus(null);
      return;
    }

    setCourseStatus(data || null);
  }

  async function loadSupportUnreadCount(userId, isAdmin) {
    const { data: ticketRows, error: ticketsError } = await supabase
      .from('support_tickets')
      .select('id');

    if (ticketsError) return 0;

    const ticketIds = (ticketRows || []).map((row) => row.id).filter(Boolean);
    if (!ticketIds.length) return 0;

    const [{ data: messageRows, error: messagesError }, { data: readRows, error: readsError }] =
      await Promise.all([
        supabase
          .from('support_messages')
          .select('ticket_id, sender_is_admin, created_at')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('support_message_reads')
          .select('ticket_id, last_read_at')
          .eq('user_id', userId)
          .in('ticket_id', ticketIds)
      ]);

    if (messagesError || readsError) return 0;

    const readsByTicketId = {};
    for (const row of readRows || []) {
      readsByTicketId[row.ticket_id] = row;
    }

    const latestIncomingByTicketId = {};
    for (const row of messageRows || []) {
      const isIncomingForThisShell = isAdmin ? !row.sender_is_admin : row.sender_is_admin;
      if (!isIncomingForThisShell) continue;

      if (!latestIncomingByTicketId[row.ticket_id]) {
        latestIncomingByTicketId[row.ticket_id] = row;
      }
    }

    return Object.values(latestIncomingByTicketId).reduce((sum, row) => {
      const readAt = readsByTicketId[row.ticket_id]?.last_read_at
        ? new Date(readsByTicketId[row.ticket_id].last_read_at).getTime()
        : 0;
      const messageAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      return sum + (messageAt > readAt ? 1 : 0);
    }, 0);
  }

  async function loadNavCountsForUser(userId, isAdmin) {
    if (!userId || navRefreshInFlightRef.current) return;
    navRefreshInFlightRef.current = true;

    try {
      let replacementRequests = 0;

      if (isAdmin) {
        const { count, error } = await supabase
          .from('lead_replacement_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (!error) {
          replacementRequests = count || 0;
        }
      }

      const support = await loadSupportUnreadCount(userId, isAdmin);

      if (mountedRef.current) {
        setNavCounts({
          replacementRequests,
          support
        });
      }
    } catch (error) {
      console.error('Failed to load sidebar notification counts:', error);
    } finally {
      navRefreshInFlightRef.current = false;
    }
  }

  useEffect(() => {
    const handleStorage = () => {
      setViewAsAgent(getStoredViewAsAgent());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('momentumx-view-as-agent-changed', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('momentumx-view-as-agent-changed', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isViewingAsAgent || !viewAsAgent?.id) {
      setViewAsProfile(null);
      return;
    }

    loadViewAsProfile(viewAsAgent.id);
  }, [isViewingAsAgent, viewAsAgent?.id]);

  useEffect(() => {
    mountedRef.current = true;

    async function loadProfileForSession(nextSession, { keepPreviousOnFailure = true } = {}) {
      if (!mountedRef.current) return;

      if (!nextSession) {
        lastProfileRef.current = null;
        setProfile(null);
        setCourseStatus(null);
        setNavCounts({
          replacementRequests: 0,
          support: 0
        });
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

        await Promise.all([
          loadCourseStatus(effectiveAgentId || nextSession.user.id),
          loadNavCountsForUser(nextSession.user.id, admin)
        ]);

        return;
      }

      const { data, error } = result;

      if (error) {
        if (keepPreviousOnFailure && lastProfileRef.current) {
          setProfile(lastProfileRef.current);
        } else {
          setProfile(null);
        }

        await Promise.all([
          loadCourseStatus(effectiveAgentId || nextSession.user.id),
          loadNavCountsForUser(nextSession.user.id, admin)
        ]);

        return;
      }

      const safeProfile = data || null;
      lastProfileRef.current = safeProfile;
      setProfile(safeProfile);

      await Promise.all([
        loadCourseStatus(effectiveAgentId || nextSession.user.id),
        loadNavCountsForUser(nextSession.user.id, admin)
      ]);
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
        setCourseStatus(null);
        setNavCounts({
          replacementRequests: 0,
          support: 0
        });
        window.localStorage.removeItem(VIEW_AS_AGENT_STORAGE_KEY);
        setViewAsAgent(null);
        setViewAsProfile(null);
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
  }, [admin, effectiveAgentId]);

  useEffect(() => {
    if (!session?.user?.id) return;

    loadNavCountsForUser(session.user.id, admin);
    loadCourseStatus(effectiveAgentId || session.user.id);

    const intervalId = window.setInterval(() => {
      loadNavCountsForUser(session.user.id, admin);
      loadCourseStatus(effectiveAgentId || session.user.id);

      if (isViewingAsAgent && viewAsAgent?.id) {
        loadViewAsProfile(viewAsAgent.id);
      }
    }, REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel(`app-shell-notifications-${session.user.id}-${admin ? 'admin' : 'agent'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_replacement_requests' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_message_reads' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_course_status' },
        () => loadCourseStatus(effectiveAgentId || session.user.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          if (isViewingAsAgent && viewAsAgent?.id) {
            loadViewAsProfile(viewAsAgent.id);
          }
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, admin, effectiveAgentId, isViewingAsAgent, viewAsAgent?.id]);

  async function signOut() {
    window.localStorage.removeItem(VIEW_AS_AGENT_STORAGE_KEY);
    setViewAsAgent(null);
    setViewAsProfile(null);
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  function exitViewAs() {
    window.localStorage.removeItem(VIEW_AS_AGENT_STORAGE_KEY);
    setViewAsAgent(null);
    setViewAsProfile(null);
    window.dispatchEvent(new Event('momentumx-view-as-agent-changed'));
    navigate('/admin/agents');
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
          <div className="brand-sub">
            {isViewingAsAgent ? 'Viewing Agent' : admin ? 'Admin Control' : 'Agent Ops'}
          </div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {isLockedAgent ? (
            <div className="glass" style={{ padding: 10, fontSize: 13, opacity: 0.85 }}>
              Complete the course to unlock Momentum X.
            </div>
          ) : null}

          {isViewingAsAgent ? (
            <button className="btn btn-danger" onClick={exitViewAs} type="button">
              Exit View As
            </button>
          ) : admin ? (
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
        {isViewingAsAgent ? (
          <div
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              background: 'rgba(251,191,36,0.14)',
              borderBottom: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontWeight: 800
            }}
          >
            <span>
              Viewing as:{' '}
              {effectiveProfile?.display_name ||
                effectiveProfile?.email ||
                effectiveProfile?.id ||
                viewAsAgent.id}
            </span>

            <button className="btn btn-ghost btn-small" onClick={exitViewAs} type="button">
              Exit View As
            </button>
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Outlet
            context={{
              viewAsAgent: isViewingAsAgent ? effectiveProfile : null,
              effectiveAgentId,
              adminProfile: profile,
              isViewingAsAgent
            }}
          />
        </div>
      </main>
    </div>
  );
}
