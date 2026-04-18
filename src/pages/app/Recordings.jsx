import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../lib/utils';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac'
];

function matchesSearch(row, query) {
  if (!query) return true;

  const text = [
    row.file_name,
    row.leads?.first_name,
    row.leads?.last_name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

function startOfWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getGroupLabel(row, view) {
  const source = row.recorded_for_date || row.created_at;
  const d = new Date(source);

  if (Number.isNaN(d.getTime())) return row.created_at;

  if (view === 'daily') {
    return d.toISOString().slice(0, 10);
  }

  if (view === 'weekly') {
    return startOfWeek(d).toISOString().slice(0, 10);
  }

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getSafeFileName(file) {
  const raw = file?.name || `recording-${Date.now()}`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export default function Recordings() {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('daily');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState('50');

  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [recordedForDate, setRecordedForDate] = useState(new Date().toISOString().slice(0, 10));
  const [audioFile, setAudioFile] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from('lead_recordings')
      .select('*, leads(first_name,last_name)')
      .eq('agent_id', session.user.id)
      .order('created_at', { ascending: false });

    setRows(data || []);
  }

  async function handleUpload(e) {
    e.preventDefault();
    setStatusMessage('');

    try {
      if (!audioFile) {
        setStatusMessage('Choose an audio file first.');
        return;
      }

      if (audioFile.type && !ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
        setStatusMessage('That file type is not supported. Use mp3, wav, m4a, webm, or ogg.');
        return;
      }

      if (!recordedForDate) {
        setStatusMessage('Pick the recording date.');
        return;
      }

      setUploading(true);

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('No session found.');
        return;
      }

      const bucketName = 'recordings';
      const safeName = getSafeFileName(audioFile);
      const storagePath = `${session.user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, audioFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: audioFile.type || 'audio/mpeg'
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      const recordingUrl = publicUrlData?.publicUrl || null;

      if (!recordingUrl) {
        throw new Error('Could not create recording URL.');
      }

      const { error: insertError } = await supabase.from('lead_recordings').insert({
        agent_id: session.user.id,
        lead_id: null,
        recording_url: recordingUrl,
        file_name: audioFile.name || safeName,
        recorded_for_date: recordedForDate,
        uploaded_manually: true
      });

      if (insertError) {
        throw insertError;
      }

      setAudioFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setRecordedForDate(new Date().toISOString().slice(0, 10));
      setStatusMessage('Recording uploaded.');
      await load();
    } catch (error) {
      console.error('Failed to upload recording:', error);
      setStatusMessage(error.message || 'Failed to upload recording.');
    } finally {
      setUploading(false);
    }
  }

  const grouped = useMemo(() => {
    return rows
      .filter((row) => matchesSearch(row, search))
      .map((row) => ({
        ...row,
        group_label: getGroupLabel(row, view)
      }));
  }, [rows, view, search]);

  const visibleRows = useMemo(() => {
    if (pageSize === 'all') return grouped;
    return grouped.slice(0, Number(pageSize));
  }, [grouped, pageSize]);

  const columns = [
    {
      key: 'group_label',
      label: view === 'daily' ? 'Day' : view === 'weekly' ? 'Week' : 'Month',
      render: (v) => formatDate(v)
    },
    {
      key: 'leads',
      label: 'Lead',
      render: (_v, row) =>
        row.leads
          ? `${row.leads.first_name || ''} ${row.leads.last_name || ''}`.trim()
          : row.uploaded_manually
            ? 'Manual upload'
            : 'No lead attached'
    },
    { key: 'file_name', label: 'Recording' },
    {
      key: 'recording_url',
      label: 'Audio',
      render: (v) => (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={v} target="_blank" rel="noreferrer">
            Open
          </a>
          <a href={v} download>
            Download
          </a>
          <audio controls preload="none" src={v} style={{ maxWidth: 220 }} />
        </div>
      )
    },
    {
      key: 'recorded_for_date',
      label: 'Recording Date',
      render: (v, row) => formatDate(v || row.created_at)
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      render: (v) => formatDate(v)
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
          <h1>Recordings</h1>
          <p>Stored sit recordings by day, week, and month.</p>
        </div>

        <div className="segmented">
          <button className={view === 'daily' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('daily')}>
            Daily
          </button>
          <button className={view === 'weekly' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('weekly')}>
            Weekly
          </button>
          <button className={view === 'monthly' ? 'seg-btn active' : 'seg-btn'} onClick={() => setView('monthly')}>
            Monthly
          </button>
        </div>
      </div>

      <div className="glass" style={{ padding: 12, flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lead or file name..."
            />
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
          Showing {visibleRows.length} of {grouped.length} recordings
        </div>
      </div>

      <div className="glass top-gap" style={{ padding: 16, flexShrink: 0 }}>
        <h3 style={{ marginTop: 0 }}>Upload Recording</h3>

        <form onSubmit={handleUpload}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12
            }}
          >
            <label>
              Recording Date
              <input
                type="date"
                value={recordedForDate}
                onChange={(e) => setRecordedForDate(e.target.value)}
              />
            </label>

            <label>
              Audio File
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="top-gap" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Recording'}
            </button>

            {audioFile ? (
              <div style={{ fontSize: 14, opacity: 0.8 }}>
                Selected: {audioFile.name}
              </div>
            ) : null}
          </div>
        </form>
      </div>

      {statusMessage ? (
        <div className="glass top-gap" style={{ padding: 12, flexShrink: 0 }}>
          {statusMessage}
        </div>
      ) : null}

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
