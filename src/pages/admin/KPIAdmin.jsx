import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../lib/utils';

export default function KPIAdmin() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('kpi_entries')
        .select('*, profiles(display_name)')
        .order('entry_date', { ascending: false })
        .limit(200);

      setRows(data || []);
    }

    load();
  }, []);

  const columns = [
    {
      key: 'profiles',
      label: 'Agent',
      render: (_v, row) => row.profiles?.display_name || '—'
    },
    { key: 'entry_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'dials', label: 'Dials' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'sits', label: 'Sits' },
    { key: 'sales', label: 'Sales' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>KPI Admin</h1>
          <p>Review submitted KPI history across agents.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
