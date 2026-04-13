// src/pages/admin/LeadsAdmin.jsx
import { useEffect, useMemo, useState } from 'react';
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
    .filter((row) =>
      Object.values(row).some((value) => String(value || '').trim() !== '')
    );
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
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

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
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDob(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // Excel-style numeric serial dates are intentionally not handled here.
  // This parser is for string DOB formats only.

  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/').replace(/\s+/g, '');
  const parts = normalized.split('/');

  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    const [a, b, c] = parts.map((part) => Number(part));

    // yyyy/mm/dd
    if (String(parts[0]).length === 4) {
      if (isValidDateParts(a, b, c)) {
        return toIsoDate(a, b, c);
      }
      return null;
    }

    // dd/mm/yyyy or mm/dd/yyyy
    if (String(parts[2]).length === 4) {
      const year = c;

      // Prefer day-first when it is clearly day-first.
      if (a > 12 && isValidDateParts(year, b, a)) {
        return toIsoDate(year, b, a);
      }

      // Prefer month-first when it is clearly month-first.
      if (b > 12 && isValidDateParts(year, a, b)) {
        return toIsoDate(year, a, b);
      }

      // If both are possible (example: 03/07/1998), default to month/day/year
      if (isValidDateParts(year, a, b)) {
        return toIsoDate(year, a, b);
      }

      // Fallback to day/month/year
      if (isValidDateParts(year, b, a)) {
        return toIsoDate(year, b, a);
      }

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
    'phone_1',
    'Phone',
    'Phone 1',
    'mobile',
    'Mobile',
    'cell',
    'Cell',
    'confirm_your_phone'
  ]);

  const email = getFirstValue(rawRow, ['email', 'Email', 'email_address']);

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

  const baseRow = {
    batch_id: batchId,
    source_batch: batchName,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: normalizePhone(phone),
    email: email || null,
    lead_type: leadType,
    lead_category: leadCategory,
    status: 'New',
    dob,
    beneficiary_name: beneficiaryName || null,
    military_branch: leadType === 'Veteran' ? militaryBranch || null : null
  };

  if (leadType === 'Veteran') {
    return {
      ...baseRow,
      first_name:
        getFirstValue(rawRow, ['First Name', 'first_name', 'firstname']) || baseRow.first_name,
      last_name:
        getFirstValue(rawRow, ['Last Name', 'last_name', 'lastname']) || baseRow.last_name,
      phone:
        normalizePhone(getFirstValue(rawRow, ['Phone 1', 'phone_1', 'phone'])) || baseRow.phone,
      email: getFirstValue(rawRow, ['Email', 'email']) || baseRow.email
    };
  }

  if (leadType === 'Trucker IUL') {
    return {
      ...baseRow,
      first_name:
        getFirstValue(rawRow, ['First Name', 'first_name', 'firstname']) || baseRow.first_name,
      last_name:
        getFirstValue(rawRow, ['Last Name', 'last_name', 'lastname']) || baseRow.last_name,
      phone:
        normalizePhone(getFirstValue(rawRow, ['Phone 1', 'phone_1', 'phone'])) || baseRow.phone,
      email: getFirstValue(rawRow, ['Email', 'email']) || baseRow.email
    };
  }

  return baseRow;
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

function matchesSearch(row, query) {
  if (!query) return true;
  const text = [
    row.first_name,
    row.last_name,
    row.phone,
    row.email,
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
  const [totalCount, setTotalCount] = useState(0);
  const [file, setFile] = useState(null);
  const [leadType, setLeadType] = useState('Veteran');
  const [leadCategory, setLeadCategory] = useState('aged');
  const [batchName, setBatchName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [pageSize, setPageSize] = useState('50');

  async function load() {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('leads').select('id', { count: 'exact', head: true })
    ]);

    if (error) {
      console.error('Failed to load admin leads:', error);
      setRows([]);
    } else {
      setRows(data || []);
    }

    if (countError) {
      console.error('Failed to count admin leads:', countError);
      setTotalCount((data || []).length);
    } else {
      setTotalCount(count || 0);
    }
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

      const mappedRows = parsedRows.map((row) =>
        mapLeadRow(row, leadType, leadCategory, batchRow.id, finalBatchName)
      );

      const leadRows = validateMappedRows(mappedRows);

      const { error: leadsError } = await supabase.from('leads').insert(leadRows);
      if (leadsError) throw leadsError;

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

  const filteredRows = useMemo(() => {
    const next = rows
      .filter((row) => matchesSearch(row, search))
      .filter((row) => (typeFilter === 'all' ? true : row.lead_type === typeFilter))
      .filter((row) => (categoryFilter === 'all' ? true : row.lead_category === categoryFilter))
      .filter((row) => {
        if (assignedFilter === 'assigned') return Boolean(row.assigned_to);
        if (assignedFilter === 'unassigned') return !row.assigned_to;
        return true;
      });

    next.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
    });

    return next;
  }, [rows, search, typeFilter, categoryFilter, assignedFilter, sortOrder]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    return filteredRows.slice(0, Number(pageSize));
  }, [filteredRows, pageSize]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.assigned_to) acc.assigned += 1;
        else acc.unassigned += 1;
        return acc;
      },
      {
        assigned: 0,
        unassigned: 0
      }
    );
  }, [rows]);

  const columns = [
    { key: 'first_name', label: 'First' },
    { key: 'last_name', label: 'Last' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
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
            <p>Upload lead inventory and review current lead records.</p>
          </div>
        </div>

        <div className="grid grid-3" style={{ flexShrink: 0, marginBottom: 12 }}>
          <div className="glass" style={{ padding: 14 }}>
            <strong>Total Leads</strong>
            <div style={{ fontSize: 24, marginTop: 8 }}>{totalCount}</div>
          </div>
          <div className="glass" style={{ padding: 14 }}>
            <strong>Assigned</strong>
            <div style={{ fontSize: 24, marginTop: 8 }}>{totals.assigned}</div>
          </div>
          <div className="glass" style={{ padding: 14 }}>
            <strong>Unassigned</strong>
            <div style={{ fontSize: 24, marginTop: 8 }}>{totals.unassigned}</div>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 10
            }}
          >
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, email, batch..."
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
              Show
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="10">10</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="1000">1000</option>
                <option value="all">Show All</option>
              </select>
            </label>
          </div>

          <div className="top-gap" style={{ fontSize: 14, opacity: 0.85 }}>
            Showing {visibleRows.length} of {filteredRows.length} loaded leads · Total in table: {totalCount}
          </div>
        </div>

        <div className="top-gap">
          <DataTable columns={columns} rows={visibleRows} />
        </div>
      </div>
    </div>
  );
}
