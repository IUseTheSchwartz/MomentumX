import { useEffect, useState } from 'react';
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

      <div
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
