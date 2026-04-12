import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { currency, formatDate } from '../../lib/utils';

function getWeekStart(dateValue) {
  const date = new Date(dateValue);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

function getMonthStart(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function groupRecordings(rows, view) {
  const map = new Map();

  for (const row of rows || []) {
    const key =
      view === 'daily'
        ? new Date(row.created_at).toISOString().slice(0, 10)
        : view === 'weekly'
          ? getWeekStart(row.created_at)
          : getMonthStart(row.created_at);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(row);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      items
    }));
}

function groupLinks(rows, view) {
  const map = new Map();

  for (const row of rows || []) {
    const createdAt = row.created_at || new Date().toISOString();
    const key =
      view === 'weekly'
        ? getWeekStart(createdAt)
        : getMonthStart(createdAt);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(row);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      items
    }));
}

function groupKpi(rows, view) {
  const map = new Map();

  for (const row of rows || []) {
    const key =
      view === 'daily'
        ? row.entry_date
        : view === 'weekly'
          ? getWeekStart(row.entry_date)
          : getMonthStart(row.entry_date);

    if (!map.has(key)) {
      map.set(key, {
        key,
        dials: 0,
        contacts: 0,
        sits: 0,
        sales: 0,
        premium_submitted: 0,
        ap_sold: 0
      });
    }

    const current = map.get(key);
    current.dials += Number(row.dials || 0);
    current.contacts += Number(row.contacts || 0);
    current.sits += Number(row.sits || 0);
    current.sales += Number(row.sales || 0);
    current.premium_submitted += Number(row.premium_submitted || 0);
    current.ap_sold += Number(row.ap_sold || 0);
  }

  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function matchesSearch(agent, query) {
  if (!query) return true;

  const text = [
    agent.display_name,
    agent.email,
    agent.discord_username,
    agent.tiers?.name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

export default function AgentsRequirements() {
  const [agents, setAgents] = useState([]);
  const [recordingsByAgent, setRecordingsByAgent] = useState({});
  const [kpiByAgent, setKpiByAgent] = useState({});
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [recordingsView, setRecordingsView] = useState('weekly');
  const [linksView, setLinksView] = useState('weekly');
  const [kpiView, setKpiView] = useState('weekly');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [
        { data: profileRows, error: profileError },
        { data: recordingRows, error: recordingError },
        { data: kpiRows, error: kpiError }
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, tiers(name)')
          .order('display_name', { ascending: true }),
        supabase
          .from('lead_recordings')
          .select('*, leads(first_name,last_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('kpi_entries')
          .select('*')
          .order('entry_date', { ascending: false })
      ]);

      if (profileError) {
        console.error(profileError);
      }

      if (recordingError) {
        console.error(recordingError);
      }

      if (kpiError) {
        console.error(kpiError);
      }

      const safeAgents = profileRows || [];
      const safeRecordings = recordingRows || [];
      const safeKpi = kpiRows || [];

      const nextRecordingsByAgent = safeRecordings.reduce((acc, row) => {
        const agentId = row.agent_id;
        if (!acc[agentId]) acc[agentId] = [];
        acc[agentId].push(row);
        return acc;
      }, {});

      const nextKpiByAgent = safeKpi.reduce((acc, row) => {
        const agentId = row.agent_id;
        if (!acc[agentId]) acc[agentId] = [];
        acc[agentId].push(row);
        return acc;
      }, {});

      setAgents(safeAgents);
      setRecordingsByAgent(nextRecordingsByAgent);
      setKpiByAgent(nextKpiByAgent);
      setLoading(false);
    }

    load();
  }, []);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => matchesSearch(agent, search));
  }, [agents, search]);

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
          <h1>Agents Requirements</h1>
          <p>Review recordings, requirement links, and KPI by agent.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Agent name, email, tier..."
            />
          </label>

          <label>
            Recordings View
            <select value={recordingsView} onChange={(e) => setRecordingsView(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label>
            Links View
            <select value={linksView} onChange={(e) => setLinksView(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label>
            KPI View
            <select value={kpiView} onChange={(e) => setKpiView(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
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
          const isOpen = expandedAgentId === agent.id;
          const agentRecordings = recordingsByAgent[agent.id] || [];
          const agentKpi = kpiByAgent[agent.id] || [];
          const agentLinks = Array.isArray(agent.requirements_links)
            ? agent.requirements_links
            : [];

          const groupedRecordings = groupRecordings(agentRecordings, recordingsView);
          const groupedLinks = groupLinks(agentLinks, linksView);
          const groupedKpi = groupKpi(agentKpi, kpiView);

          return (
            <div key={agent.id} className="glass" style={{ padding: 16 }}>
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
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {agent.display_name || 'Unnamed Agent'}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 14 }}>
                    {agent.email || 'No email'} · {agent.tiers?.name || 'No Tier'}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-small"
                  type="button"
                  onClick={() => setExpandedAgentId(isOpen ? null : agent.id)}
                >
                  {isOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {isOpen ? (
                <div
                  className="top-gap"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 12
                  }}
                >
                  <div className="glass" style={{ padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Recordings</h3>

                    {!groupedRecordings.length ? (
                      <div>No recordings found.</div>
                    ) : (
                      groupedRecordings.map((group) => (
                        <div key={group.key} style={{ marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            {formatDate(group.key)} ({group.items.length})
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  padding: 10,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: 10
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>
                                  {item.leads
                                    ? `${item.leads.first_name || ''} ${item.leads.last_name || ''}`.trim() || 'No lead attached'
                                    : 'No lead attached'}
                                </div>
                                <div style={{ fontSize: 13, opacity: 0.8 }}>
                                  {item.file_name || 'Unnamed recording'} · {formatDate(item.created_at)}
                                </div>
                                <div className="top-gap">
                                  <a href={item.recording_url} target="_blank" rel="noreferrer">
                                    Open Recording
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Submitted Links</h3>

                    {!groupedLinks.length ? (
                      <div>No links submitted.</div>
                    ) : (
                      groupedLinks.map((group) => (
                        <div key={group.key} style={{ marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            {formatDate(group.key)} ({group.items.length})
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {group.items.map((item, index) => (
                              <div
                                key={`${group.key}-${index}`}
                                style={{
                                  padding: 10,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: 10
                                }}
                              >
                                <div style={{ fontSize: 13, opacity: 0.8 }}>
                                  {formatDate(item.created_at)}
                                </div>
                                <a href={item.url} target="_blank" rel="noreferrer">
                                  {item.url}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="glass" style={{ padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>KPI</h3>

                    {!groupedKpi.length ? (
                      <div>No KPI found.</div>
                    ) : (
                      groupedKpi.map((row) => (
                        <div
                          key={row.key}
                          style={{
                            padding: 10,
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                            marginBottom: 10
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            {formatDate(row.key)}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                            <div>Dials: {row.dials}</div>
                            <div>Contacts: {row.contacts}</div>
                            <div>Sits: {row.sits}</div>
                            <div>Sales: {row.sales}</div>
                            <div>Premium: {currency(row.premium_submitted)}</div>
                            <div>AP Sold: {currency(row.ap_sold)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
