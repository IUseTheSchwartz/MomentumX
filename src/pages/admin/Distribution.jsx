import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

const blank = {
  tier_id: '',
  amount: '',
  frequency: 'monthly',
  day_of_week: 'monday',
  day_of_month: '1'
};

const weekDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

export default function Distribution() {
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');

  async function load() {
    const [{ data: ruleRows }, { data: tierRows }] = await Promise.all([
      supabase
        .from('distribution_rules')
        .select('*, tiers(name, manual_only)')
        .order('created_at', { ascending: false }),
      supabase
        .from('tiers')
        .select('id, name, manual_only')
        .order('sort_order')
    ]);

    setRows(ruleRows || []);
    setTiers(tierRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  const eligibleTiers = useMemo(
    () => tiers.filter((tier) => !tier.manual_only),
    [tiers]
  );

  async function submit(e) {
    e.preventDefault();
    setMessage('');

    const amount = Number(form.amount || 0);
    if (!form.tier_id) {
      setMessage('Select a tier.');
      return;
    }

    if (amount <= 0) {
      setMessage('Enter a valid lead amount.');
      return;
    }

    const payload = {
      tier_id: form.tier_id,
      amount,
      frequency: form.frequency,
      day_of_week: form.frequency === 'weekly' ? form.day_of_week : null,
      day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null
    };

    const { error } = await supabase.from('distribution_rules').insert(payload);

    if (error) {
      setMessage(error.message || 'Could not save rule.');
      return;
    }

    setForm(blank);
    setMessage('Distribution rule added.');
    load();
  }

  const columns = [
    {
      key: 'tiers',
      label: 'Tier',
      render: (_v, row) => row.tiers?.name || '—'
    },
    { key: 'amount', label: 'Lead Amount' },
    { key: 'frequency', label: 'Frequency' },
    {
      key: 'day_of_week',
      label: 'Day of Week',
      render: (value, row) => (row.frequency === 'weekly' ? value || '—' : '—')
    },
    {
      key: 'day_of_month',
      label: 'Day of Month',
      render: (value, row) => (row.frequency === 'monthly' ? value || '—' : '—')
    }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Distribution</h1>
          <p>Set how Tier 1-style tiers receive weekly or monthly lead drops.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Tier
            <select
              value={form.tier_id}
              onChange={(e) => setForm((s) => ({ ...s, tier_id: e.target.value }))}
            >
              <option value="">Select Tier</option>
              {eligibleTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Frequency
            <select
              value={form.frequency}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  frequency: e.target.value
                }))
              }
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label>
            Leads Per {form.frequency === 'weekly' ? 'Week' : 'Month'}
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
              placeholder="25"
            />
          </label>

          {form.frequency === 'weekly' ? (
            <label>
              Day of Week
              <select
                value={form.day_of_week}
                onChange={(e) => setForm((s) => ({ ...s, day_of_week: e.target.value }))}
              >
                {weekDays.map((day) => (
                  <option key={day} value={day}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Day of Month
              <input
                type="number"
                min="1"
                max="31"
                value={form.day_of_month}
                onChange={(e) => setForm((s) => ({ ...s, day_of_month: e.target.value }))}
                placeholder="1"
              />
            </label>
          )}
        </div>

        <button className="btn btn-primary" type="submit">
          Add Rule
        </button>

        {message ? <div className="top-gap">{message}</div> : null}
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
