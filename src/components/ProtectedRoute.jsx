import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ProtectedRoute({ children }) {
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
        if (mounted) {
          setState({ loading: false, session: null, profile: null });
        }
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (mounted) {
        setState({ loading: false, session, profile });
      }
    }

    load();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setState({ loading: false, session: null, profile: null });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setState({ loading: false, session, profile });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state.loading) return <div className="page-center">Loading Momentum X...</div>;
  if (!state.session) return <Navigate to="/" replace />;
  if (state.profile?.lead_access_banned) return <Navigate to="/ineligible" replace />;

  return children;
}
