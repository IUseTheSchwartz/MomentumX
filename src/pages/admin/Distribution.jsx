import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

const blank = {
  tier_id: '',
  lead_type: 'Veteran',
  amount: '',
  frequency: 'monthly',
  day_of_week: '',
  day_of_month: ''
};

export default function Distribution() {
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState(blank);

  async function load() {
    const [{ data: ruleRows }, { data: tierRows }] = await Promise.all([
      supabase
        .from('distribution_rules')
        .select('*, tiers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('tiers').select('id, name').order('sort_order')
    ]);

    setRows(ruleRows || []);
    setTiers(tierRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();

    await supabase.from('distribution_rules').insert({
      tier_id: form.tier_id,
      lead_type: form.lead_type,
      amount: Number(form.amount || 0),
      frequency: form.frequency,
      day_of_week: form.day_of_week || null,
      day_of_month: form.day_of_month ? Number(form.day_of_month) : null
    });

    setForm(blank);
    load();
  }

  const columns = [
    {
      key: 'tiers',
      label: 'Tier',
      render: (_v, row) => row.tiers?.name || '—'
    },
    { key: 'lead_type', label: 'Lead Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'day_of_week', label: 'Day of Week' },
    { key: 'day_of_month', label: 'Day of Month' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Distribution</h1>
          <p>Set automatic lead drop rules by tier and lead type.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Tier
            <select value={form.tier_id} onChange={(e) => setForm((s) => ({ ...s, tier_id: e.target.value }))}>
              <option value="">Select Tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Lead Type
            <select value={form.lead_type} onChange={(e) => setForm((s) => ({ ...s, lead_type: e.target.value }))}>
              <option>Veteran</option>
              <option>Trucker IUL</option>
              <option>Mortgage</option>
              <option>General IUL</option>
            </select>
          </label>

          <label>
            Amount
            <input value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} />
          </label>

          <label>
            Frequency
            <select value={form.frequency} onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value }))}>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          </label>

          <label>
            Day of Week
            <input
              value={form.day_of_week}
              onChange={(e) => setForm((s) => ({ ...s, day_of_week: e.target.value }))}
              placeholder="monday"
            />
          </label>

          <label>
            Day of Month
            <input
              value={form.day_of_month}
              onChange={(e) => setForm((s) => ({ ...s, day_of_month: e.target.value }))}
              placeholder="15"
            />
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Add Rule
        </button>
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
