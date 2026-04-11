import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../lib/utils';

function matchesSearch(row, query) {
  if (!query) return true;

  const text = [
    row.file_name,
    row.leads?.first_name,
    row.leads?.last_name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

export default function Recordings() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('daily');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState('50');

  useEffect(() => {
    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from('lead_recordings')
        .select('*, leads(first_name,last_name)')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false });

      setRows(data || []);
    }

    load();
  }, []);

  const grouped = useMemo(() => {
    return rows
      .filter((row) => matchesSearch(row, search))
      .map((row) => {
        const d = new Date(row.created_at);
        let groupLabel = row.created_at;

        if (view === 'weekly') {
          const copy = new Date(d);
          const day = copy.getDay();
          const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
          copy.setDate(diff);
          groupLabel = copy.toISOString().slice(0, 10);
        }

        if (view === 'monthly') {
          groupLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        }

        return {
          ...row,
          group_label: groupLabel
        };
      });
  }, [rows, view, search]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return grouped;
    return grouped.slice(0, Number(pageSize));
  }, [grouped, pageSize]);

  const columns = [
    {
      key: 'group_label',
      label: view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month',
      render: (v) => formatDate(v)
    },
    {
      key: 'leads',
      label: 'Lead',
      render: (_v, row) =>
        row.leads
          ? `${row.leads.first_name || ''} ${row.leads.last_name || ''}`.trim()
          : 'No lead attached'
    },
    { key: 'file_name', label: 'Recording' },
    {
      key: 'recording_url',
      label: 'Audio',
      render: (v) => (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={v} target="_blank" rel="noreferrer">
            Open
          </a>
          <a href={v} download>
            Download
          </a>
          <audio controls preload="none" src={v} style={{ maxWidth: 220 }} />
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (v) => formatDate(v)
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
          <h1>Recordings</h1>
          <p>Stored sit recordings by day, week, and month.</p>
        </div>

        <div className="segmented">
          <button className={view === 'daily' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('daily')}>
            Daily
          </button>
          <button className={view === 'weekly' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('weekly')}>
            Weekly
          </button>
          <button className={view === 'monthly' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('monthly')}>
            Monthly
          </button>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lead or file name..."
            />
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
          Showing {visibleRows.length} of {grouped.length} recordings
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
