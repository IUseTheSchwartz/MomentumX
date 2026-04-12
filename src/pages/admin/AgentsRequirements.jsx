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

function getWeekKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);

  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(
    copy.getDate()
  ).padStart(2, '0')}`;
}

function getMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function groupRecordings(rows, view) {
  const grouped = new Map();

  for (const row of rows || []) {
    const key =
      view === 'daily'
        ? getLocalDateKey(row.created_at)
        : view === 'weekly'
          ? getWeekKey(row.created_at)
          : getMonthKey(row.created_at);

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

  const text = [agent.display_name, agent.email]
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

export default function AgentsRequirements() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeModal, setActiveModal] = useState(null);
  const [recordingsView, setRecordingsView] = useState('weekly');
  const [videosView, setVideosView] = useState('weekly');
  const [kpiView, setKpiView] = useState('weekly');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [{ data: profiles }, { data: recs }, { data: vids }, { data: kpi }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, email').order('display_name'),
      supabase
        .from('lead_recordings')
        .select('*, leads(first_name,last_name,phone)')
        .order('created_at', { ascending: false }),
      supabase.from('agent_videos').select('*').order('created_at', { ascending: false }),
      supabase.from('kpi_entries').select('*').order('entry_date', { ascending: false })
    ]);

    const grouped = (profiles || []).map((agent) => ({
      ...agent,
      recordings: (recs || []).filter((r) => r.agent_id === agent.id),
      videos: (vids || []).filter((v) => v.agent_id === agent.id),
      kpi: (kpi || []).filter((k) => k.agent_id === agent.id)
    }));

    setAgents(grouped);
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

  const groupedKpiRows = useMemo(() => {
    if (!selectedAgent || activeModal?.type !== 'kpi') return [];
    return groupKpi(selectedAgent.kpi, kpiView);
  }, [selectedAgent, activeModal, kpiView]);

  function openModal(agentId, type) {
    setActiveModal({ agentId, type });
  }

  function closeModal() {
    setActiveModal(null);
  }

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
          <p>Open each agent, then drill into videos, recordings, and KPI in separate views.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Agent name or email..."
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
                  <div style={{ opacity: 0.75, fontSize: 14 }}>{agent.email || 'No email'}</div>
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
                <div
                  className="top-gap"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
                    title="KPI"
                    value={agent.kpi.length}
                    subtext="Open KPI totals by day, week, or month"
                    onClick={() => openModal(agent.id, 'kpi')}
                  />
                </div>
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
                  {videosView === 'weekly' ? `Week of ${formatDate(group.key)}` : formatDate(group.key)} ·{' '}
                  {group.items.length}
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
                    : recordingsView === 'monthly'
                      ? formatDate(group.key)
                      : formatDate(group.key)}{' '}
                  · {group.items.length}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.items.map((item) => {
                    const leadName = item.leads
                      ? `${item.leads.first_name || ''} ${item.leads.last_name || ''}`.trim()
                      : '';

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
                          {leadName || item.leads?.phone || 'No lead attached'}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.75, margin: '4px 0 8px' }}>
                          {item.file_name || 'Recording'} · {formatDate(item.created_at)}
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <a href={item.recording_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                          <audio controls preload="none" src={item.recording_url} style={{ maxWidth: 280 }} />
                        </div>
                      </div>
                    );
                  })}
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
