import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function Logs() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('admin_logs')
        .select('*, profiles(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(300);

      setRows(data || []);
    }

    load();
  }, []);

  const columns = [
    {
      key: 'profiles',
      label: 'Admin',
      render: (_v, row) => row.profiles?.display_name || row.profiles?.email || 'Unknown'
    },
    { key: 'action', label: 'Action' },
    { key: 'target_type', label: 'Target Type' },
    { key: 'target_id', label: 'Target ID' },
    {
      key: 'details',
      label: 'Details',
      render: (value) => (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {JSON.stringify(value || {}, null, 2)}
        </pre>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value) => formatDate(value)
    }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin Logs</h1>
          <p>Track admin changes, who made them, and when they happened.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
