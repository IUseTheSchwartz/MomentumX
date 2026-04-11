import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const leadTypes = ['Veteran', 'Trucker IUL', 'Mortgage', 'General IUL'];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export default function Agents() {
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
  const [pageSize, setPageSize] = useState('50');

  async function load() {
    const [{ data: profiles }, { data: tierRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, tiers(name, duration_days)')
        .order('created_at', { ascending: false }),
      supabase.from('tiers').select('id, name, duration_days').order('sort_order')
    ]);

    setRows(profiles || []);
    setTiers(tierRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateProfile(id, patch, actionLabel = 'Updated agent') {
    setMessage('');
    const before = rows.find((row) => row.id === id) || null;

    const { error } = await supabase.from('profiles').update(patch).eq('id', id);

    if (error) {
      setMessage(error.message || 'Could not update agent.');
      return;
    }

    await writeAdminLog({
      action: actionLabel,
      targetType: 'profile',
      targetId: id,
      details: {
        before,
        patch
      }
    });

    setMessage('Agent updated.');
    load();
  }

  function toggleLeadType(row, type) {
    const current = Array.isArray(row.allowed_lead_types) ? row.allowed_lead_types : [];
    const next = current.includes(type)
      ? current.filter((x) => x !== type)
      : [...current, type];

    updateProfile(row.id, { allowed_lead_types: next }, 'Updated allowed lead types');
  }

  function handleTierChange(row, nextTierId) {
    const patch = nextTierId
      ? {
          tier_id: nextTierId,
          tier_assigned_at: new Date().toISOString()
        }
      : {
          tier_id: null,
          tier_assigned_at: null
        };

    updateProfile(row.id, patch, 'Changed agent tier');
  }

  const filteredRows = useMemo(() => {
    let next = rows.filter((row) => {
      const text = [
        row.display_name,
        row.email,
        row.discord_username,
        row.tiers?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(search.toLowerCase());
    });

    if (tierFilter !== 'all') {
      if (tierFilter === 'none') {
        next = next.filter((row) => !row.tier_id);
      } else {
        next = next.filter((row) => row.tier_id === tierFilter);
      }
    }

    if (eligibilityFilter === 'eligible') {
      next = next.filter((row) => !row.leads_paused && !row.lead_access_banned);
    } else if (eligibilityFilter === 'paused') {
      next = next.filter((row) => row.leads_paused);
    } else if (eligibilityFilter === 'banned') {
      next = next.filter((row) => row.lead_access_banned);
    }

    return next;
  }, [rows, search, tierFilter, eligibilityFilter]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    return filteredRows.slice(0, Number(pageSize));
  }, [filteredRows, pageSize]);

  const columns = [
    { key: 'display_name', label: 'Agent' },
    { key: 'email', label: 'Email' },
    {
      key: 'tiers',
      label: 'Tier',
      render: (_value, row) => row.tiers?.name || 'No Tier'
    },
    {
      key: 'tier_assigned_at',
      label: 'Tier Assigned',
      render: (value) => formatDate(value)
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
          onChange={(e) => handleTierChange(row, e.target.value || null)}
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
          <h1>Agents</h1>
          <p>Manage eligibility, lead-type access, and manual tier placement.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Agent name or email..."
            />
          </label>

          <label>
            Tier
            <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="none">No Tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Eligibility
            <select value={eligibilityFilter} onChange={(e) => setEligibilityFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="eligible">Eligible</option>
              <option value="paused">Paused</option>
              <option value="banned">Ineligible</option>
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

        {message ? <div className="top-gap">{message}</div> : null}
      </div>

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <DataTable columns={columns} rows={visibleRows} />
      </div>
    </div>
  );
}
