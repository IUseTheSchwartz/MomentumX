import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

function isManualTier(row) {
  return row.duration_days === null;
}

function tierHelpText(row) {
  const manual = isManualTier(row);

  if (!manual) {
    return `Auto-removes agent from this tier after ${row.duration_days || 30} days unless admin changes them first.`;
  }

  return 'No automatic expiration. Admin must manually upgrade, downgrade, or remove.';
}

export default function Tiers() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

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

  async function updateTier(id, patch, actionLabel = 'Updated tier') {
    setMessage('');
    const before = rows.find((row) => row.id === id) || null;

    const { error } = await supabase.from('tiers').update(patch).eq('id', id);

    if (error) {
      setMessage(error.message || 'Could not update tier.');
      return;
    }

    await writeAdminLog({
      action: actionLabel,
      targetType: 'tier',
      targetId: id,
      details: {
        before,
        patch
      }
    });

    setMessage('Tier updated.');
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
                updateTier(row.id, { duration_days: null }, 'Set tier to manual no-expiry');
              } else {
                updateTier(row.id, { duration_days: 30 }, 'Set tier to timed duration');
              }
            }}
          >
            <option value="timed">Timed</option>
            <option value="manual">Manual / No Auto Expiry</option>
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
              updateTier(
                row.id,
                { duration_days: Number(e.target.value || 30) },
                'Updated tier duration'
              )
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
            updateTier(row.id, { kpi_required: !value }, 'Toggled tier KPI required')
          }
          type="button"
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (value, row) => (
        <div>
          <div>{value || '—'}</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
            {tierHelpText(row)}
          </div>
        </div>
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
          <h1>Tiers</h1>
          <p>Edit tier duration and structure. Timed tiers auto-expire. Manual tiers do not.</p>
        </div>
      </div>

      {message ? (
        <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
          {message}
        </div>
      ) : null}

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
