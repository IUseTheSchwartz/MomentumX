import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function prettifyLabel(value) {
  if (value == null || value === '') return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTierLabel(value) {
  if (value == null || value === '') return 'No Tier';

  if (typeof value === 'object') {
    return (
      value.name ||
      value.label ||
      value.title ||
      value.tier_name ||
      value.display_name ||
      'Tier'
    );
  }

  return String(value);
}

function readableSummary(row) {
  const adminName = row.profiles?.display_name || row.profiles?.email || 'Someone';
  const details = row.details || {};
  const before = details.before || {};
  const patch = details.patch || {};
  const after = details.after || {};

  if (typeof details.summary === 'string' && details.summary.trim()) {
    return `${adminName} ${details.summary}`;
  }

  if (patch.tier_id !== undefined || before.tier_id !== undefined || after.tier_id !== undefined) {
    const fromTier =
      getTierLabel(
        before.tiers ||
          before.tier ||
          before.tier_name ||
          details.before_tier_name ||
          details.from_tier_name ||
          before.tier_id
      ) || 'No Tier';

    const toTier =
      getTierLabel(
        after.tiers ||
          after.tier ||
          after.tier_name ||
          details.after_tier_name ||
          details.to_tier_name ||
          patch.tier_name ||
          patch.tier ||
          patch.tier_id
      ) || 'No Tier';

    return `${adminName} changed agent tier from ${fromTier} to ${toTier}`;
  }

  if (row.action === 'Imported leads batch') {
    const total = details.total_uploaded ?? 'some';
    const category = details.lead_category ? `${details.lead_category} ` : '';
    const type = details.lead_type || 'lead';
    const batchName = details.batch_name ? ` into "${details.batch_name}"` : '';
    return `${adminName} imported ${total} ${category}${type} leads${batchName}`;
  }

  if (Object.keys(patch).length) {
    const changedFields = Object.keys(patch).map(prettifyLabel).join(', ');
    return `${adminName} ${String(row.action || 'made changes').toLowerCase()} (${changedFields})`;
  }

  if (row.action) {
    return `${adminName} ${String(row.action).charAt(0).toLowerCase()}${String(row.action).slice(1)}`;
  }

  return `${adminName} made an admin change`;
}

function matchesSearch(row, query) {
  if (!query) return true;
  const text = [
    readableSummary(row),
    row.action,
    row.target_type,
    row.target_id,
    row.profiles?.display_name,
    row.profiles?.email,
    JSON.stringify(row.details || {})
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

export default function Logs() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [pageSize, setPageSize] = useState('50');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('admin_logs')
        .select('*, profiles(display_name, email)')
        .order('created_at', { ascending: false });

      setRows(data || []);
    }

    load();
  }, []);

  const adminOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.profiles?.display_name || row.profiles?.email)
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => matchesSearch(row, search))
      .filter((row) => {
        if (adminFilter === 'all') return true;
        const name = row.profiles?.display_name || row.profiles?.email || '';
        return name === adminFilter;
      })
      .filter((row) => (actionFilter === 'all' ? true : row.action === actionFilter));
  }, [rows, search, adminFilter, actionFilter]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    return filteredRows.slice(0, Number(pageSize));
  }, [filteredRows, pageSize]);

  const columns = [
    {
      key: 'summary',
      label: 'Readable Change',
      render: (_v, row) => readableSummary(row)
    },
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
      label: 'Technical Details',
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
          <h1>Admin Logs</h1>
          <p>Track admin changes, who made them, and when they happened.</p>
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
              placeholder="Search logs..."
            />
          </label>

          <label>
            Admin
            <select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)}>
              <option value="all">All</option>
              {adminOptions.map((admin) => (
                <option key={admin} value={admin}>
                  {admin}
                </option>
              ))}
            </select>
          </label>

          <label>
            Action
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="all">All</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
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

        <div className="top-gap" style={{ fontSize: 14, opacity: 0.85 }}>
          Showing {visibleRows.length} of {filteredRows.length} matching logs
        </div>
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
