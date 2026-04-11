import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const leadTypes = ['Veteran', 'Trucker IUL', 'Mortgage', 'General IUL'];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function normalizePhone(value) {
  if (!value) return null;
  return String(value).trim();
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

function mapLeadRow(rawRow, leadType, leadCategory, batchId, batchName) {
  const firstName =
    rawRow.first_name ||
    rawRow.firstname ||
    rawRow.first ||
    rawRow.First ||
    rawRow['First Name'] ||
    '';

  const lastName =
    rawRow.last_name ||
    rawRow.lastname ||
    rawRow.last ||
    rawRow.Last ||
    rawRow['Last Name'] ||
    '';

  const phone =
    rawRow.phone ||
    rawRow.Phone ||
    rawRow.mobile ||
    rawRow.Mobile ||
    rawRow.cell ||
    rawRow.Cell ||
    '';

  const email =
    rawRow.email ||
    rawRow.Email ||
    '';

  return {
    batch_id: batchId,
    source_batch: batchName,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: normalizePhone(phone),
    email: email || null,
    lead_type: leadType,
    lead_category: leadCategory,
    status: 'New'
  };
}

export default function LeadsAdmin() {
  const [rows, setRows] = useState([]);
  const [file, setFile] = useState(null);
  const [leadType, setLeadType] = useState('Veteran');
  const [leadCategory, setLeadCategory] = useState('aged');
  const [batchName, setBatchName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();

    if (!file) {
      setMessage('Choose a CSV file first.');
      return;
    }

    if (!leadType) {
      setMessage('Choose a lead type.');
      return;
    }

    if (!leadCategory) {
      setMessage('Choose aged or fresh.');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const text = await file.text();
      const parsedRows = parseCsv(text);

      if (!parsedRows.length) {
        setMessage('CSV had no rows to import.');
        setUploading(false);
        return;
      }

      const finalBatchName = batchName.trim() || file.name;

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;

      const { data: batchRow, error: batchError } = await supabase
        .from('lead_batches')
        .insert({
          lead_type: leadType,
          batch_name: finalBatchName,
          total_uploaded: parsedRows.length,
          uploaded_by: userId
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const leadRows = parsedRows.map((row) =>
        mapLeadRow(row, leadType, leadCategory, batchRow.id, finalBatchName)
      );

      const { error: leadsError } = await supabase
        .from('leads')
        .insert(leadRows);

      if (leadsError) throw leadsError;

      await writeAdminLog({
        action: 'Imported leads batch',
        targetType: 'lead_batch',
        targetId: batchRow.id,
        details: {
          batch_name: finalBatchName,
          lead_type: leadType,
          lead_category: leadCategory,
          total_uploaded: parsedRows.length
        }
      });

      setFile(null);
      setBatchName('');
      setLeadType('Veteran');
      setLeadCategory('aged');
      setMessage(`Uploaded ${leadRows.length} ${leadCategory} ${leadType} leads to batch "${finalBatchName}".`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const columns = [
    { key: 'first_name', label: 'First' },
    { key: 'last_name', label: 'Last' },
    { key: 'lead_type', label: 'Lead Type' },
    { key: 'lead_category', label: 'Category' },
    { key: 'status', label: 'Status' },
    { key: 'assigned_to', label: 'Assigned To' },
    { key: 'source_batch', label: 'Batch' },
    { key: 'created_at', label: 'Created', render: (v) => formatDate(v) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Upload lead inventory and review current lead records.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={handleUpload}>
        <div className="form-grid">
          <label>
            Lead Type
            <select value={leadType} onChange={(e) => setLeadType(e.target.value)}>
              {leadTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Lead Category
            <select value={leadCategory} onChange={(e) => setLeadCategory(e.target.value)}>
              <option value="aged">Aged</option>
              <option value="fresh">Fresh</option>
            </select>
          </label>

          <label>
            Batch Name
            <input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="April Veteran Upload"
            />
          </label>

          <label>
            CSV File
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <button className="btn btn-primary" type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>

        {message ? <div className="top-gap">{message}</div> : null}
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
