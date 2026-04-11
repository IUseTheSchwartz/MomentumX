import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AdminRoute({ children }) {
  const [state, setState] = useState({
    loading: true,
    session: null,
    profile: null
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        if (mounted) setState({ loading: false, session: null, profile: null });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (mounted) setState({ loading: false, session, profile });
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) return <div className="page-center">Loading Admin...</div>;
  if (!state.session) return <Navigate to="/" replace />;
  if (state.profile?.lead_access_banned) return <Navigate to="/ineligible" replace />;
  if (!state.profile?.is_admin) return <Navigate to="/app/dashboard" replace />;

  return children;
}
