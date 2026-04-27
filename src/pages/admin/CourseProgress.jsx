import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const COURSE_VIDEOS = [
  'Intro',
  'Why People Fail',
  'Anyone Can Do It',
  'What Is an IUL and Where to Go',
  'How to Get Paid + Day to Day as an Agent',
  'Paid Leads',
  'Cameras on Video',
  'Chargebacks',
  'Final Voice Note Instructions'
];

const COURSE_VIDEO_COUNT = COURSE_VIDEOS.length;

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
  const [agents, setAgents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const [returnNote, setReturnNote] = useState('');
  const [selectedVideos, setSelectedVideos] = useState(new Set());

  async function load() {
    setMessage('');

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_admin, created_at, course_override_complete')
      .eq('is_admin', false)
      .order('created_at', { ascending: false });

    if (profileError) {
      setMessage(profileError.message || 'Could not load agents.');
      return;
    }

    const agentIds = (profileRows || []).map((agent) => agent.id);

    if (!agentIds.length) {
      setAgents([]);
      setStatuses([]);
      setProgressRows([]);
      return;
    }

    const { data: existingStatuses, error: statusError } = await supabase
      .from('agent_course_status')
      .select('*')
      .in('agent_id', agentIds);

    if (statusError) {
      setMessage(statusError.message || 'Could not load course statuses.');
      return;
    }

    const existingStatusIds = new Set((existingStatuses || []).map((row) => row.agent_id));
    const missingAgents = (profileRows || []).filter((agent) => !existingStatusIds.has(agent.id));

    if (missingAgents.length) {
      const inserts = missingAgents.map((agent) => ({
        agent_id: agent.id,
        status: 'not_started',
        current_step: 0
      }));

      const { error: insertError } = await supabase.from('agent_course_status').insert(inserts);

      if (insertError) {
        setMessage(insertError.message || 'Could not create missing course statuses.');
        return;
      }
    }

    const [{ data: freshStatuses, error: freshStatusError }, { data: freshProgress, error: progressError }] =
      await Promise.all([
        supabase.from('agent_course_status').select('*').in('agent_id', agentIds),
        supabase.from('agent_course_video_progress').select('*').in('agent_id', agentIds)
      ]);

    if (freshStatusError) {
      setMessage(freshStatusError.message || 'Could not refresh statuses.');
      return;
    }

    if (progressError) {
      setMessage(progressError.message || 'Could not load video progress.');
      return;
    }

    setAgents(profileRows || []);
    setStatuses(freshStatuses || []);
    setProgressRows(freshProgress || []);
  }

  useEffect(() => {
    load();
  }, []);

  const statusByAgent = useMemo(() => {
    const map = {};
    for (const row of statuses || []) {
      map[row.agent_id] = row;
    }
    return map;
  }, [statuses]);

  const progressByAgent = useMemo(() => {
    const map = {};

    for (const row of progressRows || []) {
      if (!map[row.agent_id]) map[row.agent_id] = {};
      map[row.agent_id][Number(row.video_index)] = row;
    }

    return map;
  }, [progressRows]);

  const tableRows = useMemo(() => {
    return (agents || []).map((agent) => {
      const status = statusByAgent[agent.id] || {
        agent_id: agent.id,
        status: 'not_started',
        current_step: 0
      };

      const progressMap = progressByAgent[agent.id] || {};
      const completedCount = COURSE_VIDEOS.reduce((count, _video, index) => {
        return count + (progressMap[index]?.completed ? 1 : 0);
      }, 0);

      return {
        ...status,
        agent_id: agent.id,
        profile: agent,
        completedCount,
        progressMap,
        status: agent.course_override_complete ? 'approved' : status.status || 'not_started'
      };
    });
  }, [agents, statusByAgent, progressByAgent]);

  const filteredRows = useMemo(() => {
    return tableRows.filter((row) => {
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
  }, [tableRows, search, statusFilter]);

  function openReview(row) {
    const nextSelected = new Set();

    COURSE_VIDEOS.forEach((_video, index) => {
      if (row.progressMap?.[index]?.completed) {
        nextSelected.add(index);
      }
    });

    setSelectedRow(row);
    setReturnNote(row.returned_note || '');
    setSelectedVideos(nextSelected);
  }

  function toggleVideo(index) {
    setSelectedVideos((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectFirstVideos(count) {
    const next = new Set();
    for (let i = 0; i < count; i += 1) next.add(i);
    setSelectedVideos(next);
  }

  async function saveVideoOverrides(row) {
    const now = new Date().toISOString();
    const selectedIndexes = Array.from(selectedVideos).sort((a, b) => a - b);
    const currentProgress = progressByAgent[row.agent_id] || {};

    const upserts = COURSE_VIDEOS.map((_video, index) => {
      const shouldComplete = selectedVideos.has(index);
      const oldRow = currentProgress[index];

      return {
        agent_id: row.agent_id,
        video_index: index,
        completed: shouldComplete,
        watched_seconds: shouldComplete
          ? Math.max(Number(oldRow?.watched_seconds || 0), 9999)
          : Number(oldRow?.watched_seconds || 0),
        completed_at: shouldComplete ? oldRow?.completed_at || now : null,
        updated_at: now
      };
    });

    const { error: progressError } = await supabase
      .from('agent_course_video_progress')
      .upsert(upserts, { onConflict: 'agent_id,video_index' });

    if (progressError) {
      setMessage(progressError.message || 'Could not save video overrides.');
      return;
    }

    let currentStep = 0;
    for (let i = 0; i < COURSE_VIDEO_COUNT; i += 1) {
      if (selectedVideos.has(i)) currentStep = i + 1;
      else break;
    }

    const nextStatus =
      row.status === 'approved'
        ? 'approved'
        : currentStep >= COURSE_VIDEO_COUNT
          ? 'in_progress'
          : currentStep > 0
            ? 'in_progress'
            : 'not_started';

    const { error: statusError } = await supabase
      .from('agent_course_status')
      .upsert(
        {
          agent_id: row.agent_id,
          current_step: currentStep,
          status: nextStatus,
          updated_at: now
        },
        { onConflict: 'agent_id' }
      );

    if (statusError) {
      setMessage(statusError.message || 'Could not update course status.');
      return;
    }

    await writeAdminLog({
      action: 'Updated course video overrides',
      targetType: 'agent_course_status',
      targetId: row.id || row.agent_id,
      details: {
        agent_id: row.agent_id,
        agent: row.profile?.display_name || row.profile?.email || null,
        completed_video_numbers: selectedIndexes.map((index) => index + 1),
        current_step: currentStep
      }
    });

    setSelectedRow(null);
    setMessage('Video overrides saved.');
    await load();
  }

  async function approve(row) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('agent_course_status')
      .upsert(
        {
          agent_id: row.agent_id,
          status: 'approved',
          current_step: COURSE_VIDEO_COUNT,
          approved_at: now,
          approved_by: session?.user?.id || null,
          returned_note: null,
          updated_at: now
        },
        { onConflict: 'agent_id' }
      );

    if (error) {
      setMessage(error.message || 'Could not approve.');
      return;
    }

    await writeAdminLog({
      action: 'Approved new agent course',
      targetType: 'agent_course_status',
      targetId: row.id || row.agent_id,
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
      .upsert(
        {
          agent_id: row.agent_id,
          status: 'returned',
          returned_note: returnNote.trim(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'agent_id' }
      );

    if (error) {
      setMessage(error.message || 'Could not return course.');
      return;
    }

    await writeAdminLog({
      action: 'Returned new agent course',
      targetType: 'agent_course_status',
      targetId: row.id || row.agent_id,
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

  const columns = [
    {
      key: 'agent',
      label: 'Agent',
      render: (_value, row) => (
        <div>
          <div style={{ fontWeight: 800 }}>{row.profile?.display_name || 'Unnamed Agent'}</div>
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
        const percent = Math.round((Number(row.completedCount || 0) / COURSE_VIDEO_COUNT) * 100);
        return `${row.completedCount}/${COURSE_VIDEO_COUNT} videos · ${percent}%`;
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
        <button className="btn btn-primary btn-small" type="button" onClick={() => openReview(row)}>
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
          <p>Track course progress from the new video progress table and override exact videos.</p>
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

      <div className="top-gap" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
              width: 'min(900px, 96vw)',
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
                <div style={{ fontSize: 13, opacity: 0.75 }}>Selected Complete</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {selectedVideos.size}/{COURSE_VIDEO_COUNT}
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
              <h3 style={{ marginTop: 0 }}>Video Overrides</h3>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <button className="btn btn-ghost btn-small" type="button" onClick={() => setSelectedVideos(new Set())}>
                  Clear All
                </button>
                <button className="btn btn-ghost btn-small" type="button" onClick={() => selectFirstVideos(1)}>
                  Complete 1
                </button>
                <button className="btn btn-ghost btn-small" type="button" onClick={() => selectFirstVideos(3)}>
                  Complete 1–3
                </button>
                <button className="btn btn-ghost btn-small" type="button" onClick={() => selectFirstVideos(7)}>
                  Complete 1–7
                </button>
                <button className="btn btn-ghost btn-small" type="button" onClick={() => selectFirstVideos(COURSE_VIDEO_COUNT)}>
                  Complete All Videos
                </button>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {COURSE_VIDEOS.map((title, index) => {
                  const checked = selectedVideos.has(index);
                  const progress = selectedRow.progressMap?.[index];

                  return (
                    <label
                      key={title}
                      className="glass"
                      style={{
                        padding: 12,
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        border: checked
                          ? '1px solid rgba(16,185,129,0.45)'
                          : '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVideo(index)}
                        style={{ width: 18, height: 18 }}
                      />

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800 }}>
                          {index + 1}. {title}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          Stored: {progress?.completed ? 'Complete' : 'Not complete'} · Watched:{' '}
                          {Number(progress?.watched_seconds || 0)}s
                        </div>
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {checked ? 'Will be complete' : 'Will be incomplete'}
                      </div>
                    </label>
                  );
                })}
              </div>

              <button className="btn btn-primary top-gap" type="button" onClick={() => saveVideoOverrides(selectedRow)}>
                Save Video Overrides
              </button>
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
