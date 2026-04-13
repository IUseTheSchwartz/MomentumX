// src/pages/admin/ReplacementRequests.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../lib/utils';
import { writeAdminLog } from '../../lib/adminLog';

const replacementLeadTypes = ['Veteran', 'Trucker IUL', 'Mortgage', 'General IUL'];
const replacementCategories = ['aged', 'fresh'];

function formatDateOnly(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function matchesSearch(request, originalLead, agentProfile, query) {
  if (!query) return true;

  const text = [
    request.reason,
    request.status,
    request.admin_note,
    originalLead?.first_name,
    originalLead?.last_name,
    originalLead?.phone,
    originalLead?.email,
    originalLead?.lead_type,
    originalLead?.lead_category,
    originalLead?.beneficiary_name,
    originalLead?.military_branch,
    agentProfile?.full_name,
    agentProfile?.email
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

export default function ReplacementRequests() {
  const [requests, setRequests] = useState([]);
  const [leadsById, setLeadsById] = useState({});
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [actionDrafts, setActionDrafts] = useState({});

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const { data: requestRows, error: requestError } = await supabase
        .from('lead_replacement_requests')
        .select('*')
        .order('requested_at', { ascending: false })
        .order('id', { ascending: false });

      if (requestError) throw requestError;

      const safeRequests = requestRows || [];
      setRequests(safeRequests);

      const leadIds = Array.from(
        new Set(
          safeRequests
            .flatMap((row) => [row.original_lead_id, row.replacement_lead_id])
            .filter(Boolean)
        )
      );

      const profileIds = Array.from(
        new Set(
          safeRequests
            .flatMap((row) => [row.agent_id, row.reviewed_by])
            .filter(Boolean)
        )
      );

      const [leadResponse, profileResponse] = await Promise.all([
        leadIds.length
          ? supabase.from('leads').select('*').in('id', leadIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase.from('profiles').select('*').in('id', profileIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (leadResponse.error) throw leadResponse.error;
      if (profileResponse.error) throw profileResponse.error;

      const nextLeadsById = {};
      for (const lead of leadResponse.data || []) {
        nextLeadsById[lead.id] = lead;
      }

      const nextProfilesById = {};
      for (const profile of profileResponse.data || []) {
        nextProfilesById[profile.id] = profile;
      }

      setLeadsById(nextLeadsById);
      setProfilesById(nextProfilesById);
    } catch (error) {
      console.error('Failed to load replacement requests:', error);
      setMessage(error.message || 'Failed to load replacement requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function getDraft(requestId) {
    return (
      actionDrafts[requestId] || {
        replacementType: 'Veteran',
        replacementCategory: 'aged',
        adminNote: ''
      }
    );
  }

  function setDraft(requestId, patch) {
    setActionDrafts((prev) => ({
      ...prev,
      [requestId]: {
        ...getDraft(requestId),
        ...patch
      }
    }));
  }

  async function acceptRequest(request) {
    const draft = getDraft(request.id);

    setBusyRequestId(request.id);
    setMessage('');

    try {
      const { data: replacementLeadId, error } = await supabase.rpc(
        'admin_accept_lead_replacement_request',
        {
          p_request_id: request.id,
          p_replacement_lead_type: draft.replacementType,
          p_replacement_lead_category: draft.replacementCategory,
          p_admin_note: draft.adminNote || null
        }
      );

      if (error) throw error;

      await writeAdminLog({
        action: 'Accepted lead replacement request',
        targetType: 'lead_replacement_request',
        targetId: request.id,
        details: {
          original_lead_id: request.original_lead_id,
          replacement_lead_id: replacementLeadId,
          replacement_type: draft.replacementType,
          replacement_category: draft.replacementCategory,
          admin_note: draft.adminNote || null
        }
      });

      setMessage('Replacement request accepted and replacement lead assigned.');
      await load();
    } catch (error) {
      console.error('Failed to accept replacement request:', error);
      setMessage(error.message || 'Failed to accept replacement request.');
    } finally {
      setBusyRequestId(null);
    }
  }

  async function denyRequest(request) {
    const draft = getDraft(request.id);

    setBusyRequestId(request.id);
    setMessage('');

    try {
      const { error } = await supabase.rpc('admin_deny_lead_replacement_request', {
        p_request_id: request.id,
        p_admin_note: draft.adminNote || null
      });

      if (error) throw error;

      await writeAdminLog({
        action: 'Denied lead replacement request',
        targetType: 'lead_replacement_request',
        targetId: request.id,
        details: {
          original_lead_id: request.original_lead_id,
          admin_note: draft.adminNote || null
        }
      });

      setMessage('Replacement request denied.');
      await load();
    } catch (error) {
      console.error('Failed to deny replacement request:', error);
      setMessage(error.message || 'Failed to deny replacement request.');
    } finally {
      setBusyRequestId(null);
    }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const originalLead = leadsById[request.original_lead_id] || null;
      const agentProfile = profilesById[request.agent_id] || null;

      if (!matchesSearch(request, originalLead, agentProfile, search)) return false;
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (leadTypeFilter !== 'all' && originalLead?.lead_type !== leadTypeFilter) return false;
      if (categoryFilter !== 'all' && originalLead?.lead_category !== categoryFilter) return false;

      return true;
    });
  }, [requests, leadsById, profilesById, search, statusFilter, leadTypeFilter, categoryFilter]);

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
          <h1>Replacement Requests</h1>
          <p>Review lead replacement requests, approve or deny them, and assign a matching replacement lead.</p>
        </div>
      </div>

      {message ? (
        <div className="glass" style={{ padding: 12, marginBottom: 12, flexShrink: 0 }}>
          {message}
        </div>
      ) : null}

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
              placeholder="Agent, name, phone, reason..."
            />
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="denied">Denied</option>
            </select>
          </label>

          <label>
            Lead Type
            <select value={leadTypeFilter} onChange={(e) => setLeadTypeFilter(e.target.value)}>
              <option value="all">All</option>
              {replacementLeadTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fresh / Aged
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="fresh">Fresh</option>
              <option value="aged">Aged</option>
            </select>
          </label>
        </div>

        <div className="top-gap" style={{ fontSize: 14, opacity: 0.85 }}>
          Showing {filteredRequests.length} request{filteredRequests.length === 1 ? '' : 's'}
        </div>
      </div>

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          paddingRight: 4
        }}
      >
        {loading ? (
          <div className="glass" style={{ padding: 16 }}>
            Loading replacement requests...
          </div>
        ) : null}

        {!loading &&
          filteredRequests.map((request) => {
            const originalLead = leadsById[request.original_lead_id] || null;
            const replacementLead = request.replacement_lead_id
              ? leadsById[request.replacement_lead_id] || null
              : null;
            const agentProfile = profilesById[request.agent_id] || null;
            const reviewerProfile = request.reviewed_by
              ? profilesById[request.reviewed_by] || null
              : null;
            const draft = getDraft(request.id);
            const isPending = request.status === 'pending';

            return (
              <div key={request.id} className="lead-card glass" style={{ marginBottom: 12 }}>
                <div className="lead-top">
                  <div>
                    <div className="lead-name">
                      {originalLead?.first_name || '—'} {originalLead?.last_name || ''}
                    </div>
                    <div className="lead-meta">
                      {originalLead?.phone || 'No phone'} · {originalLead?.lead_type || '—'} ·{' '}
                      {originalLead?.lead_category || '—'} · Requested {formatDate(request.requested_at)}
                    </div>
                  </div>

                  <div className="lead-status-stack">
                    <span className="pill">{request.status}</span>
                    {request.status === 'accepted' ? <span className="pill success">Accepted</span> : null}
                    {request.status === 'denied' ? <span className="pill danger">Denied</span> : null}
                    {request.status === 'pending' ? <span className="pill">Pending Review</span> : null}
                  </div>
                </div>

                <div className="lead-extra">
                  <div className="lead-extra-item">
                    <strong>Agent:</strong>{' '}
                    {agentProfile?.full_name || agentProfile?.email || request.agent_id}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Email:</strong> {originalLead?.email || '—'}
                  </div>
                  <div className="lead-extra-item">
                    <strong>DOB:</strong> {formatDateOnly(originalLead?.dob)}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Beneficiary:</strong> {originalLead?.beneficiary_name || '—'}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Military Branch:</strong> {originalLead?.military_branch || '—'}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Current Lead Status:</strong> {originalLead?.status || '—'}
                  </div>
                </div>

                <div className="glass" style={{ padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Agent Reason</div>
                  <div>{request.reason || '—'}</div>
                </div>

                <div className="glass" style={{ padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Lead Notes</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{originalLead?.notes || '—'}</div>
                </div>

                {request.status !== 'pending' ? (
                  <div className="glass" style={{ padding: 12, marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Review Outcome</div>
                    <div>
                      <strong>Reviewed At:</strong> {formatDate(request.reviewed_at)}
                    </div>
                    <div>
                      <strong>Reviewed By:</strong>{' '}
                      {reviewerProfile?.full_name || reviewerProfile?.email || request.reviewed_by || '—'}
                    </div>
                    <div>
                      <strong>Admin Note:</strong> {request.admin_note || '—'}
                    </div>

                    {request.status === 'accepted' ? (
                      <>
                        <div>
                          <strong>Replacement Type:</strong> {request.accepted_replacement_type || '—'}
                        </div>
                        <div>
                          <strong>Replacement Category:</strong> {request.accepted_replacement_category || '—'}
                        </div>
                        <div>
                          <strong>Replacement Lead:</strong>{' '}
                          {replacementLead
                            ? `${replacementLead.first_name || '—'} ${replacementLead.last_name || ''} · ${replacementLead.phone || 'No phone'}`
                            : request.replacement_lead_id || '—'}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {isPending ? (
                  <div className="glass" style={{ padding: 12 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 10
                      }}
                    >
                      <label>
                        Replacement Lead Type
                        <select
                          value={draft.replacementType}
                          onChange={(e) =>
                            setDraft(request.id, { replacementType: e.target.value })
                          }
                          disabled={busyRequestId === request.id}
                        >
                          {replacementLeadTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Replacement Category
                        <select
                          value={draft.replacementCategory}
                          onChange={(e) =>
                            setDraft(request.id, { replacementCategory: e.target.value })
                          }
                          disabled={busyRequestId === request.id}
                        >
                          {replacementCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Admin Note
                        <input
                          value={draft.adminNote}
                          onChange={(e) =>
                            setDraft(request.id, { adminNote: e.target.value })
                          }
                          placeholder="Optional note"
                          disabled={busyRequestId === request.id}
                        />
                      </label>
                    </div>

                    <div
                      className="lead-actions"
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}
                    >
                      <button
                        className="btn btn-primary btn-small"
                        type="button"
                        onClick={() => acceptRequest(request)}
                        disabled={busyRequestId === request.id}
                      >
                        {busyRequestId === request.id ? 'Working...' : 'Accept & Assign Replacement'}
                      </button>

                      <button
                        className="btn btn-danger btn-small"
                        type="button"
                        onClick={() => denyRequest(request)}
                        disabled={busyRequestId === request.id}
                      >
                        {busyRequestId === request.id ? 'Working...' : 'Deny'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

        {!loading && !filteredRequests.length ? (
          <div className="glass" style={{ padding: 16 }}>
            No replacement requests found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
