import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Requirements() {
  const [tier, setTier] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from('profiles')
        .select('tiers(*)')
        .eq('id', session.user.id)
        .single();

      setTier(data?.tiers || null);
    }

    load();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Requirements</h1>
          <p>Tier expectations and what you need to maintain.</p>
        </div>
      </div>

      <div className="panel glass">
        <h2>{tier?.name || 'No Tier'}</h2>
        <p>{tier?.description || 'No requirements loaded yet.'}</p>
      </div>

      <div className="panel glass top-gap">
        <h2>Rules</h2>
        <pre className="json-preview">
          {JSON.stringify(tier?.requirements_json || {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
