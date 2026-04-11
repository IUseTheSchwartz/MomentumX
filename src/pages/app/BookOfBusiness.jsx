import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { currency, formatDate } from '../../lib/utils';

function matchesSearch(row, query) {
  if (!query) return true;
  const text = [
    row.first_name,
    row.last_name,
    row.company_sold,
    row.product_sold,
    row.phone,
    row.email,
    row.notes
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

function downloadCsv(filename, rows) {
  const headers = [
    'Client',
    'Company',
    'Product',
    'AP Sold',
    'Sale Date',
    'Effective Date',
    'Phone',
    'Email',
    'Notes'
  ];

  const csvRows = rows.map((row) => [
    `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    row.company_sold || '',
    row.product_sold || '',
    row.ap_sold || 0,
    row.sale_date || '',
    row.effective_date || '',
    row.phone || '',
    row.email || '',
    (row.notes || '').replace(/\n/g, ' ')
  ]);

  const csv = [headers, ...csvRows]
    .map((line) =>
      line
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function BookOfBusiness() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [pageSize, setPageSize] = useState('50');

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
        .eq('sale', true)
        .order('sale_date', { ascending: false });

      setRows(data || []);
    }

    load();
  }, []);

  const companyOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.company_sold).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const next = rows
      .filter((row) => matchesSearch(row, search))
      .filter((row) => (companyFilter === 'all' ? true : row.company_sold === companyFilter));

    next.sort((a, b) => {
      const aTime = new Date(a.sale_date || a.created_at || 0).getTime();
      const bTime = new Date(b.sale_date || b.created_at || 0).getTime();
      return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
    });

    return next;
  }, [rows, search, companyFilter, sortOrder]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    return filteredRows.slice(0, Number(pageSize));
  }, [filteredRows, pageSize]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.sales += 1;
        acc.ap += Number(row.ap_sold || 0);
        return acc;
      },
      { sales: 0, ap: 0 }
    );
  }, [filteredRows]);

  const columns = [
    {
      key: 'first_name',
      label: 'Client',
      render: (_v, row) => `${row.first_name || ''} ${row.last_name || ''}`.trim()
    },
    { key: 'company_sold', label: 'Company' },
    { key: 'product_sold', label: 'Product' },
    {
      key: 'ap_sold',
      label: 'AP Sold',
      render: (v) => currency(v)
    },
    {
      key: 'sale_date',
      label: 'Sale Date',
      render: (v) => formatDate(v)
    },
    {
      key: 'effective_date',
      label: 'Effective',
      render: (v) => formatDate(v)
    },
    { key: 'notes', label: 'Notes' }
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
          <h1>Book of Business</h1>
          <p>Your sold business and active policy record.</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ flexShrink: 0, marginBottom: 12 }}>
        <div className="glass" style={{ padding: 14 }}>
          <strong>Total Sales</strong>
          <div style={{ fontSize: 24, marginTop: 8 }}>{totals.sales}</div>
        </div>
        <div className="glass" style={{ padding: 14 }}>
          <strong>Total AP</strong>
          <div style={{ fontSize: 24, marginTop: 8 }}>{currency(totals.ap)}</div>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Client, company, product..."
            />
          </label>

          <label>
            Company
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="all">All</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
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

          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadCsv('book-of-business.csv', filteredRows)}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="top-gap" style={{ fontSize: 14, opacity: 0.85 }}>
          Showing {visibleRows.length} of {filteredRows.length} matching sales
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
