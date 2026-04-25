import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const COURSE_VIDEO_COUNT = 10;

function statusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'pending_review') return 'Pending Review';
  if (status === 'returned') return 'Returned';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function CourseProgress() {
  const [rows, setRows] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const [returnNote, setReturnNote] = useState('');
  const [manualStep, setManualStep] = useState('');

  async function ensureStatusesForAgents(profileRows, existingStatuses) {
    const existingAgentIds = new Set((existingStatuses || []).map((row) => row.agent_id));
    const missingProfiles = (profileRows || []).filter((profile) => !existingAgentIds.has(profile.id));

    if (!missingProfiles.length) return;

    const inserts = missingProfiles.map((profile) => ({
      agent_id: profile.id,
      status: 'not_started',
      current_step: 0
    }));

    await supabase.from('agent_course_status').insert(inserts);
  }

  async function load() {
    setMessage('');

    const [{ data: profileRows, error: profileError }, { data: statusRows, error: statusError }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, email, is_admin, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('agent_course_status')
          .select('*')
          .order('updated_at', { ascending: false })
      ]);

    if (profileError) {
      setMessage(profileError.message || 'Could not load agents.');
      return;
    }

    if (statusError) {
      setMessage(statusError.message || 'Could not load course statuses.');
      return;
    }

    await ensureStatusesForAgents(profileRows || [], statusRows || []);

    const [{ data: refreshedStatuses }, { data: videoProgress }] = await Promise.all([
      supabase.from('agent_course_status').select('*').order('updated_at', { ascending: false }),
      supabase.from('agent_course_video_progress').select('*')
    ]);

    const profilesById = {};
    for (const profile of profileRows || []) {
      profilesById[profile.id] = profile;
    }

    const merged = (refreshedStatuses || []).map((status) => ({
      ...status,
      profile: profilesById[status.agent_id] || null
    }));

    setRows(merged);
    setProgressRows(videoProgress || []);
  }

  useEffect(() => {
    load();
  }, []);

  const completedByAgent = useMemo(() => {
    const map = {};

    for (const row of progressRows || []) {
      if (!row.completed) continue;
      map[row.agent_id] = Number(map[row.agent_id] || 0) + 1;
    }

    return map;
  }, [progressRows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const profile = row.profile || {};
      const text = [
        profile.display_name,
        profile.email,
        row.status,
        row.returned_note,
        row.final_recording_note
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!text.includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;

      return true;
    });
  }, [rows, search, statusFilter]);

  async function approve(row) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const { error } = await supabase
      .from('agent_course_status')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: session?.user?.id || null,
        returned_note: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);

    if (error) {
      setMessage(error.message || 'Could not approve.');
      return;
    }

    await writeAdminLog({
      action: 'Approved new agent course',
      targetType: 'agent_course_status',
      targetId: row.id,
      details: {
        agent_id: row.agent_id,
        agent: row.profile?.display_name || row.profile?.email || null
      }
    });

    setSelectedRow(null);
    setMessage('Agent approved.');
    await load();
  }

  async function returnCourse(row) {
    if (!returnNote.trim()) {
      setMessage('Add a return note first.');
      return;
    }

    const { error } = await supabase
      .from('agent_course_status')
      .update({
        status: 'returned',
        returned_note: returnNote.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);

    if (error) {
      setMessage(error.message || 'Could not return course.');
      return;
    }

    await writeAdminLog({
      action: 'Returned new agent course',
      targetType: 'agent_course_status',
      targetId: row.id,
      details: {
        agent_id: row.agent_id,
        note: returnNote.trim()
      }
    });

    setReturnNote('');
    setSelectedRow(null);
    setMessage('Course returned.');
    await load();
  }

  async function setStep(row) {
    const step = Math.max(0, Math.min(10, Number(manualStep || 0)));

    const updates = [];

    for (let i = 0; i < step; i += 1) {
      updates.push({
        agent_id: row.agent_id,
        video_index: i,
        completed: true,
        watched_seconds: 0,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (updates.length) {
      await supabase.from('agent_course_video_progress').upsert(updates, {
        onConflict: 'agent_id,video_index'
      });
    }

    const { error } = await supabase
      .from('agent_course_status')
      .update({
        current_step: step,
        status: row.status === 'approved' ? 'approved' : step > 0 ? 'in_progress' : 'not_started',
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);

    if (error) {
      setMessage(error.message || 'Could not set step.');
      return;
    }

    await writeAdminLog({
      action: 'Manually changed course step',
      targetType: 'agent_course_status',
      targetId: row.id,
      details: {
        agent_id: row.agent_id,
        step
      }
    });

    setManualStep('');
    setSelectedRow(null);
    setMessage('Course step updated.');
    await load();
  }

  const columns = [
    {
      key: 'agent',
      label: 'Agent',
      render: (_value, row) => (
        <div>
          <div style={{ fontWeight: 800 }}>
            {row.profile?.display_name || 'Unnamed Agent'}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>{row.profile?.email || 'No email'}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => statusLabel(value)
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (_value, row) => {
        const completed = completedByAgent[row.agent_id] || 0;
        const percent = Math.round((completed / COURSE_VIDEO_COUNT) * 100);

        return `${completed}/${COURSE_VIDEO_COUNT} videos · ${percent}%`;
      }
    },
    {
      key: 'current_step',
      label: 'Current Step',
      render: (value) => Number(value || 0)
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      render: (value) => formatDate(value)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_value, row) => (
        <button
          className="btn btn-primary btn-small"
          type="button"
          onClick={() => {
            setSelectedRow(row);
            setReturnNote(row.returned_note || '');
            setManualStep(String(row.current_step || 0));
          }}
        >
          Review
        </button>
      )
    }
  ];

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
          <h1>Course Progress</h1>
          <p>Track new agent course progress, approve final submissions, or return with notes.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 220px',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Agent, email, note, or status..."
            />
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_review">Pending Review</option>
              <option value="returned">Returned</option>
              <option value="approved">Approved</option>
            </select>
          </label>
        </div>

        {message ? <div className="top-gap">{message}</div> : null}
      </div>

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <DataTable columns={columns} rows={filteredRows} />
      </div>

      {selectedRow ? (
        <div
          onClick={() => setSelectedRow(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 96vw)',
              maxHeight: '88vh',
              overflow: 'auto',
              padding: 20
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              {selectedRow.profile?.display_name || selectedRow.profile?.email || 'Agent'}
            </h2>

            <div className="grid grid-3">
              <div className="glass" style={{ padding: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Status</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {statusLabel(selectedRow.status)}
                </div>
              </div>

              <div className="glass" style={{ padding: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Videos</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {completedByAgent[selectedRow.agent_id] || 0}/{COURSE_VIDEO_COUNT}
                </div>
              </div>

              <div className="glass" style={{ padding: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Current Step</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {selectedRow.current_step || 0}
                </div>
              </div>
            </div>

            <div className="glass top-gap" style={{ padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Final Submission</h3>

              {selectedRow.final_recording_url ? (
                <audio controls src={selectedRow.final_recording_url} style={{ width: '100%' }} />
              ) : (
                <div style={{ opacity: 0.75 }}>No recording uploaded.</div>
              )}

              {selectedRow.final_recording_note ? (
                <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                  {selectedRow.final_recording_note}
                </div>
              ) : null}
            </div>

            <div className="glass top-gap" style={{ padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Manual Step Override</h3>
              <p style={{ opacity: 0.75 }}>
                Use this to skip yourself or an agent forward while testing. Step 10 unlocks the final voice recording.
              </p>

              <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                <label style={{ minWidth: 180 }}>
                  Step
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={manualStep}
                    onChange={(e) => setManualStep(e.target.value)}
                  />
                </label>

                <button className="btn btn-primary" type="button" onClick={() => setStep(selectedRow)}>
                  Set Step
                </button>
              </div>
            </div>

            <div className="glass top-gap" style={{ padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Return Note</h3>
              <textarea
                rows={4}
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Tell them what to fix..."
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                marginTop: 16,
                flexWrap: 'wrap'
              }}
            >
              <button className="btn btn-ghost" type="button" onClick={() => setSelectedRow(null)}>
                Close
              </button>

              <button className="btn btn-danger" type="button" onClick={() => returnCourse(selectedRow)}>
                Return With Note
              </button>

              <button className="btn btn-primary" type="button" onClick={() => approve(selectedRow)}>
                Approve & Unlock
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
