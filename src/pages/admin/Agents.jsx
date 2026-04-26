import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { writeAdminLog } from '../../lib/adminLog';

const leadTypes = ['Veteran', 'Trucker IUL', 'Mortgage', 'General IUL'];
const PROGRAM_DAYS = 70;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function getProgramStart(row) {
  return row.lead_program_started_at || null;
}

function getDaysLeft(row) {
  if (!row.lead_program_active) return 0;

  const startValue = getProgramStart(row);
  if (!startValue) return PROGRAM_DAYS;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  const elapsedMs = now.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  return Math.max(0, PROGRAM_DAYS - elapsedDays);
}

function getProgramStatus(row) {
  if (row.lead_access_banned) return 'Ineligible';
  if (row.leads_paused) return 'Paused';
  if (!row.lead_program_active) return 'Not Active';

  const daysLeft = getDaysLeft(row);
  if (daysLeft <= 0) return 'Expired';

  return 'Active';
}

export default function Agents() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState('50');

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message || 'Could not load agents.');
      setRows([]);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateProfile(id, patch, actionLabel = 'Updated agent') {
    setMessage('');
    const before = rows.find((row) => row.id === id) || null;

    const { error } = await supabase.from('profiles').update(patch).eq('id', id);

    if (error) {
      setMessage(error.message || 'Could not update agent.');
      return;
    }

    await writeAdminLog({
      action: actionLabel,
      targetType: 'profile',
      targetId: id,
      details: {
        before,
        patch
      }
    });

    setMessage('Agent updated.');
    load();
  }

  function toggleLeadType(row, type) {
    const current = Array.isArray(row.allowed_lead_types) ? row.allowed_lead_types : [];
    const next = current.includes(type)
      ? current.filter((x) => x !== type)
      : [...current, type];

    updateProfile(row.id, { allowed_lead_types: next }, 'Updated allowed lead types');
  }

  function toggleProgramActive(row) {
    const nextActive = !row.lead_program_active;

    const patch = {
      lead_program_active: nextActive,
      lead_program_started_at: nextActive
        ? row.lead_program_started_at || new Date().toISOString()
        : null
    };

    updateProfile(
      row.id,
      patch,
      nextActive ? 'Activated 10-week lead program' : 'Deactivated 10-week lead program'
    );
  }

  function restartProgram(row) {
    updateProfile(
      row.id,
      {
        lead_program_active: true,
        lead_program_started_at: new Date().toISOString()
      },
      'Restarted 10-week lead program'
    );
  }

  function toggleCourseOverride(row) {
    const nextValue = !row.course_override_complete;

    updateProfile(
      row.id,
      { course_override_complete: nextValue },
      nextValue ? 'Overrode course completion' : 'Removed course override'
    );
  }

  const filteredRows = useMemo(() => {
    let next = rows.filter((row) => {
      const text = [
        row.display_name,
        row.email,
        row.discord_username,
        getProgramStatus(row),
        row.course_override_complete ? 'course complete override' : 'course required',
        Array.isArray(row.allowed_lead_types) ? row.allowed_lead_types.join(' ') : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(search.toLowerCase());
    });

    if (statusFilter !== 'all') {
      next = next.filter((row) => {
        const status = getProgramStatus(row).toLowerCase();

        if (statusFilter === 'active') return status === 'active';
        if (statusFilter === 'not_active') return status === 'not active';
        if (statusFilter === 'expired') return status === 'expired';
        if (statusFilter === 'paused') return status === 'paused';
        if (statusFilter === 'ineligible') return status === 'ineligible';
        if (statusFilter === 'course_complete') return !!row.course_override_complete;
        if (statusFilter === 'course_required') return !row.course_override_complete;

        return true;
      });
    }

    return next;
  }, [rows, search, statusFilter]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    return filteredRows.slice(0, Number(pageSize));
  }, [filteredRows, pageSize]);

  const columns = [
    { key: 'display_name', label: 'Agent' },
    { key: 'email', label: 'Email' },
    {
      key: 'lead_program_active',
      label: 'Program Status',
      render: (_value, row) => {
        const status = getProgramStatus(row);
        const isActive = status === 'Active';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className={isActive ? 'btn btn-primary btn-small' : 'btn btn-ghost btn-small'}
              onClick={() => toggleProgramActive(row)}
              type="button"
            >
              {row.lead_program_active ? 'Active' : 'Not Active'}
            </button>

            <div style={{ fontSize: 12, opacity: 0.75 }}>{status}</div>
          </div>
        );
      }
    },
    {
      key: 'lead_program_started_at',
      label: 'Started',
      render: (value) => formatDate(value)
    },
    {
      key: 'days_left',
      label: 'Days Left',
      render: (_value, row) => {
        const daysLeft = getDaysLeft(row);
        const status = getProgramStatus(row);

        if (!row.lead_program_active) return '—';

        return (
          <div
            style={{
              fontWeight: 800,
              color: daysLeft > 0 ? '#34d399' : '#f87171'
            }}
          >
            {status === 'Expired' ? 'Expired' : `${daysLeft} days`}
          </div>
        );
      }
    },
    {
      key: 'allowed_lead_types',
      label: 'Allowed Lead Types',
      render: (_value, row) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {leadTypes.map((type) => {
            const active = Array.isArray(row.allowed_lead_types)
              ? row.allowed_lead_types.includes(type)
              : false;

            return (
              <button
                key={type}
                className={active ? 'btn btn-primary btn-small' : 'btn btn-ghost btn-small'}
                onClick={() => toggleLeadType(row, type)}
                type="button"
              >
                {type}
              </button>
            );
          })}
        </div>
      )
    },
    {
      key: 'course_override_complete',
      label: 'Course',
      render: (value, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className={value ? 'btn btn-primary btn-small' : 'btn btn-ghost btn-small'}
            onClick={() => toggleCourseOverride(row)}
            type="button"
          >
            {value ? 'Complete' : 'Override Course'}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {value ? 'Course overridden' : 'Course required'}
          </div>
        </div>
      )
    },
    {
      key: 'leads_paused',
      label: 'Paused',
      render: (value, row) => (
        <button
          className="btn btn-ghost btn-small"
          onClick={() =>
            updateProfile(row.id, { leads_paused: !value }, 'Toggled leads paused')
          }
          type="button"
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },
    {
      key: 'lead_access_banned',
      label: 'Ineligible',
      render: (value, row) => (
        <button
          className="btn btn-danger btn-small"
          onClick={() =>
            updateProfile(row.id, { lead_access_banned: !value }, 'Toggled lead ineligible')
          }
          type="button"
        >
          {value ? 'Yes' : 'No'}
        </button>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_value, row) => (
        <button
          className="btn btn-ghost btn-small"
          onClick={() => restartProgram(row)}
          type="button"
        >
          Restart 10 Weeks
        </button>
      )
    }
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
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Agents</h1>
          <p>Manage 10-week lead program access, lead types, pauses, eligibility, and course overrides.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Agent name, email, status, lead type, or course..."
            />
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="not_active">Not Active</option>
              <option value="expired">Expired</option>
              <option value="paused">Paused</option>
              <option value="ineligible">Ineligible</option>
              <option value="course_complete">Course Complete</option>
              <option value="course_required">Course Required</option>
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

        {message ? <div className="top-gap">{message}</div> : null}
      </div>

      <div
        className="top-gap"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <DataTable columns={columns} rows={visibleRows} />
      </div>
    </div>
  );
}
