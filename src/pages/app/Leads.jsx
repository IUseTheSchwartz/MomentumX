// src/pages/app/Leads.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { currency, formatDate } from '../../lib/utils';

const saleDefaults = {
  ap_sold: '',
  sale_date: new Date().toISOString().slice(0, 10),
  company_sold: '',
  product_sold: '',
  effective_date: '',
  notes: ''
};

const replacementDefaults = {
  reason: ''
};

function isSameLocalDay(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getVisibleCalledCount(row) {
  return isSameLocalDay(row.last_called_at) ? Number(row.call_count || 0) : 0;
}

function appendCallHistory(existingNotes, amount) {
  const stamp = new Date().toLocaleString();
  const entry = `[${stamp}] Marked called ${amount} time${amount === 1 ? '' : 's'}.`;
  const current = (existingNotes || '').trim();

  return current ? `${current}\n${entry}` : entry;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getStatusBucket(row) {
  if (row.sale) return 'sold';
  if (row.do_not_call) return 'dnc';
  if (row.sit) return 'sit';
  if (Number(getVisibleCalledCount(row)) > 0) return 'called';
  return 'new';
}

function getLeadAddressText(row) {
  return [row.address, row.city, row.state, row.zip].filter(Boolean).join(', ');
}

function matchesSearch(row, query) {
  if (!query) return true;

  const text = [
    row.first_name,
    row.last_name,
    row.phone,
    row.email,
    row.address,
    row.city,
    row.state,
    row.zip,
    row.lead_type,
    row.status,
    row.beneficiary_name,
    row.military_branch,
    row.dob
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

function formatDateOnly(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function csvEscape(value) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildCsv(rows) {
  const headers = [
    'First Name',
    'Last Name',
    'Phone',
    'Email',
    'Address',
    'City',
    'State',
    'ZIP',
    'DOB',
    'Military Branch',
    'Beneficiary',
    'Lead Type',
    'Lead Category',
    'Status',
    'Called Today',
    'Call Count',
    'Do Not Call',
    'Sit',
    'Sale',
    'AP Sold',
    'Sale Date',
    'Effective Date',
    'Company Sold',
    'Product Sold',
    'Notes',
    'Created At',
    'Assigned At',
    'Last Called At'
  ];

  const lines = [headers.map(csvEscape).join(',')];

  for (const row of rows) {
    const values = [
      row.first_name || '',
      row.last_name || '',
      row.phone || '',
      row.email || '',
      row.address || '',
      row.city || '',
      row.state || '',
      row.zip || '',
      row.dob || '',
      row.military_branch || '',
      row.beneficiary_name || '',
      row.lead_type || '',
      row.lead_category || '',
      row.status || '',
      getVisibleCalledCount(row),
      Number(row.call_count || 0),
      row.do_not_call ? 'Yes' : 'No',
      row.sit ? 'Yes' : 'No',
      row.sale ? 'Yes' : 'No',
      row.sale ? Number(row.ap_sold || 0) : '',
      row.sale ? row.sale_date || '' : '',
      row.sale ? row.effective_date || '' : '',
      row.sale ? row.company_sold || '' : '',
      row.sale ? row.product_sold || '' : '',
      row.notes || '',
      row.created_at || '',
      row.assigned_at || '',
      row.last_called_at || ''
    ];

    lines.push(values.map(csvEscape).join(','));
  }

  return lines.join('\n');
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function getRowReplacementRequest(row, requestsByLeadId) {
  return requestsByLeadId[row.id] || null;
}

function getReplacementBadge(request) {
  if (!request) return null;
  if (request.status === 'pending') return { label: 'Replacement Pending', className: 'pill' };
  if (request.status === 'accepted') return { label: 'Replacement Accepted', className: 'pill success' };
  if (request.status === 'denied') return { label: 'Replacement Denied', className: 'pill danger' };
  return null;
}

function compareLeadRows(a, b, sortOrder) {
  const aTime = new Date(a.created_at || 0).getTime();
  const bTime = new Date(b.created_at || 0).getTime();

  if (aTime !== bTime) {
    return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
  }

  const aId = String(a.id || '');
  const bId = String(b.id || '');

  return sortOrder === 'oldest' ? aId.localeCompare(bId) : bId.localeCompare(aId);
}

export default function Leads() {
  const [rows, setRows] = useState([]);
  const [replacementRequests, setReplacementRequests] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [replacementLead, setReplacementLead] = useState(null);

  const [saleForm, setSaleForm] = useState(saleDefaults);
  const [replacementForm, setReplacementForm] = useState(replacementDefaults);

  const [noteDrafts, setNoteDrafts] = useState({});
  const [callAmounts, setCallAmounts] = useState({});
  const [savingSale, setSavingSale] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [replacementError, setReplacementError] = useState('');
  const [savingReplacement, setSavingReplacement] = useState(false);

  const [busyLeadId, setBusyLeadId] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [exportMessage, setExportMessage] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [pageSize, setPageSize] = useState('50');

  const [selectedRecordingLeadId, setSelectedRecordingLeadId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [savingRecording, setSavingRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    setSessionUserId(session.user.id);

    const [leadsResponse, replacementResponse] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', session.user.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      supabase
        .from('lead_replacement_requests')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('requested_at', { ascending: false })
        .order('id', { ascending: false })
    ]);

    if (leadsResponse.error) {
      console.error('Failed to load leads:', leadsResponse.error);
      return;
    }

    if (replacementResponse.error) {
      console.error('Failed to load replacement requests:', replacementResponse.error);
    }

    setRows(leadsResponse.data || []);
    setReplacementRequests(replacementResponse.data || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function replaceRowLocally(id, patch) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function persistLeadPatch(id, patch) {
    let query = supabase.from('leads').update(patch).eq('id', id);

    if (sessionUserId) {
      query = query.eq('assigned_to', sessionUserId);
    }

    const { data, error } = await query.select('id').maybeSingle();

    if (error) throw error;

    if (!data?.id) {
      throw new Error('Lead update did not save. This lead may no longer be assigned to you.');
    }

    return data;
  }

  async function upsertKpiDelta(delta) {
    if (!sessionUserId) {
      throw new Error('No session found for KPI update.');
    }

    const entryDate = todayDateKey();

    const { data: existing, error: fetchError } = await supabase
      .from('kpi_entries')
      .select('*')
      .eq('agent_id', sessionUserId)
      .eq('entry_date', entryDate)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const patch = {
        dials: Number(existing.dials || 0) + Number(delta.dials || 0),
        contacts: Number(existing.contacts || 0) + Number(delta.contacts || 0),
        sits: Number(existing.sits || 0) + Number(delta.sits || 0),
        sales: Number(existing.sales || 0) + Number(delta.sales || 0),
        premium_submitted:
          Number(existing.premium_submitted || 0) + Number(delta.premium_submitted || 0),
        ap_sold: Number(existing.ap_sold || 0) + Number(delta.ap_sold || 0)
      };

      const { error: updateError } = await supabase
        .from('kpi_entries')
        .update(patch)
        .eq('id', existing.id);

      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabase.from('kpi_entries').insert({
      agent_id: sessionUserId,
      entry_date: entryDate,
      dials: Number(delta.dials || 0),
      contacts: Number(delta.contacts || 0),
      sits: Number(delta.sits || 0),
      sales: Number(delta.sales || 0),
      premium_submitted: Number(delta.premium_submitted || 0),
      ap_sold: Number(delta.ap_sold || 0)
    });

    if (insertError) throw insertError;
  }

  async function markCalled(row) {
    const selectedAmount = Math.max(1, Number(callAmounts[row.id] || 1));
    const visibleToday = getVisibleCalledCount(row);
    const nextVisibleCount = visibleToday + selectedAmount;

    const patch = {
      call_count: nextVisibleCount,
      status: `Called ${nextVisibleCount}x Today`,
      last_called_at: new Date().toISOString(),
      notes: appendCallHistory(row.notes, selectedAmount)
    };

    setBusyLeadId(row.id);

    try {
      await persistLeadPatch(row.id, patch);
      replaceRowLocally(row.id, patch);

      try {
        await upsertKpiDelta({ dials: selectedAmount });
      } catch (kpiError) {
        console.error('Lead saved but KPI failed:', kpiError);
        alert('Lead was saved, but KPI did not update.');
      }
    } catch (error) {
      console.error('Failed to mark called:', error);
      alert(error.message || 'Failed to mark lead as called.');
    } finally {
      setBusyLeadId(null);
    }
  }

  async function markDnc(row) {
    const patch = {
      do_not_call: true,
      status: 'Do Not Call'
    };

    setBusyLeadId(row.id);

    try {
      await persistLeadPatch(row.id, patch);
      replaceRowLocally(row.id, patch);

      try {
        await upsertKpiDelta({ contacts: 1 });
      } catch (kpiError) {
        console.error('Lead saved but KPI failed:', kpiError);
        alert('Lead was saved, but KPI did not update.');
      }
    } catch (error) {
      console.error('Failed to mark DNC:', error);
      alert(error.message || 'Failed to update lead.');
    } finally {
      setBusyLeadId(null);
    }
  }

  async function markSit(row) {
    const patch = {
      sit: true,
      status: 'Sit'
    };

    setBusyLeadId(row.id);

    try {
      await persistLeadPatch(row.id, patch);
      replaceRowLocally(row.id, patch);

      try {
        await upsertKpiDelta({ contacts: 1, sits: 1 });
      } catch (kpiError) {
        console.error('Lead saved but KPI failed:', kpiError);
        alert('Lead was saved, but KPI did not update.');
      }
    } catch (error) {
      console.error('Failed to mark sit:', error);
      alert(error.message || 'Failed to update lead.');
    } finally {
      setBusyLeadId(null);
    }
  }

  function openSale(row) {
    setActiveLead(row);
    setSaleError('');
    setSaleForm({
      ap_sold: row.ap_sold || '',
      sale_date: row.sale_date ? row.sale_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      company_sold: row.company_sold || '',
      product_sold: row.product_sold || '',
      effective_date: row.effective_date ? row.effective_date.slice(0, 10) : '',
      notes: row.notes || ''
    });
  }

  async function submitSale(e) {
    e.preventDefault();
    if (!activeLead) return;

    setSavingSale(true);
    setSaleError('');

    try {
      const apSold = Number(saleForm.ap_sold || 0);

      const patch = {
        sale: true,
        status: 'Sold',
        ap_sold: Number.isFinite(apSold) ? apSold : 0,
        sale_date: saleForm.sale_date || null,
        company_sold: saleForm.company_sold?.trim() || null,
        product_sold: saleForm.product_sold?.trim() || null,
        effective_date: saleForm.effective_date || null,
        notes: saleForm.notes?.trim() || null
      };

      await persistLeadPatch(activeLead.id, patch);
      replaceRowLocally(activeLead.id, patch);

      try {
        await upsertKpiDelta({
          contacts: 1,
          sales: 1,
          ap_sold: Number.isFinite(apSold) ? apSold : 0
        });
      } catch (kpiError) {
        console.error('Lead saved but KPI failed:', kpiError);
        setSaleError('Sale saved, but KPI did not update.');
      }

      setActiveLead(null);
      setSaleForm(saleDefaults);
    } catch (error) {
      console.error('Failed to save sale:', error);
      setSaleError(error.message || 'Failed to save sale.');
    } finally {
      setSavingSale(false);
    }
  }

  async function saveNotes(row) {
    const note = noteDrafts[row.id] ?? row.notes ?? '';
    setBusyLeadId(row.id);

    try {
      await persistLeadPatch(row.id, { notes: note });
      replaceRowLocally(row.id, { notes: note });
    } catch (error) {
      console.error('Failed to save notes:', error);
      alert(error.message || 'Failed to save notes.');
    } finally {
      setBusyLeadId(null);
    }
  }

  function openReplacementModal(row) {
    setReplacementLead(row);
    setReplacementError('');
    setReplacementForm({ reason: '' });
  }

  async function submitReplacementRequest(e) {
    e.preventDefault();

    if (!replacementLead || !sessionUserId) return;

    const trimmedReason = replacementForm.reason.trim();
    if (!trimmedReason) {
      setReplacementError('Please enter a reason for the replacement request.');
      return;
    }

    setSavingReplacement(true);
    setReplacementError('');

    try {
      const { data, error } = await supabase
        .from('lead_replacement_requests')
        .insert({
          original_lead_id: replacementLead.id,
          agent_id: sessionUserId,
          reason: trimmedReason
        })
        .select('*')
        .single();

      if (error) throw error;

      setReplacementRequests((prev) => [data, ...prev]);
      setReplacementLead(null);
      setReplacementForm(replacementDefaults);
    } catch (error) {
      console.error('Failed to request replacement:', error);
      setReplacementError(error.message || 'Failed to submit replacement request.');
    } finally {
      setSavingReplacement(false);
    }
  }

  async function startRecording() {
    try {
      setRecordingStatus('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingStatus('Recording...');
      };

      mediaRecorder.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingStatus(error.message || 'Could not start recording.');
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) return;
    if (!sessionUserId) {
      setRecordingStatus('No session found.');
      return;
    }

    setSavingRecording(true);

    try {
      const stoppedBlob = await new Promise((resolve, reject) => {
        const recorder = mediaRecorderRef.current;

        recorder.onstop = () => {
          try {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            resolve(blob);
          } catch (error) {
            reject(error);
          }
        };

        recorder.onerror = (event) => {
          reject(event?.error || new Error('Recording failed.'));
        };

        recorder.stop();
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const selectedLead = rows.find((row) => row.id === selectedRecordingLeadId) || null;
      const fileName = `recording-${sessionUserId}-${Date.now()}.webm`;
      const storagePath = `${sessionUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(storagePath, stoppedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'audio/webm'
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(storagePath);

      const recordingUrl = publicUrlData?.publicUrl || null;

      const { error: insertError } = await supabase.from('lead_recordings').insert({
        agent_id: sessionUserId,
        lead_id: selectedLead?.id || null,
        file_name: fileName,
        recording_url: recordingUrl
      });

      if (insertError) throw insertError;

      setRecordingStatus('Recording saved.');
    } catch (error) {
      console.error('Failed to save recording:', error);
      setRecordingStatus(error.message || 'Failed to save recording.');
    } finally {
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      setSavingRecording(false);
    }
  }

  function exportVisibleLeadsCsv() {
    const csvText = buildCsv(filteredRows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`momentumx-leads-${stamp}.csv`, csvText);
    setExportMessage(`Exported ${filteredRows.length} lead${filteredRows.length === 1 ? '' : 's'} as CSV.`);
    setTimeout(() => {
      setExportMessage('');
    }, 2500);
  }

  const leadTypeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.lead_type).filter(Boolean))).sort();
  }, [rows]);

  const requestsByLeadId = useMemo(() => {
    const next = {};
    for (const request of replacementRequests) {
      if (!request?.original_lead_id) continue;
      if (!next[request.original_lead_id]) {
        next[request.original_lead_id] = request;
      }
    }
    return next;
  }, [replacementRequests]);

  const filteredRows = useMemo(() => {
    const next = rows
      .filter((row) => matchesSearch(row, search))
      .filter((row) => (statusFilter === 'all' ? true : getStatusBucket(row) === statusFilter))
      .filter((row) => (leadTypeFilter === 'all' ? true : row.lead_type === leadTypeFilter))
      .filter((row) => (categoryFilter === 'all' ? true : row.lead_category === categoryFilter));

    next.sort((a, b) => compareLeadRows(a, b, sortOrder));

    return next;
  }, [rows, search, statusFilter, leadTypeFilter, categoryFilter, sortOrder]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    return filteredRows.slice(0, Number(pageSize));
  }, [filteredRows, pageSize]);

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
          <h1>Leads</h1>
          <p>Work leads, filter fast, record sold business properly, and request replacements when needed.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ minWidth: 220 }}>
            Attach Recording To
            <select
              value={selectedRecordingLeadId}
              onChange={(e) => setSelectedRecordingLeadId(e.target.value)}
              disabled={isRecording || savingRecording}
            >
              <option value="">No lead selected</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {`${row.first_name || ''} ${row.last_name || ''}`.trim() || row.phone || row.id}
                </option>
              ))}
            </select>
          </label>

          {!isRecording ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={startRecording}
              disabled={savingRecording}
            >
              Record
            </button>
          ) : (
            <button
              className="btn btn-danger"
              type="button"
              onClick={stopRecording}
              disabled={savingRecording}
            >
              {savingRecording ? 'Saving...' : 'Stop'}
            </button>
          )}

          <button
            className="btn btn-ghost"
            type="button"
            onClick={exportVisibleLeadsCsv}
            disabled={!filteredRows.length}
          >
            Download CSV
          </button>
        </div>
      </div>

      {recordingStatus ? (
        <div className="glass" style={{ padding: 12, flexShrink: 0, marginBottom: 12 }}>
          {recordingStatus}
        </div>
      ) : null}

      {exportMessage ? (
        <div className="glass" style={{ padding: 12, flexShrink: 0, marginBottom: 12 }}>
          {exportMessage}
        </div>
      ) : null}

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, email, city, state, ZIP..."
            />
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="called">Called</option>
              <option value="sit">Sit</option>
              <option value="sold">Sold</option>
              <option value="dnc">Do Not Call</option>
            </select>
          </label>

          <label>
            Lead Type
            <select value={leadTypeFilter} onChange={(e) => setLeadTypeFilter(e.target.value)}>
              <option value="all">All</option>
              {leadTypeOptions.map((type) => (
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

          <label>
            Sort
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
            </select>
          </label>

          <label>
            Show
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="1000">1000</option>
              <option value="all">Show All</option>
            </select>
          </label>
        </div>

        <div className="top-gap" style={{ fontSize: 14, opacity: 0.85 }}>
          Showing {visibleRows.length} of {filteredRows.length} matching leads
        </div>
      </div>

      <div
        className="lead-list top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          paddingRight: 4
        }}
      >
        {visibleRows.map((row) => {
          const visibleCalledCount = getVisibleCalledCount(row);
          const selectedCallAmount = Number(callAmounts[row.id] || 1);
          const replacementRequest = getRowReplacementRequest(row, requestsByLeadId);
          const replacementBadge = getReplacementBadge(replacementRequest);
          const disableReplacementButton =
            replacementRequest?.status === 'pending' || replacementRequest?.status === 'accepted';
          const addressText = getLeadAddressText(row);

          return (
            <div key={row.id} className="lead-card glass">
              <div className="lead-top">
                <div>
                  <div className="lead-name">
                    {row.first_name || '—'} {row.last_name || ''}
                  </div>
                  <div className="lead-meta">
                    {row.phone || 'No phone'} · {row.lead_type || '—'} · {row.lead_category || '—'} · Created {formatDate(row.created_at)}
                  </div>
                  {addressText ? (
                    <div className="lead-meta" style={{ marginTop: 4 }}>
                      {addressText}
                    </div>
                  ) : null}
                </div>

                <div className="lead-status-stack">
                  <span className="pill">{row.status || 'New'}</span>
                  <span className="pill muted">Called Today {visibleCalledCount}</span>
                  {row.sale ? <span className="pill success">Sold</span> : null}
                  {row.do_not_call ? <span className="pill danger">DNC</span> : null}
                  {replacementBadge ? (
                    <span className={replacementBadge.className}>{replacementBadge.label}</span>
                  ) : null}
                </div>
              </div>

              <div className="lead-extra">
                <div className="lead-extra-item">
                  <strong>Email:</strong> {row.email || '—'}
                </div>
                <div className="lead-extra-item">
                  <strong>Address:</strong> {row.address || '—'}
                </div>
                <div className="lead-extra-item">
                  <strong>City:</strong> {row.city || '—'}
                </div>
                <div className="lead-extra-item">
                  <strong>State:</strong> {row.state || '—'}
                </div>
                <div className="lead-extra-item">
                  <strong>ZIP:</strong> {row.zip || '—'}
                </div>
                <div className="lead-extra-item">
                  <strong>DOB:</strong> {formatDateOnly(row.dob)}
                </div>
                <div className="lead-extra-item">
                  <strong>Beneficiary:</strong> {row.beneficiary_name || '—'}
                </div>
                {row.lead_type === 'Veteran' ? (
                  <div className="lead-extra-item">
                    <strong>Military Branch:</strong> {row.military_branch || '—'}
                  </div>
                ) : null}
              </div>

              {replacementRequest ? (
                <div className="glass" style={{ padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Replacement Request: {replacementRequest.status}
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.9 }}>
                    <strong>Reason:</strong> {replacementRequest.reason || '—'}
                  </div>
                  {replacementRequest.admin_note ? (
                    <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                      <strong>Admin Note:</strong> {replacementRequest.admin_note}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div
                className="lead-actions"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={selectedCallAmount}
                    onChange={(e) =>
                      setCallAmounts((prev) => ({
                        ...prev,
                        [row.id]: Number(e.target.value)
                      }))
                    }
                  >
                    {Array.from({ length: 10 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <option key={value} value={value}>
                          {value}x
                        </option>
                      );
                    })}
                  </select>

                  <button
                    className="btn btn-ghost btn-small"
                    onClick={() => markCalled(row)}
                    disabled={busyLeadId === row.id}
                    type="button"
                  >
                    Mark Called
                  </button>
                </div>

                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => markSit(row)}
                  disabled={busyLeadId === row.id}
                  type="button"
                >
                  Sit
                </button>

                <button
                  className="btn btn-primary btn-small"
                  onClick={() => openSale(row)}
                  disabled={busyLeadId === row.id}
                  type="button"
                >
                  Sale
                </button>

                <button
                  className="btn btn-danger btn-small"
                  onClick={() => markDnc(row)}
                  disabled={busyLeadId === row.id}
                  type="button"
                >
                  Do Not Call
                </button>

                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => openReplacementModal(row)}
                  disabled={disableReplacementButton || busyLeadId === row.id}
                  type="button"
                >
                  {replacementRequest?.status === 'pending'
                    ? 'Replacement Pending'
                    : replacementRequest?.status === 'accepted'
                    ? 'Replacement Accepted'
                    : 'Request Replacement'}
                </button>
              </div>

              {row.sale ? (
                <div className="lead-extra">
                  <div className="lead-extra-item">
                    <strong>AP Sold:</strong> {currency(row.ap_sold || 0)}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Sale Date:</strong> {formatDate(row.sale_date)}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Effective Date:</strong> {formatDate(row.effective_date)}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Company:</strong> {row.company_sold || '—'}
                  </div>
                  <div className="lead-extra-item">
                    <strong>Product:</strong> {row.product_sold || '—'}
                  </div>
                </div>
              ) : null}

              <div className="lead-notes">
                <label>
                  Notes
                  <textarea
                    rows="3"
                    value={noteDrafts[row.id] ?? row.notes ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [row.id]: e.target.value
                      }))
                    }
                    placeholder="Add notes..."
                  />
                </label>

                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => saveNotes(row)}
                  disabled={busyLeadId === row.id}
                  type="button"
                >
                  Save Notes
                </button>
              </div>
            </div>
          );
        })}

        {!visibleRows.length ? (
          <div className="glass" style={{ padding: 16 }}>
            No leads match your filters.
          </div>
        ) : null}
      </div>

      {activeLead ? (
        <div className="modal-backdrop" onClick={() => setActiveLead(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Log Sale</h2>
            <p>
              {activeLead.first_name} {activeLead.last_name}
            </p>

            <form className="form" onSubmit={submitSale}>
              <div className="form-grid">
                <label>
                  AP Sold
                  <input
                    value={saleForm.ap_sold}
                    onChange={(e) => setSaleForm((s) => ({ ...s, ap_sold: e.target.value }))}
                  />
                </label>

                <label>
                  Sale Date
                  <input
                    type="date"
                    value={saleForm.sale_date}
                    onChange={(e) => setSaleForm((s) => ({ ...s, sale_date: e.target.value }))}
                  />
                </label>

                <label>
                  Company Sold
                  <input
                    value={saleForm.company_sold}
                    onChange={(e) => setSaleForm((s) => ({ ...s, company_sold: e.target.value }))}
                  />
                </label>

                <label>
                  Product Sold
                  <input
                    value={saleForm.product_sold}
                    onChange={(e) => setSaleForm((s) => ({ ...s, product_sold: e.target.value }))}
                  />
                </label>

                <label>
                  Effective Date
                  <input
                    type="date"
                    value={saleForm.effective_date}
                    onChange={(e) => setSaleForm((s) => ({ ...s, effective_date: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  rows="4"
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </label>

              {saleError ? (
                <div className="top-gap" style={{ color: '#ff6b6b' }}>
                  {saleError}
                </div>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setActiveLead(null)}
                  disabled={savingSale}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSale}>
                  {savingSale ? 'Saving...' : 'Save Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {replacementLead ? (
        <div className="modal-backdrop" onClick={() => setReplacementLead(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Request Replacement</h2>
            <p>
              {replacementLead.first_name} {replacementLead.last_name} · {replacementLead.lead_type || '—'} ·{' '}
              {replacementLead.lead_category || '—'}
            </p>

            <form className="form" onSubmit={submitReplacementRequest}>
              <label>
                Reason
                <textarea
                  rows="5"
                  value={replacementForm.reason}
                  onChange={(e) =>
                    setReplacementForm((s) => ({
                      ...s,
                      reason: e.target.value
                    }))
                  }
                  placeholder="Explain why this lead should be replaced..."
                />
              </label>

              {replacementError ? (
                <div className="top-gap" style={{ color: '#ff6b6b' }}>
                  {replacementError}
                </div>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setReplacementLead(null)}
                  disabled={savingReplacement}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingReplacement}>
                  {savingReplacement ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
