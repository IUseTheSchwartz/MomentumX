import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { currency, formatDate } from '../../lib/utils';

const saleDefaults = {
  ap_sold: '',
  sale_date: new Date().toISOString().slice(0, 10),
  company_sold: '',
  product_sold: '',
  effective_date: '',
  notes: ''
};

export default function Leads() {
  const [rows, setRows] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [saleForm, setSaleForm] = useState(saleDefaults);
  const [noteDrafts, setNoteDrafts] = useState({});

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateLead(id, patch) {
    await supabase.from('leads').update(patch).eq('id', id);
    load();
  }

  async function markCalled(row) {
    const nextCount = Math.min(Number(row.call_count || 0) + 1, 3);
    await updateLead(row.id, {
      call_count: nextCount,
      status: `Called ${nextCount}x`,
      last_called_at: new Date().toISOString()
    });
  }

  async function markDnc(row) {
    await updateLead(row.id, {
      do_not_call: true,
      status: 'Do Not Call'
    });
  }

  async function markSit(row) {
    await updateLead(row.id, {
      sit: true,
      status: 'Sit'
    });
  }

  function openSale(row) {
    setActiveLead(row);
    setSaleForm({
      ap_sold: row.ap_sold || '',
      sale_date: row.sale_date ? row.sale_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      company_sold: row.company_sold || '',
      product_sold: row.product_sold || '',
      effective_date: row.effective_date ? row.effective_date.slice(0, 10) : '',
      notes: row.notes || ''
    });
  }

  async function submitSale(e) {
    e.preventDefault();
    if (!activeLead) return;

    await updateLead(activeLead.id, {
      sale: true,
      status: 'Sale',
      ap_sold: Number(saleForm.ap_sold || 0),
      sale_date: saleForm.sale_date || null,
      company_sold: saleForm.company_sold || null,
      product_sold: saleForm.product_sold || null,
      effective_date: saleForm.effective_date || null,
      notes: saleForm.notes || null
    });

    setActiveLead(null);
    setSaleForm(saleDefaults);
  }

  async function saveNotes(row) {
    const note = noteDrafts[row.id] ?? row.notes ?? '';
    await updateLead(row.id, { notes: note });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Work leads, log dispositions, and record sold business properly.</p>
        </div>
      </div>

      <div className="lead-list">
        {rows.map((row) => (
          <div key={row.id} className="lead-card glass">
            <div className="lead-top">
              <div>
                <div className="lead-name">
                  {row.first_name || '—'} {row.last_name || ''}
                </div>
                <div className="lead-meta">
                  {row.phone || 'No phone'} · {row.lead_type || '—'} · Created {formatDate(row.created_at)}
                </div>
              </div>

              <div className="lead-status-stack">
                <span className="pill">{row.status || 'New'}</span>
                <span className="pill muted">Calls {row.call_count || 0}</span>
                {row.sale ? <span className="pill success">Sold</span> : null}
                {row.do_not_call ? <span className="pill danger">DNC</span> : null}
              </div>
            </div>

            <div className="lead-actions">
              <button className="btn btn-ghost btn-small" onClick={() => markCalled(row)}>
                Mark Called
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => markSit(row)}>
                Sit
              </button>
              <button className="btn btn-primary btn-small" onClick={() => openSale(row)}>
                Sale
              </button>
              <button className="btn btn-danger btn-small" onClick={() => markDnc(row)}>
                Do Not Call
              </button>
            </div>

            <div className="lead-extra">
              <div className="lead-extra-item">
                <strong>AP Sold:</strong> {currency(row.ap_sold || 0)}
              </div>
              <div className="lead-extra-item">
                <strong>Sale Date:</strong> {formatDate(row.sale_date)}
              </div>
              <div className="lead-extra-item">
                <strong>Effective Date:</strong> {formatDate(row.effective_date)}
              </div>
              <div className="lead-extra-item">
                <strong>Company:</strong> {row.company_sold || '—'}
              </div>
              <div className="lead-extra-item">
                <strong>Product:</strong> {row.product_sold || '—'}
              </div>
            </div>

            <div className="lead-notes">
              <label>
                Notes
                <textarea
                  rows="3"
                  value={noteDrafts[row.id] ?? row.notes ?? ''}
                  onChange={(e) =>
                    setNoteDrafts((prev) => ({
                      ...prev,
                      [row.id]: e.target.value
                    }))
                  }
                  placeholder="Add notes..."
                />
              </label>

              <button className="btn btn-ghost btn-small" onClick={() => saveNotes(row)}>
                Save Notes
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeLead ? (
        <div className="modal-backdrop" onClick={() => setActiveLead(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Log Sale</h2>
            <p>
              {activeLead.first_name} {activeLead.last_name}
            </p>

            <form className="form" onSubmit={submitSale}>
              <div className="form-grid">
                <label>
                  AP Sold
                  <input
                    value={saleForm.ap_sold}
                    onChange={(e) => setSaleForm((s) => ({ ...s, ap_sold: e.target.value }))}
                  />
                </label>

                <label>
                  Sale Date
                  <input
                    type="date"
                    value={saleForm.sale_date}
                    onChange={(e) => setSaleForm((s) => ({ ...s, sale_date: e.target.value }))}
                  />
                </label>

                <label>
                  Company Sold
                  <input
                    value={saleForm.company_sold}
                    onChange={(e) => setSaleForm((s) => ({ ...s, company_sold: e.target.value }))}
                  />
                </label>

                <label>
                  Product Sold
                  <input
                    value={saleForm.product_sold}
                    onChange={(e) => setSaleForm((s) => ({ ...s, product_sold: e.target.value }))}
                  />
                </label>

                <label>
                  Effective Date
                  <input
                    type="date"
                    value={saleForm.effective_date}
                    onChange={(e) => setSaleForm((s) => ({ ...s, effective_date: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  rows="4"
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setActiveLead(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
