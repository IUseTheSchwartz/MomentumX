// src/pages/admin/LeadsAdmin.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const leadTypes = ['Veteran', 'Trucker IUL', 'Mortgage', 'General IUL'];
const UPLOAD_CHUNK_SIZE = 500;

const LEAD_SELECT_COLUMNS =
  'id,first_name,last_name,phone,email,address,city,state,zip,dob,military_branch,beneficiary_name,lead_type,lead_category,status,assigned_to,source_batch,created_at';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatDateOnly(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function normalizePhone(value) {
  if (!value) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, '').trim());
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\uFEFF/g, ''))
    .filter((line) => line.trim());

  if (!lines.length) return [];

  const rawHeaders = splitLine(lines[0], delimiter);
  const headers = rawHeaders.map((header) => header.trim());

  return lines
    .slice(1)
    .map((line) => {
      const values = splitLine(line, delimiter);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
        row[normalizeKey(header)] = values[index] ?? '';
      });

      return row;
    })
    .filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));
}

function getFirstValue(rawRow, keys) {
  for (const key of keys) {
    if (rawRow[key] != null && String(rawRow[key]).trim() !== '') {
      return String(rawRow[key]).trim();
    }
  }

  return '';
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  return day <= daysInMonth[month - 1];
}

function toIsoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;
}

function normalizeDob(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/').replace(/\s+/g, '');
  const parts = normalized.split('/');

  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    const [a, b, c] = parts.map((part) => Number(part));

    if (String(parts[0]).length === 4) {
      if (isValidDateParts(a, b, c)) return toIsoDate(a, b, c);
      return null;
    }

    if (String(parts[2]).length === 4) {
      const year = c;

      if (a > 12 && isValidDateParts(year, b, a)) return toIsoDate(year, b, a);
      if (b > 12 && isValidDateParts(year, a, b)) return toIsoDate(year, a, b);
      if (isValidDateParts(year, a, b)) return toIsoDate(year, a, b);
      if (isValidDateParts(year, b, a)) return toIsoDate(year, b, a);

      return null;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();

  if (!isValidDateParts(year, month, day)) return null;

  return toIsoDate(year, month, day);
}

function mapLeadRow(rawRow, leadType, leadCategory, batchId, batchName) {
  const firstName = getFirstValue(rawRow, [
    'first_name',
    'firstname',
    'first',
    'First Name',
    'first_name_',
    'first_name__',
    'full_name_first'
  ]);

  const lastName = getFirstValue(rawRow, [
    'last_name',
    'lastname',
    'last',
    'Last Name',
    'last_name_',
    'last_name__'
  ]);

  const phone = getFirstValue(rawRow, [
    'phone',
    'phone_number',
    'phone_number_',
    'phonenumber',
    'phone_1',
    'Phone',
    'Phone Number',
    'PhoneNumber',
    'Phone 1',
    'mobile',
    'Mobile',
    'cell',
    'Cell',
    'confirm_your_phone'
  ]);

  const email = getFirstValue(rawRow, ['email', 'Email', 'email_address', 'Email Address']);

  const address = getFirstValue(rawRow, [
    'address',
    'Address',
    'street_address',
    'Street Address',
    'street',
    'Street',
    'address_line_1',
    'Address Line 1',
    'mailing_address',
    'Mailing Address',
    'home_address',
    'Home Address'
  ]);

  const city = getFirstValue(rawRow, ['city', 'City', 'town', 'Town']);

  const state = getFirstValue(rawRow, [
    'state',
    'State',
    'state_code',
    'State Code',
    'st',
    'ST',
    'province',
    'Province'
  ]);

  const zip = getFirstValue(rawRow, [
    'zip',
    'Zip',
    'zipcode',
    'Zipcode',
    'zip_code',
    'Zip Code',
    'postal_code',
    'Postal Code'
  ]);

  const dob = normalizeDob(
    getFirstValue(rawRow, ['dob', 'DOB', 'date_of_birth', 'Date of Birth'])
  );

  const beneficiaryName = getFirstValue(rawRow, [
    'beneficiary_name',
    'beneficiary',
    'Beneficiary Name',
    'Beneficiary'
  ]);

  const militaryBranch = getFirstValue(rawRow, [
    'military_branch',
    'branch',
    'Military Branch',
    'military'
  ]);

  return {
    batch_id: batchId,
    source_batch: batchName,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: normalizePhone(phone),
    email: email || null,
    address: address || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    lead_type: leadType,
    lead_category: leadCategory,
    status: 'New',
    dob,
    beneficiary_name: beneficiaryName || null,
    military_branch: leadType === 'Veteran' ? militaryBranch || null : null
  };
}

function validateMappedRows(leadRows) {
  const validRows = leadRows.filter(
    (row) => row.first_name || row.last_name || row.phone || row.email
  );

  if (!validRows.length) {
    throw new Error(
      'No usable leads found. The file was parsed, but none of the rows matched the expected name/phone/email fields.'
    );
  }

  return validRows;
}

function sanitizeSearch(value) {
  return String(value || '').trim().replace(/[%_]/g, '');
}

function matchesSearch(row, query) {
  if (!query) return true;

  const text = [
    row.first_name,
    row.last_name,
    row.phone,
    row.email,
    row.address,
    row.city,
    row.state,
    row.zip,
    row.lead_type,
    row.status,
    row.source_batch,
    row.beneficiary_name,
    row.military_branch,
    row.dob
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

export default function LeadsAdmin() {
  const [rows, setRows] = useState([]);

  const [file, setFile] = useState(null);
  const [leadType, setLeadType] = useState('Veteran');
  const [leadCategory, setLeadCategory] = useState('aged');
  const [batchName, setBatchName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [pageSize, setPageSize] = useState('50');

  async function load() {
    setLoading(true);

    try {
      const limit = Number(pageSize || 50);

      let dataQuery = supabase.from('leads').select(LEAD_SELECT_COLUMNS);

      if (typeFilter !== 'all') {
        dataQuery = dataQuery.eq('lead_type', typeFilter);
      }

      if (categoryFilter !== 'all') {
        dataQuery = dataQuery.eq('lead_category', categoryFilter);
      }

      if (assignedFilter === 'assigned') {
        dataQuery = dataQuery.not('assigned_to', 'is', null);
      }

      if (assignedFilter === 'unassigned') {
        dataQuery = dataQuery.is('assigned_to', null);
      }

      const safeSearch = sanitizeSearch(appliedSearch);
      if (safeSearch) {
        dataQuery = dataQuery.or(
          [
            `first_name.ilike.%${safeSearch}%`,
            `last_name.ilike.%${safeSearch}%`,
            `phone.ilike.%${safeSearch}%`,
            `email.ilike.%${safeSearch}%`,
            `city.ilike.%${safeSearch}%`,
            `state.ilike.%${safeSearch}%`,
            `zip.ilike.%${safeSearch}%`,
            `source_batch.ilike.%${safeSearch}%`,
            `beneficiary_name.ilike.%${safeSearch}%`,
            `military_branch.ilike.%${safeSearch}%`
          ].join(',')
        );
      }

      const { data, error } = await dataQuery
        .order('created_at', { ascending: sortOrder === 'oldest' })
        .limit(limit);

      if (error) throw error;

      setRows(data || []);
    } catch (error) {
      console.error('Failed to load admin leads:', error);
      setRows([]);
      setMessage(error.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [typeFilter, categoryFilter, assignedFilter, sortOrder, pageSize, appliedSearch]);

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

      const mappedRows = parsedRows.map((row) =>
        mapLeadRow(row, leadType, leadCategory, batchRow.id, finalBatchName)
      );

      const leadRows = validateMappedRows(mappedRows);

      for (let i = 0; i < leadRows.length; i += UPLOAD_CHUNK_SIZE) {
        const chunk = leadRows.slice(i, i + UPLOAD_CHUNK_SIZE);
        const savedCount = Math.min(i + UPLOAD_CHUNK_SIZE, leadRows.length);

        setMessage(`Uploading... ${savedCount} of ${leadRows.length} leads saved.`);

        const { error: leadsError } = await supabase.from('leads').insert(chunk);

        if (leadsError) {
          throw new Error(
            `Upload failed on rows ${i + 1}-${savedCount}: ${
              leadsError.message || 'Unknown error'
            }`
          );
        }
      }

      await writeAdminLog({
        action: 'Imported leads batch',
        targetType: 'lead_batch',
        targetId: batchRow.id,
        details: {
          batch_name: finalBatchName,
          lead_type: leadType,
          lead_category: leadCategory,
          total_uploaded: leadRows.length,
          original_rows_detected: parsedRows.length,
          chunk_size: UPLOAD_CHUNK_SIZE,
          summary: `Imported ${leadRows.length} ${leadCategory} ${leadType} leads into batch "${finalBatchName}".`
        }
      });

      setFile(null);
      setBatchName('');
      setLeadType('Veteran');
      setLeadCategory('aged');
      setMessage(
        `Uploaded ${leadRows.length} ${leadCategory} ${leadType} leads to batch "${finalBatchName}".`
      );

      await load();
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function applySearch(e) {
    e.preventDefault();
    setAppliedSearch(search.trim());
  }

  function clearSearch() {
    setSearch('');
    setAppliedSearch('');
  }

  const visibleRows = useMemo(() => {
    return rows.filter((row) => matchesSearch(row, appliedSearch));
  }, [rows, appliedSearch]);

  const columns = [
    { key: 'first_name', label: 'First' },
    { key: 'last_name', label: 'Last' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address', render: (v) => v || '—' },
    { key: 'city', label: 'City', render: (v) => v || '—' },
    { key: 'state', label: 'State', render: (v) => v || '—' },
    { key: 'zip', label: 'ZIP', render: (v) => v || '—' },
    { key: 'dob', label: 'DOB', render: (v) => formatDateOnly(v) },
    {
      key: 'military_branch',
      label: 'Military Branch',
      render: (v, row) => (row.lead_type === 'Veteran' ? v || '—' : '—')
    },
    { key: 'beneficiary_name', label: 'Beneficiary', render: (v) => v || '—' },
    { key: 'lead_type', label: 'Lead Type' },
    { key: 'lead_category', label: 'Category' },
    { key: 'status', label: 'Status' },
    {
      key: 'assigned_to',
      label: 'Assignment',
      render: (v) => (v ? 'Assigned' : 'Unassigned')
    },
    { key: 'source_batch', label: 'Batch' },
    { key: 'created_at', label: 'Created', render: (v) => formatDate(v) }
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
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4
        }}
      >
        <div className="page-header" style={{ flexShrink: 0 }}>
          <div>
            <h1>Leads</h1>
            <p>Upload lead inventory and review a limited set of lead records.</p>
          </div>
        </div>

        <form className="form glass" onSubmit={handleUpload} style={{ flexShrink: 0 }}>
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
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <button className="btn btn-primary" type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>

          {message ? <div className="top-gap">{message}</div> : null}
        </form>

        <div className="glass top-gap" style={{ padding: 12, flexShrink: 0 }}>
          <form
            onSubmit={applySearch}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 10,
              alignItems: 'end'
            }}
          >
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, city, state, ZIP..."
              />
            </label>

            <label>
              Lead Type
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All</option>
                {leadTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fresh / Aged
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="fresh">Fresh</option>
                <option value="aged">Aged</option>
              </select>
            </label>

            <label>
              Assignment
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
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
              Load
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="500">500</option>
              </select>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-small" type="submit">
                Search
              </button>

              <button className="btn btn-ghost btn-small" type="button" onClick={clearSearch}>
                Clear
              </button>
            </div>
          </form>

          <div className="top-gap" style={{ fontSize: 14, opacity: 0.85 }}>
            {loading ? 'Loading leads...' : `Showing ${visibleRows.length} loaded rows.`}
            {appliedSearch ? ` Search: "${appliedSearch}".` : ''}
          </div>
        </div>

        <div className="top-gap">
          <DataTable columns={columns} rows={visibleRows} />
        </div>
      </div>
    </div>
  );
}
