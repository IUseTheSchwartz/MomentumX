import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate, currency } from '../../lib/utils';

const initialForm = {
  entry_date: new Date().toISOString().slice(0, 10),
  dials: '',
  contacts: '',
  sits: '',
  sales: '',
  close_rate: '',
  premium_submitted: '',
  ap_sold: ''
};

export default function KPI() {
  const [form, setForm] = useState(initialForm);
  const [rows, setRows] = useState([]);

  async function loadRows() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from('kpi_entries')
      .select('*')
      .eq('agent_id', session.user.id)
      .order('entry_date', { ascending: false });

    setRows(data || []);
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function submit(e) {
    e.preventDefault();

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const payload = {
      agent_id: session.user.id,
      entry_date: form.entry_date,
      dials: Number(form.dials || 0),
      contacts: Number(form.contacts || 0),
      sits: Number(form.sits || 0),
      sales: Number(form.sales || 0),
      close_rate: Number(form.close_rate || 0),
      premium_submitted: Number(form.premium_submitted || 0),
      ap_sold: Number(form.ap_sold || 0)
    };

    await supabase.from('kpi_entries').insert(payload);
    setForm(initialForm);
    loadRows();
  }

  const columns = [
    { key: 'entry_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'dials', label: 'Dials' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'sits', label: 'Sits' },
    { key: 'sales', label: 'Sales' },
    { key: 'close_rate', label: 'Close %' },
    { key: 'premium_submitted', label: 'Premium', render: (v) => currency(v) },
    { key: 'ap_sold', label: 'AP Sold', render: (v) => currency(v) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>KPI</h1>
          <p>Track daily numbers and keep the pressure visible.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm((s) => ({ ...s, entry_date: e.target.value }))}
            />
          </label>

          <label>
            Dials
            <input value={form.dials} onChange={(e) => setForm((s) => ({ ...s, dials: e.target.value }))} />
          </label>

          <label>
            Contacts
            <input value={form.contacts} onChange={(e) => setForm((s) => ({ ...s, contacts: e.target.value }))} />
          </label>

          <label>
            Sits
            <input value={form.sits} onChange={(e) => setForm((s) => ({ ...s, sits: e.target.value }))} />
          </label>

          <label>
            Sales
            <input value={form.sales} onChange={(e) => setForm((s) => ({ ...s, sales: e.target.value }))} />
          </label>

          <label>
            Close Rate
            <input value={form.close_rate} onChange={(e) => setForm((s) => ({ ...s, close_rate: e.target.value }))} />
          </label>

          <label>
            Premium Submitted
            <input
              value={form.premium_submitted}
              onChange={(e) => setForm((s) => ({ ...s, premium_submitted: e.target.value }))}
            />
          </label>

          <label>
            AP Sold
            <input value={form.ap_sold} onChange={(e) => setForm((s) => ({ ...s, ap_sold: e.target.value }))} />
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Save KPI
        </button>
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
