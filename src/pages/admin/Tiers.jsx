import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

export default function Tiers() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tiers')
        .select('*')
        .order('sort_order');

      setRows(data || []);
    }

    load();
  }, []);

  const columns = [
    { key: 'name', label: 'Tier' },
    {
      key: 'duration_days',
      label: 'Duration',
      render: (value, row) => {
        if (row.manual_only) return 'Manual only';
        return value ? `${value} days` : '—';
      }
    },
    {
      key: 'manual_only',
      label: 'Placement',
      render: (value) => (value ? 'Admin only' : 'Automatic / duration-based')
    },
    {
      key: 'kpi_required',
      label: 'KPI Required',
      render: (value) => (value ? 'Yes' : 'No')
    },
    { key: 'description', label: 'Description' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tiers</h1>
          <p>Tier structure and placement rules.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
