import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../lib/utils';

const blank = {
  lead_id: '',
  recording_url: '',
  file_name: ''
};

export default function Recordings() {
  const [rows, setRows] = useState([]);
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState(blank);

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const [{ data: recs }, { data: leadRows }] = await Promise.all([
      supabase
        .from('lead_recordings')
        .select('*, leads(first_name,last_name)')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('leads')
        .select('id, first_name, last_name')
        .eq('assigned_to', session.user.id)
        .order('created_at', { ascending: false })
        .limit(200)
    ]);

    setRows(recs || []);
    setLeads(leadRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    await supabase.from('lead_recordings').insert({
      agent_id: session.user.id,
      lead_id: form.lead_id || null,
      recording_url: form.recording_url,
      file_name: form.file_name || 'Recording'
    });

    setForm(blank);
    load();
  }

  const columns = [
    {
      key: 'leads',
      label: 'Lead',
      render: (_value, row) =>
        row.leads
          ? `${row.leads.first_name || ''} ${row.leads.last_name || ''}`.trim()
          : 'No lead attached'
    },
    { key: 'file_name', label: 'Name' },
    {
      key: 'recording_url',
      label: 'Recording',
      render: (v) => (
        <a href={v} target="_blank" rel="noreferrer">
          Open
        </a>
      )
    },
    { key: 'created_at', label: 'Created', render: (v) => formatDate(v) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Recordings</h1>
          <p>Attach recordings to leads and review your history.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Lead
            <select value={form.lead_id} onChange={(e) => setForm((s) => ({ ...s, lead_id: e.target.value }))}>
              <option value="">No lead attached</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.first_name} {lead.last_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Recording Name
            <input value={form.file_name} onChange={(e) => setForm((s) => ({ ...s, file_name: e.target.value }))} />
          </label>

          <label>
            Recording URL
            <input
              value={form.recording_url}
              onChange={(e) => setForm((s) => ({ ...s, recording_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Save Recording
        </button>
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
