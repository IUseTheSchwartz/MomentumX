import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate, currency } from '../../lib/utils';

export default function Leads() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      setRows(data || []);
    }

    load();
  }, []);

  const columns = [
    { key: 'first_name', label: 'First' },
    { key: 'last_name', label: 'Last' },
    { key: 'phone', label: 'Phone' },
    { key: 'lead_type', label: 'Lead Type' },
    { key: 'status', label: 'Status' },
    { key: 'call_count', label: 'Calls' },
    { key: 'ap_sold', label: 'AP Sold', render: (value) => currency(value) },
    { key: 'created_at', label: 'Created', render: (value) => formatDate(value) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Your assigned lead inventory.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
