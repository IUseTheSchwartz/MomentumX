import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StatCard from '../../components/StatCard';
import { currency } from '../../lib/utils';

const PROGRAM_DAYS = 70;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function getProgramStart(profile) {
  return profile?.lead_program_started_at || null;
}

function getDaysLeft(profile) {
  if (!profile?.lead_program_active) return 0;

  const startValue = getProgramStart(profile);
  if (!startValue) return PROGRAM_DAYS;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  const elapsedMs = now.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  return Math.max(0, PROGRAM_DAYS - elapsedDays);
}

function getProgramStatus(profile) {
  if (!profile) return '—';
  if (profile.lead_access_banned) return 'Ineligible';
  if (profile.leads_paused) return 'Paused';
  if (!profile.lead_program_active) return 'Not Active';

  const daysLeft = getDaysLeft(profile);
  if (daysLeft <= 0) return 'Expired';

  return 'Active';
}

function getAllowedLeadTypes(profile) {
  if (!Array.isArray(profile?.allowed_lead_types) || profile.allowed_lead_types.length === 0) {
    return 'None';
  }

  return profile.allowed_lead_types.join(', ');
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [latestKpi, setLatestKpi] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const { data: kpiData } = await supabase
        .from('kpi_entries')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('entry_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      setProfile(profileData || null);
      setLatestKpi(kpiData || null);
    }

    load();
  }, []);

  const programStatus = getProgramStatus(profile);
  const daysLeft = getDaysLeft(profile);
  const allowedLeadTypes = getAllowedLeadTypes(profile);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Momentum X command center.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard label="Lead Type" value={allowedLeadTypes} />
        <StatCard label="Lead Status" value={programStatus} />
        <StatCard
          label="System Time Left"
          value={profile?.lead_program_active ? `${daysLeft} days` : '—'}
        />
        <StatCard label="Program Length" value="10 weeks" />
      </div>

      <div className="grid grid-3 top-gap">
        <StatCard label="Started" value={formatDate(profile?.lead_program_started_at)} />
        <StatCard label="Course Status" value={profile?.course_override_complete ? 'Complete' : 'Required'} />
        <StatCard label="Lead Access" value={profile?.lead_access_banned ? 'Ineligible' : 'Eligible'} />
      </div>

      <div className="grid grid-3 top-gap">
        <StatCard label="Latest Dials" value={latestKpi?.dials ?? 0} />
        <StatCard label="Latest Sits" value={latestKpi?.sits ?? 0} />
        <StatCard label="Latest Premium" value={currency(latestKpi?.premium_submitted ?? 0)} />
      </div>

      <div className="panel glass top-gap">
        <h2>Lead Program Summary</h2>
        <p>
          You are currently assigned to:{' '}
          <strong>{allowedLeadTypes}</strong>
        </p>
        <p>
          Status:{' '}
          <strong>{programStatus}</strong>
        </p>
        <p>
          Time left:{' '}
          <strong>{profile?.lead_program_active ? `${daysLeft} days remaining` : 'Not active'}</strong>
        </p>
      </div>
    </div>
  );
}
