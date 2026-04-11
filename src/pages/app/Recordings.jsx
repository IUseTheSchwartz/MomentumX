import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../lib/utils';

export default function Recordings() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('daily');

  useEffect(() => {
    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from('lead_recordings')
        .select('*, leads(first_name,last_name)')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false });

      setRows(data || []);
    }

    load();
  }, []);

  const grouped = useMemo(() => {
    return rows.map((row) => {
      const d = new Date(row.created_at);
      let groupLabel = row.created_at;

      if (view === 'weekly') {
        const copy = new Date(d);
        const day = copy.getDay();
        const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
        copy.setDate(diff);
        groupLabel = copy.toISOString().slice(0, 10);
      }

      if (view === 'monthly') {
        groupLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      }

      return {
        ...row,
        group_label: groupLabel
      };
    });
  }, [rows, view]);

  const columns = [
    {
      key: 'group_label',
      label: view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month',
      render: (v) => formatDate(v)
    },
    {
      key: 'leads',
      label: 'Lead',
      render: (_v, row) =>
        row.leads
          ? `${row.leads.first_name || ''} ${row.leads.last_name || ''}`.trim()
          : 'No lead attached'
    },
    { key: 'file_name', label: 'Recording' },
    {
      key: 'recording_url',
      label: 'Audio',
      render: (v) => (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={v} target="_blank" rel="noreferrer">
            Open
          </a>
          <a href={v} download>
            Download
          </a>
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (v) => formatDate(v)
    }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Recordings</h1>
          <p>Stored sit recordings by day, week, and month.</p>
        </div>

        <div className="segmented">
          <button className={view === 'daily' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('daily')}>
            Daily
          </button>
          <button className={view === 'weekly' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('weekly')}>
            Weekly
          </button>
          <button className={view === 'monthly' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('monthly')}>
            Monthly
          </button>
        </div>
      </div>

      <DataTable columns={columns} rows={grouped} />
    </div>
  );
}
