import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../lib/utils';

function startOfWeek(dateValue = new Date()) {
  const date = new Date(dateValue);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setHours(0, 0, 0, 0);
  date.setDate(diff);
  return date;
}

function endOfWeek(dateValue = new Date()) {
  const date = startOfWeek(dateValue);
  date.setDate(date.getDate() + 7);
  return date;
}

function groupLabelForView(dateValue, view) {
  const d = new Date(dateValue);

  if (view === 'weekly') {
    return startOfWeek(d).toISOString().slice(0, 10);
  }

  if (view === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  return d.toISOString().slice(0, 10);
}

function parseRequirementsJson(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  const requiredRecordingsPerWeek = Number(
    raw.required_recordings_per_week ??
    raw.recordings_per_week ??
    raw.weekly_recordings_required ??
    0
  );

  const requiredVideoLinksPerWeek = Number(
    raw.required_video_links_per_week ??
    raw.videos_per_week ??
    raw.weekly_videos_required ??
    0
  );

  return {
    checklist,
    requiredRecordingsPerWeek: Number.isFinite(requiredRecordingsPerWeek)
      ? requiredRecordingsPerWeek
      : 0,
    requiredVideoLinksPerWeek: Number.isFinite(requiredVideoLinksPerWeek)
      ? requiredVideoLinksPerWeek
      : 0
  };
}

function getChecklistLabel(item, index) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    return item.label || item.title || item.name || `Requirement ${index + 1}`;
  }
  return `Requirement ${index + 1}`;
}

export default function Requirements() {
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [kpiRows, setKpiRows] = useState([]);
  const [links, setLinks] = useState([]);
  const [view, setView] = useState('weekly');
  const [form, setForm] = useState({
    title: '',
    url: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    setSessionUserId(session.user.id);

    const weekStart = startOfWeek();
    const weekEnd = endOfWeek();

    const [
      { data: profileRow },
      { data: recordingRows },
      { data: kpiEntryRows },
      { data: linkRows }
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, tiers(id, name, requirements_json)')
        .eq('id', session.user.id)
        .maybeSingle(),
      supabase
        .from('lead_recordings')
        .select('id, file_name, recording_url, created_at')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('kpi_entries')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('entry_date', { ascending: false }),
      supabase
        .from('agent_requirement_links')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false })
    ]);

    const currentWeekRecordings = (recordingRows || []).filter((row) => {
      const createdAt = new Date(row.created_at);
      return createdAt >= weekStart && createdAt < weekEnd;
    });

    setProfile(profileRow || null);
    setRecordings(currentWeekRecordings || []);
    setKpiRows(kpiEntryRows || []);
    setLinks(linkRows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const parsedRequirements = useMemo(() => {
    return parseRequirementsJson(profile?.tiers?.requirements_json);
  }, [profile]);

  const groupedLinks = useMemo(() => {
    return (links || []).map((row) => ({
      ...row,
      group_label: groupLabelForView(row.created_at, view)
    }));
  }, [links, view]);

  const groupedKpi = useMemo(() => {
    const map = new Map();

    for (const row of kpiRows || []) {
      const key = groupLabelForView(row.entry_date, view);

      if (!map.has(key)) {
        map.set(key, {
          group_label: key,
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

    return Array.from(map.values()).sort((a, b) =>
      b.group_label.localeCompare(a.group_label)
    );
  }, [kpiRows, view]);

  const thisWeekCounts = useMemo(() => {
    const weekStart = startOfWeek();
    const weekEnd = endOfWeek();

    const videoLinksThisWeek = (links || []).filter((row) => {
      const createdAt = new Date(row.created_at);
      return createdAt >= weekStart && createdAt < weekEnd;
    }).length;

    return {
      recordings: recordings.length,
      videoLinks: videoLinksThisWeek
    };
  }, [links, recordings]);

  async function addLink(e) {
    e.preventDefault();
    if (!sessionUserId) return;

    const cleanTitle = form.title.trim();
    const cleanUrl = form.url.trim();
    const cleanNotes = form.notes.trim();

    if (!cleanTitle || !cleanUrl) {
      setMessage('Title and link are required.');
      return;
    }

    setSaving(true);
    setMessage('');

    const { error } = await supabase.from('agent_requirement_links').insert({
      agent_id: sessionUserId,
      title: cleanTitle,
      url: cleanUrl,
      notes: cleanNotes || null
    });

    if (error) {
      setMessage(error.message || 'Could not save link.');
      setSaving(false);
      return;
    }

    setForm({
      title: '',
      url: '',
      notes: ''
    });

    setMessage('Video link saved.');
    setSaving(false);
    load();
  }

  async function deleteLink(id) {
    if (!id) return;

    const { error } = await supabase
      .from('agent_requirement_links')
      .delete()
      .eq('id', id);

    if (error) {
      setMessage(error.message || 'Could not delete link.');
      return;
    }

    setMessage('Video link removed.');
    load();
  }

  if (loading) {
    return <div className="page-center">Loading requirement checklist...</div>;
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
          <h1>Requirement Checklist</h1>
          <p>
            Tier requirements, weekly progress, submitted links, recordings, and KPI in one place.
          </p>
        </div>
      </div>

      <div
        className="grid grid-4"
        style={{ flexShrink: 0 }}
      >
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Current Tier</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {profile?.tiers?.name || 'No Tier'}
          </div>
        </div>

        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Weekly Recordings</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {thisWeekCounts.recordings} / {parsedRequirements.requiredRecordingsPerWeek || 0}
          </div>
        </div>

        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Weekly Video Links</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {thisWeekCounts.videoLinks} / {parsedRequirements.requiredVideoLinksPerWeek || 0}
          </div>
        </div>

        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Checklist Items</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {parsedRequirements.checklist.length}
          </div>
        </div>
      </div>

      <div className="top-gap glass" style={{ padding: 16, flexShrink: 0 }}>
        <h2 style={{ marginTop: 0 }}>Tier Checklist</h2>

        {parsedRequirements.checklist.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {parsedRequirements.checklist.map((item, index) => (
              <div
                key={`${getChecklistLabel(item, index)}-${index}`}
                style={{
                  padding: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12
                }}
              >
                {getChecklistLabel(item, index)}
              </div>
            ))}
          </div>
        ) : (
          <div>No checklist items set on this tier yet.</div>
        )}
      </div>

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div className="glass" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Submit Required Video Link</h2>

            <form onSubmit={addLink} style={{ display: 'grid', gap: 10 }}>
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Example: Objection handling video"
                />
              </label>

              <label>
                URL
                <input
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://..."
                />
              </label>

              <label>
                Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional note"
                />
              </label>

              {message ? (
                <div style={{ fontSize: 14, opacity: 0.85 }}>{message}</div>
              ) : null}

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Link'}
              </button>
            </form>
          </div>

          <div className="glass" style={{ padding: 16, minHeight: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                marginBottom: 12
              }}
            >
              <h2 style={{ margin: 0 }}>Submitted Video Links</h2>

              <div className="segmented">
                <button
                  className={view === 'daily' ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setView('daily')}
                  type="button"
                >
                  Daily
                </button>
                <button
                  className={view === 'weekly' ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setView('weekly')}
                  type="button"
                >
                  Weekly
                </button>
                <button
                  className={view === 'monthly' ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setView('monthly')}
                  type="button"
                >
                  Monthly
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {groupedLinks.length ? (
                groupedLinks.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      padding: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                      {view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month'}:{' '}
                      {formatDate(row.group_label)}
                    </div>
                    <div style={{ fontWeight: 700 }}>{row.title}</div>
                    <div style={{ marginTop: 6 }}>
                      <a href={row.url} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    </div>
                    {row.notes ? (
                      <div style={{ marginTop: 8, opacity: 0.85 }}>{row.notes}</div>
                    ) : null}
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
                      Added {formatDate(row.created_at)}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => deleteLink(row.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div>No submitted links yet.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div className="glass" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>This Week Recordings</h2>

            <div style={{ display: 'grid', gap: 10 }}>
              {recordings.length ? (
                recordings.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      padding: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{row.file_name || 'Recording'}</div>
                    <div style={{ marginTop: 6 }}>
                      <a href={row.recording_url} target="_blank" rel="noreferrer">
                        Open recording
                      </a>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
                      {formatDate(row.created_at)}
                    </div>
                  </div>
                ))
              ) : (
                <div>No recordings saved this week.</div>
              )}
            </div>
          </div>

          <div className="glass" style={{ padding: 16, minHeight: 0 }}>
            <h2 style={{ marginTop: 0 }}>KPI Summary</h2>

            <div style={{ display: 'grid', gap: 10 }}>
              {groupedKpi.length ? (
                groupedKpi.map((row) => (
                  <div
                    key={row.group_label}
                    style={{
                      padding: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month'}:{' '}
                      {formatDate(row.group_label)}
                    </div>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                      <div>Dials: {row.dials}</div>
                      <div>Contacts: {row.contacts}</div>
                      <div>Sits: {row.sits}</div>
                      <div>Sales: {row.sales}</div>
                      <div>Premium: {Number(row.premium_submitted || 0).toLocaleString()}</div>
                      <div>AP: {Number(row.ap_sold || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div>No KPI entries yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
