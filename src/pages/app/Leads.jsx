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

function isSameLocalDay(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getVisibleCalledCount(row) {
  return isSameLocalDay(row.last_called_at) ? Number(row.call_count || 0) : 0;
}

function appendCallHistory(existingNotes, amount) {
  const stamp = new Date().toLocaleString();
  const entry = `[${stamp}] Marked called ${amount} time${amount === 1 ? '' : 's'}.`;
  const current = (existingNotes || '').trim();

  return current ? `${current}\n${entry}` : entry;
}

export default function Leads() {
  const [rows, setRows] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [saleForm, setSaleForm] = useState(saleDefaults);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [callAmounts, setCallAmounts] = useState({});
  const [savingSale, setSavingSale] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [busyLeadId, setBusyLeadId] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    setSessionUserId(session.user.id);

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to load leads:', error);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  function replaceRow(updatedRow) {
    setRows((prev) => prev.map((row) => (row.id === updatedRow.id ? { ...row, ...updatedRow } : row)));
  }

  async function updateLead(id, patch) {
    const query = supabase
      .from('leads')
      .update(patch)
      .eq('id', id);

    const scopedQuery = sessionUserId ? query.eq('assigned_to', sessionUserId) : query;

    const { data, error } = await scopedQuery
      .select('*')
      .single();

    if (error) throw error;

    replaceRow(data);
    return data;
  }

  async function markCalled(row) {
    const selectedAmount = Math.max(1, Number(callAmounts[row.id] || 1));
    const visibleToday = getVisibleCalledCount(row);
    const nextVisibleCount = visibleToday + selectedAmount;

    setBusyLeadId(row.id);

    try {
      await updateLead(row.id, {
        call_count: nextVisibleCount,
        status: `Called ${nextVisibleCount}x Today`,
        last_called_at: new Date().toISOString(),
        notes: appendCallHistory(row.notes, selectedAmount)
      });
    } catch (error) {
      console.error('Failed to mark called:', error);
      alert(error.message || 'Failed to mark lead as called.');
    } finally {
      setBusyLeadId(null);
    }
  }

  async function markDnc(row) {
    setBusyLeadId(row.id);

    try {
      await updateLead(row.id, {
        do_not_call: true,
        status: 'Do Not Call'
      });
    } catch (error) {
      console.error('Failed to mark DNC:', error);
      alert(error.message || 'Failed to update lead.');
    } finally {
      setBusyLeadId(null);
    }
  }

  async function markSit(row) {
    setBusyLeadId(row.id);

    try {
      await updateLead(row.id, {
        sit: true,
        status: 'Sit'
      });
    } catch (error) {
      console.error('Failed to mark sit:', error);
      alert(error.message || 'Failed to update lead.');
    } finally {
      setBusyLeadId(null);
    }
  }

  function openSale(row) {
    setActiveLead(row);
    setSaleError('');
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

    setSavingSale(true);
    setSaleError('');

    try {
      const apSold = Number(saleForm.ap_sold || 0);

      const patch = {
        sale: true,
        status: 'Sold',
        ap_sold: Number.isFinite(apSold) ? apSold : 0,
        sale_date: saleForm.sale_date || null,
        company_sold: saleForm.company_sold?.trim() || null,
        product_sold: saleForm.product_sold?.trim() || null,
        effective_date: saleForm.effective_date || null,
        notes: saleForm.notes?.trim() || null
      };

      const updatedLead = await updateLead(activeLead.id, patch);

      setActiveLead(null);
      setSaleForm(saleDefaults);

      if (updatedLead) {
        replaceRow(updatedLead);
      }
    } catch (error) {
      console.error('Failed to save sale:', error);
      setSaleError(error.message || 'Failed to save sale.');
    } finally {
      setSavingSale(false);
    }
  }

  async function saveNotes(row) {
    const note = noteDrafts[row.id] ?? row.notes ?? '';
    setBusyLeadId(row.id);

    try {
      await updateLead(row.id, { notes: note });
    } catch (error) {
      console.error('Failed to save notes:', error);
      alert(error.message || 'Failed to save notes.');
    } finally {
      setBusyLeadId(null);
    }
  }

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
          <h1>Leads</h1>
          <p>Work leads, log dispositions, and record sold business properly.</p>
        </div>
      </div>

      <div
        className="lead-list"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          paddingRight: 4
        }}
      >
        {rows.map((row) => {
          const visibleCalledCount = getVisibleCalledCount(row);
          const selectedCallAmount = Number(callAmounts[row.id] || 1);

          return (
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
                  <span className="pill muted">Called Today {visibleCalledCount}</span>
                  {row.sale ? <span className="pill success">Sold</span> : null}
                  {row.do_not_call ? <span className="pill danger">DNC</span> : null}
                </div>
              </div>

              <div
                className="lead-actions"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={selectedCallAmount}
                    onChange={(e) =>
                      setCallAmounts((prev) => ({
                        ...prev,
                        [row.id]: Number(e.target.value)
                      }))
                    }
                  >
                    {Array.from({ length: 10 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <option key={value} value={value}>
                          {value}x
                        </option>
                      );
                    })}
                  </select>

                  <button
                    className="btn btn-ghost btn-small"
                    onClick={() => markCalled(row)}
                    disabled={busyLeadId === row.id}
                  >
                    Mark Called
                  </button>
                </div>

                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => markSit(row)}
                  disabled={busyLeadId === row.id}
                >
                  Sit
                </button>

                <button
                  className="btn btn-primary btn-small"
                  onClick={() => openSale(row)}
                  disabled={busyLeadId === row.id}
                >
                  Sale
                </button>

                <button
                  className="btn btn-danger btn-small"
                  onClick={() => markDnc(row)}
                  disabled={busyLeadId === row.id}
                >
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

                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => saveNotes(row)}
                  disabled={busyLeadId === row.id}
                >
                  Save Notes
                </button>
              </div>
            </div>
          );
        })}
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

              {saleError ? (
                <div className="top-gap" style={{ color: '#ff6b6b' }}>
                  {saleError}
                </div>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setActiveLead(null)}
                  disabled={savingSale}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSale}>
                  {savingSale ? 'Saving...' : 'Save Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
