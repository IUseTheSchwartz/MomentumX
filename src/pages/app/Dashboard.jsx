import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StatCard from '../../components/StatCard';
import { currency } from '../../lib/utils';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [latestKpi, setLatestKpi] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, tiers(*)')
        .eq('id', session.user.id)
        .single();

      const { data: kpiData } = await supabase
        .from('kpi_entries')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('entry_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      setProfile(profileData);
      setTier(profileData?.tiers || null);
      setLatestKpi(kpiData);
    }

    load();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Momentum X command center.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard label="Current Tier" value={tier?.name || '—'} />
        <StatCard label="Lead Status" value={profile?.leads_paused ? 'Paused' : 'Active'} />
        <StatCard label="Allowed Lead Types" value={profile?.allowed_lead_types?.length || 0} />
        <StatCard label="KPI Required" value={tier?.kpi_required ? 'Yes' : 'No'} />
      </div>

      <div className="grid grid-3 top-gap">
        <StatCard label="Latest Dials" value={latestKpi?.dials ?? 0} />
        <StatCard label="Latest Sits" value={latestKpi?.sits ?? 0} />
        <StatCard label="Latest Premium" value={currency(latestKpi?.premium_submitted ?? 0)} />
      </div>

      <div className="panel glass top-gap">
        <h2>Tier Summary</h2>
        <p>{tier?.description || 'No tier summary yet.'}</p>
      </div>
    </div>
  );
}
