import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { currency, formatDate } from '../../lib/utils';

function getLocalDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function getWeekStart(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekKey(value) {
  const date = getWeekStart(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function getMonthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function getMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function isOnOrAfter(value, floorDate) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= floorDate;
}

function countSince(rows, floorDate, field = 'created_at') {
  return (rows || []).filter((row) => isOnOrAfter(row[field], floorDate)).length;
}

function getTierRules(tierName) {
  const normalized = String(tierName || '').toLowerCase();

  if (normalized.includes('tier 1')) {
    return {
      recordingsWeekly: 2,
      videosWeekly: 0,
      leadPacksMonthlyStay: 0,
      leadPacksMonthlyAdvance: 0
    };
  }

  if (normalized.includes('tier 2')) {
    return {
      recordingsWeekly: 1,
      videosWeekly: 2,
      leadPacksMonthlyStay: 1,
      leadPacksMonthlyAdvance: 2
    };
  }

  if (normalized.includes('tier 3')) {
    return {
      recordingsWeekly: 0,
      videosWeekly: 0,
      leadPacksMonthlyStay: 4,
      leadPacksMonthlyAdvance: 0
    };
  }

  return {
    recordingsWeekly: 0,
    videosWeekly: 0,
    leadPacksMonthlyStay: 0,
    leadPacksMonthlyAdvance: 0
  };
}

function buildChecklist(agent) {
  const weekStart = getWeekStart();
  const monthStart = getMonthStart(new Date());
  const rules = getTierRules(agent.tierName);

  const recordingsThisWeek = countSince(agent.recordings, weekStart, 'recorded_for_date');
  const videosThisWeek = countSince(agent.videos, weekStart);
  const proofsThisMonth = countSince(agent.proofs, monthStart);

  return {
    rules,
    recordingsThisWeek,
    videosThisWeek,
    proofsThisMonth,
    recordingsPassed:
      rules.recordingsWeekly === 0 ? true : recordingsThisWeek >= rules.recordingsWeekly,
    videosPassed:
      rules.videosWeekly === 0 ? true : videosThisWeek >= rules.videosWeekly,
    leadStayPassed:
      rules.leadPacksMonthlyStay === 0
        ? true
        : proofsThisMonth >= rules.leadPacksMonthlyStay,
    leadAdvancePassed:
      rules.leadPacksMonthlyAdvance === 0
        ? true
        : proofsThisMonth >= rules.leadPacksMonthlyAdvance
  };
}

function groupRecordings(rows, view) {
  const grouped = new Map();

  for (const row of rows || []) {
    const source = row.recorded_for_date || row.created_at;
    const key =
      view === 'daily'
        ? getLocalDateKey(source)
        : view === 'weekly'
          ? getWeekKey(source)
          : getMonthKey(source);

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([key, items]) => ({
      key,
      items: items.sort(
        (a, b) =>
          new Date(b.recorded_for_date || b.created_at || 0).getTime() -
          new Date(a.recorded_for_date || a.created_at || 0).getTime()
      )
    }));
}

function groupVideos(rows, view) {
  const grouped = new Map();

  for (const row of rows || []) {
    const key = view === 'weekly' ? getWeekKey(row.created_at) : getMonthKey(row.created_at);

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([key, items]) => ({
      key,
      items: items.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    }));
}

function groupProofs(rows, view) {
  const grouped = new Map();

  for (const row of rows || []) {
    const key = view === 'weekly' ? getWeekKey(row.created_at) : getMonthKey(row.created_at);

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([key, items]) => ({
      key,
      items: items.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    }));
}

function groupKpi(rows, view) {
  const grouped = new Map();

  for (const row of rows || []) {
    const sourceDate = row.entry_date || row.created_at;
    const key =
      view === 'daily'
        ? getLocalDateKey(sourceDate)
        : view === 'weekly'
          ? getWeekKey(sourceDate)
          : getMonthKey(sourceDate);

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        dials: 0,
        contacts: 0,
        sits: 0,
        sales: 0,
        premium_submitted: 0,
        ap_sold: 0,
        rows: 0
      });
    }

    const current = grouped.get(key);
    current.dials += Number(row.dials || 0);
    current.contacts += Number(row.contacts || 0);
    current.sits += Number(row.sits || 0);
    current.sales += Number(row.sales || 0);
    current.premium_submitted += Number(row.premium_submitted || 0);
    current.ap_sold += Number(row.ap_sold || 0);
    current.rows += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => String(b.key).localeCompare(String(a.key)));
}

function matchesSearch(agent, query) {
  if (!query) return true;

  const text = [agent.display_name, agent.email, agent.tierName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

function SummaryBox({ title, value, subtext, onClick }) {
  return (
    <button
      type="button"
      className="glass"
      onClick={onClick}
      style={{
        padding: 14,
        textAlign: 'left',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.75 }}>{subtext}</div>
    </button>
  );
}

function ChecklistBadge({ label, current, target, passed, subtext }) {
  const borderColor = passed ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.45)';
  const background = passed ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)';
  const color = passed ? '#34d399' : '#f87171';

  return (
    <div
      className="glass"
      style={{
        padding: 12,
        border: `1px solid ${borderColor}`,
        background
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>
        {current} / {target}
      </div>
      {subtext ? <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{subtext}</div> : null}
    </div>
  );
}

function Modal({ open, title, children, onClose, controls }) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 1000
      }}
    >
      <div
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1100px, 96vw)',
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {controls}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 18,
            overflow: 'auto',
            flex: 1,
            minHeight: 0
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function NoteBubble({ note, currentUserId }) {
  const isMine = note.sender_id === currentUserId;
  const senderName =
    note.profiles?.display_name || note.profiles?.email || (isMine ? 'You' : 'Agent');

  return (
    <div
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        padding: 12,
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        background: isMine ? 'rgba(17,217,140,0.10)' : 'rgba(255,255,255,0.03)'
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{senderName}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{note.body}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>{formatDate(note.created_at)}</div>
    </div>
  );
}

function RecordingNotesPanel({
  recording,
  notes,
  currentUserId,
  draft,
  setDraft,
  sending,
  onSend
}) {
  return (
    <div
      className="glass"
      style={{
        padding: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Notes</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
          {recording.file_name || 'Recording'} · {formatDate(recording.recorded_for_date || recording.created_at)}
        </div>
      </div>

      <div
        style={{
          minHeight: 160,
          maxHeight: 320,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingRight: 4
        }}
      >
        {!notes.length ? (
          <div style={{ opacity: 0.75 }}>No notes yet.</div>
        ) : (
          notes.map((note) => <NoteBubble key={note.id} note={note} currentUserId={currentUserId} />)
        )}
      </div>

      <form onSubmit={onSend}>
        <label>
          Reply
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your note..."
            rows={4}
          />
        </label>

        <div className="top-gap">
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send Note'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AgentsRequirements() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeModal, setActiveModal] = useState(null);
  const [recordingsView, setRecordingsView] = useState('weekly');
  const [videosView, setVideosView] = useState('weekly');
  const [proofsView, setProofsView] = useState('monthly');
  const [kpiView, setKpiView] = useState('weekly');

  const [currentUserId, setCurrentUserId] = useState(null);
  const [notesByRecording, setNotesByRecording] = useState({});
  const [readsByRecording, setReadsByRecording] = useState({});
  const [activeRecordingForNotes, setActiveRecordingForNotes] = useState(null);
  const [recordingNoteDraft, setRecordingNoteDraft] = useState('');
  const [sendingRecordingNote, setSendingRecordingNote] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      setCurrentUserId(session.user.id);
    }

    const [{ data: profiles }, { data: recs }, { data: vids }, { data: proofs }, { data: kpi }] =
      await Promise.all([
        supabase.from('profiles').select('id, display_name, email, tiers(id, name)').order('display_name'),
        supabase.from('lead_recordings').select('*, leads(first_name,last_name,phone)').order('created_at', { ascending: false }),
        supabase.from('agent_videos').select('*').order('created_at', { ascending: false }),
        supabase.from('lead_pack_proofs').select('*').order('created_at', { ascending: false }),
        supabase.from('kpi_entries').select('*').order('entry_date', { ascending: false })
      ]);

    const grouped = (profiles || []).map((agent) => ({
      ...agent,
      tierName: agent.tiers?.name || 'No Tier',
      recordings: (recs || []).filter((r) => r.agent_id === agent.id),
      videos: (vids || []).filter((v) => v.agent_id === agent.id),
      proofs: (proofs || []).filter((p) => p.agent_id === agent.id),
      kpi: (kpi || []).filter((k) => k.agent_id === agent.id)
    }));

    setAgents(grouped);

    const recordingIds = (recs || []).map((row) => row.id);

    if (recordingIds.length && session?.user?.id) {
      const [{ data: noteRows }, { data: readRows }] = await Promise.all([
        supabase
          .from('recording_notes')
          .select('*, profiles!recording_notes_sender_id_fkey(id, display_name, email, is_admin)')
          .in('recording_id', recordingIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('recording_note_reads')
          .select('*')
          .eq('user_id', session.user.id)
          .in('recording_id', recordingIds)
      ]);

      const nextNotesByRecording = {};
      for (const id of recordingIds) {
        nextNotesByRecording[id] = [];
      }
      for (const row of noteRows || []) {
        if (!nextNotesByRecording[row.recording_id]) nextNotesByRecording[row.recording_id] = [];
        nextNotesByRecording[row.recording_id].push(row);
      }

      const nextReadsByRecording = {};
      for (const row of readRows || []) {
        nextReadsByRecording[row.recording_id] = row;
      }

      setNotesByRecording(nextNotesByRecording);
      setReadsByRecording(nextReadsByRecording);
    } else {
      setNotesByRecording({});
      setReadsByRecording({});
    }

    setLoading(false);
  }

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => matchesSearch(agent, search));
  }, [agents, search]);

  const selectedAgent = useMemo(() => {
    if (!activeModal?.agentId) return null;
    return agents.find((agent) => agent.id === activeModal.agentId) || null;
  }, [agents, activeModal]);

  const groupedRecordings = useMemo(() => {
    if (!selectedAgent || activeModal?.type !== 'recordings') return [];
    return groupRecordings(selectedAgent.recordings, recordingsView);
  }, [selectedAgent, activeModal, recordingsView]);

  const groupedVideos = useMemo(() => {
    if (!selectedAgent || activeModal?.type !== 'videos') return [];
    return groupVideos(selectedAgent.videos, videosView);
  }, [selectedAgent, activeModal, videosView]);

  const groupedProofs = useMemo(() => {
    if (!selectedAgent || activeModal?.type !== 'proofs') return [];
    return groupProofs(selectedAgent.proofs, proofsView);
  }, [selectedAgent, activeModal, proofsView]);

  const groupedKpiRows = useMemo(() => {
    if (!selectedAgent || activeModal?.type !== 'kpi') return [];
    return groupKpi(selectedAgent.kpi, kpiView);
  }, [selectedAgent, activeModal, kpiView]);

  function openModal(agentId, type) {
    setActiveModal({ agentId, type });
    setActiveRecordingForNotes(null);
    setRecordingNoteDraft('');
  }

  function closeModal() {
    setActiveModal(null);
    setActiveRecordingForNotes(null);
    setRecordingNoteDraft('');
  }

  function getUnreadCount(recordingId) {
    const notes = notesByRecording[recordingId] || [];
    const readAt = readsByRecording[recordingId]?.last_read_at
      ? new Date(readsByRecording[recordingId].last_read_at).getTime()
      : 0;

    return notes.filter((note) => {
      const createdAt = new Date(note.created_at).getTime();
      return createdAt > readAt && note.sender_id !== currentUserId;
    }).length;
  }

  async function markRecordingRead(recordingId) {
    if (!recordingId || !currentUserId) return;

    const nowIso = new Date().toISOString();

    const { error } = await supabase.from('recording_note_reads').upsert(
      {
        recording_id: recordingId,
        user_id: currentUserId,
        last_read_at: nowIso
      },
      { onConflict: 'recording_id,user_id' }
    );

    if (!error) {
      setReadsByRecording((prev) => ({
        ...prev,
        [recordingId]: {
          recording_id: recordingId,
          user_id: currentUserId,
          last_read_at: nowIso
        }
      }));
    }
  }

  async function openRecordingNotes(recording) {
    setActiveRecordingForNotes(recording);
    setRecordingNoteDraft('');
    await markRecordingRead(recording.id);
  }

  async function sendRecordingNote(e) {
    e.preventDefault();

    const trimmed = recordingNoteDraft.trim();
    if (!activeRecordingForNotes || !trimmed || !currentUserId) return;

    setSendingRecordingNote(true);

    try {
      const { error } = await supabase.from('recording_notes').insert({
        recording_id: activeRecordingForNotes.id,
        sender_id: currentUserId,
        body: trimmed
      });

      if (error) throw error;

      setRecordingNoteDraft('');
      await markRecordingRead(activeRecordingForNotes.id);
      await load();
    } catch (error) {
      console.error('Failed to send recording note:', error);
    } finally {
      setSendingRecordingNote(false);
    }
  }

  const activeRecordingNotes = activeRecordingForNotes
    ? notesByRecording[activeRecordingForNotes.id] || []
    : [];

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Agent Requirements</h1>
          <p>Checklist status, recordings, videos, KPI, and lead pack proofs for every agent.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Agent name, email, or tier..."
          />
        </label>
      </div>

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {loading ? (
          <div className="glass" style={{ padding: 16 }}>
            Loading agent requirements...
          </div>
        ) : null}

        {!loading && !filteredAgents.length ? (
          <div className="glass" style={{ padding: 16 }}>
            No agents found.
          </div>
        ) : null}

        {filteredAgents.map((agent) => {
          const expanded = expandedAgentId === agent.id;
          const checklist = buildChecklist(agent);

          return (
            <div
              key={agent.id}
              className="glass"
              style={{
                padding: 16,
                border: expanded ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {agent.display_name || 'Unnamed Agent'}
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 14 }}>
                    {agent.email || 'No email'} · {agent.tierName}
                  </div>
                </div>

                <button
                  type="button"
                  className={expanded ? 'btn btn-primary' : 'btn btn-ghost'}
                  onClick={() => setExpandedAgentId(expanded ? null : agent.id)}
                >
                  {expanded ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {expanded ? (
                <>
                  <div
                    className="top-gap"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12
                    }}
                  >
                    {checklist.rules.recordingsWeekly > 0 ? (
                      <ChecklistBadge
                        label="Recordings"
                        current={checklist.recordingsThisWeek}
                        target={checklist.rules.recordingsWeekly}
                        passed={checklist.recordingsPassed}
                        subtext="This week"
                      />
                    ) : null}

                    {checklist.rules.videosWeekly > 0 ? (
                      <ChecklistBadge
                        label="Videos"
                        current={checklist.videosThisWeek}
                        target={checklist.rules.videosWeekly}
                        passed={checklist.videosPassed}
                        subtext="This week"
                      />
                    ) : null}

                    {checklist.rules.leadPacksMonthlyStay > 0 ? (
                      <ChecklistBadge
                        label="Lead Packs"
                        current={checklist.proofsThisMonth}
                        target={checklist.rules.leadPacksMonthlyStay}
                        passed={checklist.leadStayPassed}
                        subtext="This month to stay"
                      />
                    ) : null}

                    {checklist.rules.leadPacksMonthlyAdvance > 0 ? (
                      <ChecklistBadge
                        label="Advance"
                        current={checklist.proofsThisMonth}
                        target={checklist.rules.leadPacksMonthlyAdvance}
                        passed={checklist.leadAdvancePassed}
                        subtext="This month to advance"
                      />
                    ) : null}
                  </div>

                  <div
                    className="top-gap"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12
                    }}
                  >
                    <SummaryBox
                      title="Videos"
                      value={agent.videos.length}
                      subtext="Open reels by week or month"
                      onClick={() => openModal(agent.id, 'videos')}
                    />

                    <SummaryBox
                      title="Recordings"
                      value={agent.recordings.length}
                      subtext="Open recordings by day, week, or month"
                      onClick={() => openModal(agent.id, 'recordings')}
                    />

                    <SummaryBox
                      title="Lead Pack Proofs"
                      value={agent.proofs.length}
                      subtext="Open uploaded screenshots"
                      onClick={() => openModal(agent.id, 'proofs')}
                    />

                    <SummaryBox
                      title="KPI"
                      value={agent.kpi.length}
                      subtext="Reference only"
                      onClick={() => openModal(agent.id, 'kpi')}
                    />
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <Modal
        open={activeModal?.type === 'videos' && !!selectedAgent}
        title={`${selectedAgent?.display_name || 'Agent'} · Videos`}
        onClose={closeModal}
        controls={
          <select value={videosView} onChange={(e) => setVideosView(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        }
      >
        {!groupedVideos.length ? (
          <div className="glass" style={{ padding: 14 }}>
            No videos found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groupedVideos.map((group) => (
              <div
                key={group.key}
                className="glass"
                style={{ padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                  {videosView === 'weekly' ? `Week of ${formatDate(group.key)}` : formatDate(group.key)} · {group.items.length}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
                        Submitted {formatDate(item.created_at)}
                      </div>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={activeModal?.type === 'recordings' && !!selectedAgent}
        title={`${selectedAgent?.display_name || 'Agent'} · Recordings`}
        onClose={closeModal}
        controls={
          <select value={recordingsView} onChange={(e) => setRecordingsView(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        }
      >
        {!groupedRecordings.length ? (
          <div className="glass" style={{ padding: 14 }}>
            No recordings found.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: activeRecordingForNotes ? 'minmax(0, 1.4fr) minmax(340px, 0.9fr)' : '1fr',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groupedRecordings.map((group) => (
                <div
                  key={group.key}
                  className="glass"
                  style={{ padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                    {recordingsView === 'weekly'
                      ? `Week of ${formatDate(group.key)}`
                      : formatDate(group.key)}{' '}
                    · {group.items.length}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {group.items.map((item) => {
                      const leadName = item.leads
                        ? `${item.leads.first_name || ''} ${item.leads.last_name || ''}`.trim()
                        : '';
                      const unreadCount = getUnreadCount(item.id);
                      const totalNotes = (notesByRecording[item.id] || []).length;

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.08)'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            {leadName || item.leads?.phone || (item.uploaded_manually ? 'Manual upload' : 'No lead attached')}
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.75, margin: '4px 0 8px' }}>
                            {item.file_name || 'Recording'} · {formatDate(item.recorded_for_date || item.created_at)}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <a href={item.recording_url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                            <audio controls preload="none" src={item.recording_url} style={{ maxWidth: 280 }} />
                            <button type="button" className="btn btn-ghost btn-small" onClick={() => openRecordingNotes(item)}>
                              Notes {totalNotes > 0 ? `(${totalNotes})` : ''}{unreadCount > 0 ? ` • ${unreadCount} new` : ''}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {activeRecordingForNotes ? (
              <RecordingNotesPanel
                recording={activeRecordingForNotes}
                notes={activeRecordingNotes}
                currentUserId={currentUserId}
                draft={recordingNoteDraft}
                setDraft={setRecordingNoteDraft}
                sending={sendingRecordingNote}
                onSend={sendRecordingNote}
              />
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={activeModal?.type === 'proofs' && !!selectedAgent}
        title={`${selectedAgent?.display_name || 'Agent'} · Lead Pack Proofs`}
        onClose={closeModal}
        controls={
          <select value={proofsView} onChange={(e) => setProofsView(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        }
      >
        {!groupedProofs.length ? (
          <div className="glass" style={{ padding: 14 }}>
            No lead pack proofs found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groupedProofs.map((group) => (
              <div
                key={group.key}
                className="glass"
                style={{ padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                  {proofsView === 'weekly' ? `Week of ${formatDate(group.key)}` : formatDate(group.key)} · {group.items.length}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12
                  }}
                >
                  {group.items.map((item) => (
                    <a
                      key={item.id}
                      href={item.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="glass"
                      style={{
                        padding: 10,
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <img
                        src={item.image_url}
                        alt="Lead pack proof"
                        style={{
                          width: '100%',
                          height: 180,
                          objectFit: 'cover',
                          borderRadius: 10,
                          marginBottom: 8
                        }}
                      />
                      <div style={{ fontSize: 13, opacity: 0.75 }}>
                        Uploaded {formatDate(item.created_at)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={activeModal?.type === 'kpi' && !!selectedAgent}
        title={`${selectedAgent?.display_name || 'Agent'} · KPI`}
        onClose={closeModal}
        controls={
          <select value={kpiView} onChange={(e) => setKpiView(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        }
      >
        {!groupedKpiRows.length ? (
          <div className="glass" style={{ padding: 14 }}>
            No KPI found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groupedKpiRows.map((row) => (
              <div
                key={row.key}
                className="glass"
                style={{
                  padding: 14,
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                  {kpiView === 'weekly' ? `Week of ${formatDate(row.key)}` : formatDate(row.key)}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10
                  }}
                >
                  <div className="glass" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Dials</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{row.dials}</div>
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Contacts</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{row.contacts}</div>
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Sits</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{row.sits}</div>
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Sales</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{row.sales}</div>
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Premium Submitted</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{currency(row.premium_submitted)}</div>
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>AP Sold</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{currency(row.ap_sold)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
                  {row.rows} KPI entr{row.rows === 1 ? 'y' : 'ies'} in this period
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
