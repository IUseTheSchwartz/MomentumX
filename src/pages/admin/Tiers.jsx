import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

function isManualTier(row) {
  return row.slug === 'tier-2' || row.slug === 'tier-3' || row.duration_days === null;
}

export default function Tiers() {
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await supabase
      .from('tiers')
      .select('*')
      .order('sort_order');

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateTier(id, patch) {
    await supabase.from('tiers').update(patch).eq('id', id);
    load();
  }

  const columns = [
    { key: 'name', label: 'Tier' },

    {
      key: 'duration_mode',
      label: 'Duration Type',
      render: (_value, row) => {
        const manual = isManualTier(row);

        return (
          <select
            value={manual ? 'manual' : 'timed'}
            onChange={(e) => {
              const next = e.target.value;

              if (next === 'manual') {
                updateTier(row.id, { duration_days: null });
              } else {
                updateTier(row.id, { duration_days: 30 });
              }
            }}
          >
            <option value="timed">Timed</option>
            <option value="manual">No Duration / Manual</option>
          </select>
        );
      }
    },

    {
      key: 'duration_days',
      label: 'Duration',
      render: (value, row) => {
        const manual = isManualTier(row);

        if (manual) {
          return <span>None</span>;
        }

        return (
          <input
            type="number"
            min="1"
            value={value || 30}
            onChange={(e) =>
              updateTier(row.id, {
                duration_days: Number(e.target.value || 30)
              })
            }
            style={{ width: 90 }}
          />
        );
      }
    },

    {
      key: 'kpi_required',
      label: 'KPI Required',
      render: (value, row) => (
        <button
          className="btn btn-ghost btn-small"
          onClick={() =>
            updateTier(row.id, { kpi_required: !value })
          }
          type="button"
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },

    { key: 'description', label: 'Description' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tiers</h1>
          <p>Edit tier duration and structure.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
