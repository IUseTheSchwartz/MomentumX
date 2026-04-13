import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import StatCard from '../../components/StatCard';
import { currency, formatDate } from '../../lib/utils';

export default function KPI() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadRows() {
      setLoading(true);
      setMessage('');

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
          if (mounted) {
            setRows([]);
            setMessage('No session found.');
          }
          return;
        }

        const { data, error } = await supabase
          .from('kpi_entries')
          .select('*')
          .eq('agent_id', session.user.id)
          .order('entry_date', { ascending: false });

        if (error) throw error;

        if (mounted) {
          setRows(data || []);
        }
      } catch (error) {
        console.error('Failed to load KPI rows:', error);
        if (mounted) {
          setRows([]);
          setMessage(error.message || 'Failed to load KPI.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRows();

    const handleFocus = () => {
      loadRows();
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        loadRows();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  const groupedRows = useMemo(() => {
    if (view === 'daily') return rows;

    const map = new Map();

    for (const row of rows) {
      const d = new Date(row.entry_date);
      let key = row.entry_date;

      if (view === 'weekly') {
        const copy = new Date(d);
        const day = copy.getDay();
        const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
        copy.setDate(diff);
        key = copy.toISOString().slice(0, 10);
      }

      if (view === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!map.has(key)) {
        map.set(key, {
          entry_date: key,
          dials: 0,
          contacts: 0,
          sits: 0,
          sales: 0,
          close_rate: 0,
          premium_submitted: 0,
          ap_sold: 0
        });
      }

      const current = map.get(key);
      current.dials += Number(row.dials || 0);
      current.contacts += Number(row.contacts || 0);
      current.sits += Number(row.sits || 0);
      current.sales += Number(row.sales || 0);
      current.premium_submitted += Number(row.premium_submitted || 0);
      current.ap_sold += Number(row.ap_sold || 0);
    }

    return Array.from(map.values()).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }, [rows, view]);

  const totals = useMemo(() => {
    return groupedRows.reduce(
      (acc, row) => {
        acc.dials += Number(row.dials || 0);
        acc.contacts += Number(row.contacts || 0);
        acc.sits += Number(row.sits || 0);
        acc.sales += Number(row.sales || 0);
        acc.premium += Number(row.premium_submitted || 0);
        acc.ap += Number(row.ap_sold || 0);
        return acc;
      },
      { dials: 0, contacts: 0, sits: 0, sales: 0, premium: 0, ap: 0 }
    );
  }, [groupedRows]);

  const columns = [
    {
      key: 'entry_date',
      label: view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month',
      render: (v) => formatDate(v)
    },
    { key: 'dials', label: 'Dials' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'sits', label: 'Sits' },
    { key: 'sales', label: 'Sales' },
    { key: 'premium_submitted', label: 'Premium', render: (v) => currency(v) },
    { key: 'ap_sold', label: 'AP Sold', render: (v) => currency(v) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>KPI</h1>
          <p>Past KPI history by day, week, and month.</p>
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

      {message ? (
        <div className="glass" style={{ padding: 12, marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      <div className="grid grid-4">
        <StatCard label="Dials" value={totals.dials} />
        <StatCard label="Contacts" value={totals.contacts} />
        <StatCard label="Sits" value={totals.sits} />
        <StatCard label="Sales" value={totals.sales} />
      </div>

      <div className="grid grid-2 top-gap">
        <StatCard label="Premium Submitted" value={currency(totals.premium)} />
        <StatCard label="AP Sold" value={currency(totals.ap)} />
      </div>

      <div className="top-gap">
        {loading ? (
          <div className="glass" style={{ padding: 16 }}>
            Loading KPI...
          </div>
        ) : (
          <DataTable columns={columns} rows={groupedRows} />
        )}
      </div>
    </div>
  );
}
