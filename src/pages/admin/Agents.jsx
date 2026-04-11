import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const leadTypes = ['Veteran', 'Trucker IUL', 'Mortgage', 'General IUL'];

export default function Agents() {
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);

  async function load() {
    const [{ data: profiles }, { data: tierRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, tiers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('tiers').select('id, name').order('sort_order')
    ]);

    setRows(profiles || []);
    setTiers(tierRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateProfile(id, patch, actionLabel = 'Updated agent') {
    const before = rows.find((row) => row.id === id) || null;

    await supabase.from('profiles').update(patch).eq('id', id);

    await writeAdminLog({
      action: actionLabel,
      targetType: 'profile',
      targetId: id,
      details: {
        before,
        patch
      }
    });

    load();
  }

  function toggleLeadType(row, type) {
    const current = Array.isArray(row.allowed_lead_types) ? row.allowed_lead_types : [];
    const next = current.includes(type)
      ? current.filter((x) => x !== type)
      : [...current, type];

    updateProfile(row.id, { allowed_lead_types: next }, 'Updated allowed lead types');
  }

  const columns = [
    { key: 'display_name', label: 'Agent' },
    {
      key: 'tiers',
      label: 'Tier',
      render: (_value, row) => row.tiers?.name || '—'
    },
    {
      key: 'allowed_lead_types',
      label: 'Allowed Lead Types',
      render: (_value, row) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {leadTypes.map((type) => {
            const active = Array.isArray(row.allowed_lead_types)
              ? row.allowed_lead_types.includes(type)
              : false;

            return (
              <button
                key={type}
                className={active ? 'btn btn-primary btn-small' : 'btn btn-ghost btn-small'}
                onClick={() => toggleLeadType(row, type)}
                type="button"
              >
                {type}
              </button>
            );
          })}
        </div>
      )
    },
    {
      key: 'leads_paused',
      label: 'Paused',
      render: (value, row) => (
        <button
          className="btn btn-ghost btn-small"
          onClick={() =>
            updateProfile(row.id, { leads_paused: !value }, 'Toggled leads paused')
          }
          type="button"
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },
    {
      key: 'lead_access_banned',
      label: 'Ineligible',
      render: (value, row) => (
        <button
          className="btn btn-danger btn-small"
          onClick={() =>
            updateProfile(row.id, { lead_access_banned: !value }, 'Toggled lead ineligible')
          }
          type="button"
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },
    {
      key: 'id',
      label: 'Change Tier',
      render: (_value, row) => (
        <select
          value={row.tier_id || ''}
          onChange={(e) =>
            updateProfile(
              row.id,
              { tier_id: e.target.value || null },
              'Changed agent tier'
            )
          }
        >
          <option value="">No Tier</option>
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name}
            </option>
          ))}
        </select>
      )
    }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Agents</h1>
          <p>Manage eligibility, lead-type access, and manual tier placement.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
