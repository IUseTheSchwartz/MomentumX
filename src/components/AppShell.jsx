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
const REFRESH_INTERVAL_MS = 10000;

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
    support: 0,
    requirements: 0
  });

  const mountedRef = useRef(true);
  const lastProfileRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const navRefreshInFlightRef = useRef(false);

  async function loadSupportUnreadCount(userId, isAdmin) {
    let support = 0;

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

    support = Object.values(latestIncomingByTicketId).reduce((sum, row) => {
      const readAt = readsByTicketId[row.ticket_id]?.last_read_at
        ? new Date(readsByTicketId[row.ticket_id].last_read_at).getTime()
        : 0;
      const messageAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      return sum + (messageAt > readAt ? 1 : 0);
    }, 0);

    return support;
  }

  async function loadRequirementsUnreadCount(userId, isAdmin) {
    if (isAdmin) {
      const [
        { data: recs, error: recsError },
        { data: vids, error: vidsError },
        { data: proofs, error: proofsError },
        { data: noteRows, error: notesError },
        { data: noteReadRows, error: noteReadsError },
        { data: recordingReadRows, error: recordingReadsError },
        { data: videoReadRows, error: videoReadsError },
        { data: proofReadRows, error: proofReadsError }
      ] = await Promise.all([
        supabase.from('lead_recordings').select('id, agent_id, created_at'),
        supabase.from('agent_videos').select('id, agent_id, created_at'),
        supabase.from('lead_pack_proofs').select('id, agent_id, created_at'),
        supabase.from('recording_notes').select('recording_id, sender_is_admin, created_at'),
        supabase
          .from('recording_note_reads')
          .select('recording_id, last_read_at')
          .eq('user_id', userId),
        supabase
          .from('admin_requirement_recording_reads')
          .select('agent_id, last_read_at')
          .eq('user_id', userId),
        supabase
          .from('admin_requirement_video_reads')
          .select('agent_id, last_read_at')
          .eq('user_id', userId),
        supabase
          .from('admin_requirement_proof_reads')
          .select('agent_id, last_read_at')
          .eq('user_id', userId)
      ]);

      if (
        recsError ||
        vidsError ||
        proofsError ||
        notesError ||
        noteReadsError ||
        recordingReadsError ||
        videoReadsError ||
        proofReadsError
      ) {
        return 0;
      }

      const recordingReadByAgent = {};
      for (const row of recordingReadRows || []) {
        recordingReadByAgent[row.agent_id] = row.last_read_at
          ? new Date(row.last_read_at).getTime()
          : 0;
      }

      const videoReadByAgent = {};
      for (const row of videoReadRows || []) {
        videoReadByAgent[row.agent_id] = row.last_read_at ? new Date(row.last_read_at).getTime() : 0;
      }

      const proofReadByAgent = {};
      for (const row of proofReadRows || []) {
        proofReadByAgent[row.agent_id] = row.last_read_at ? new Date(row.last_read_at).getTime() : 0;
      }

      const noteReadByRecording = {};
      for (const row of noteReadRows || []) {
        noteReadByRecording[row.recording_id] = row.last_read_at
          ? new Date(row.last_read_at).getTime()
          : 0;
      }

      const recordingToAgent = {};
      const countsByAgent = {};

      for (const row of recs || []) {
        if (!row.agent_id) continue;
        recordingToAgent[row.id] = row.agent_id;
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
        const readAt = recordingReadByAgent[row.agent_id] || 0;
        if (createdAt > readAt) {
          countsByAgent[row.agent_id] = (countsByAgent[row.agent_id] || 0) + 1;
        }
      }

      for (const row of vids || []) {
        if (!row.agent_id) continue;
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
        const readAt = videoReadByAgent[row.agent_id] || 0;
        if (createdAt > readAt) {
          countsByAgent[row.agent_id] = (countsByAgent[row.agent_id] || 0) + 1;
        }
      }

      for (const row of proofs || []) {
        if (!row.agent_id) continue;
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
        const readAt = proofReadByAgent[row.agent_id] || 0;
        if (createdAt > readAt) {
          countsByAgent[row.agent_id] = (countsByAgent[row.agent_id] || 0) + 1;
        }
      }

      for (const row of noteRows || []) {
        if (row.sender_is_admin) continue;
        const agentId = recordingToAgent[row.recording_id];
        if (!agentId) continue;
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
        const readAt = noteReadByRecording[row.recording_id] || 0;
        if (createdAt > readAt) {
          countsByAgent[agentId] = (countsByAgent[agentId] || 0) + 1;
        }
      }

      return Object.values(countsByAgent).filter((count) => count > 0).length;
    }

    const { data: ownRecordings, error: ownRecordingsError } = await supabase
      .from('lead_recordings')
      .select('id')
      .eq('agent_id', userId);

    if (ownRecordingsError) return 0;

    const recordingIds = (ownRecordings || []).map((row) => row.id).filter(Boolean);
    if (!recordingIds.length) return 0;

    const [{ data: noteRows, error: notesError }, { data: readRows, error: readsError }] =
      await Promise.all([
        supabase
          .from('recording_notes')
          .select('recording_id, sender_is_admin, created_at')
          .in('recording_id', recordingIds),
        supabase
          .from('recording_note_reads')
          .select('recording_id, last_read_at')
          .eq('user_id', userId)
          .in('recording_id', recordingIds)
      ]);

    if (notesError || readsError) return 0;

    const readByRecording = {};
    for (const row of readRows || []) {
      readByRecording[row.recording_id] = row.last_read_at
        ? new Date(row.last_read_at).getTime()
        : 0;
    }

    return (noteRows || []).filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      const readAt = readByRecording[row.recording_id] || 0;
      return row.sender_is_admin && createdAt > readAt;
    }).length;
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

      const [support, requirements] = await Promise.all([
        loadSupportUnreadCount(userId, isAdmin),
        loadRequirementsUnreadCount(userId, isAdmin)
      ]);

      if (mountedRef.current) {
        setNavCounts({
          replacementRequests,
          support,
          requirements
        });
      }
    } catch (error) {
      console.error('Failed to load sidebar notification counts:', error);
    } finally {
      navRefreshInFlightRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    async function loadProfileForSession(nextSession, { keepPreviousOnFailure = true } = {}) {
      if (!mountedRef.current) return;

      if (!nextSession) {
        lastProfileRef.current = null;
        setProfile(null);
        setNavCounts({
          replacementRequests: 0,
          support: 0,
          requirements: 0
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
        await loadNavCountsForUser(nextSession.user.id, admin);
        return;
      }

      const { data, error } = result;

      if (error) {
        if (keepPreviousOnFailure && lastProfileRef.current) {
          setProfile(lastProfileRef.current);
        } else {
          setProfile(null);
        }
        await loadNavCountsForUser(nextSession.user.id, admin);
        return;
      }

      const safeProfile = data || null;
      lastProfileRef.current = safeProfile;
      setProfile(safeProfile);

      await loadNavCountsForUser(nextSession.user.id, admin);
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
          support: 0,
          requirements: 0
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
  }, [admin]);

  useEffect(() => {
    if (!session?.user?.id) return;

    loadNavCountsForUser(session.user.id, admin);

    const intervalId = window.setInterval(() => {
      loadNavCountsForUser(session.user.id, admin);
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
        { event: '*', schema: 'public', table: 'lead_recordings' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_videos' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_pack_proofs' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recording_notes' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recording_note_reads' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_requirement_recording_reads' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_requirement_video_reads' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_requirement_proof_reads' },
        () => loadNavCountsForUser(session.user.id, admin)
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
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

    if (path === '/admin/agents-requirements' || path === '/app/requirements') {
      return navCounts.requirements;
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
