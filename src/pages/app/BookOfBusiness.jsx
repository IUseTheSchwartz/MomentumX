import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { currency, formatDate } from '../../lib/utils';

export default function BookOfBusiness() {
  const [rows, setRows] = useState([]);

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
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Book of Business</h1>
          <p>Your sold business and active policy record.</p>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} />
    </div>
  );
}
