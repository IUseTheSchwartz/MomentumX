import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ProtectedRoute({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(nextSession) {
      if (!mounted) return;

      if (!nextSession) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setProfile(null);
      } else {
        setProfile(data || null);
      }

      setProfileLoading(false);
    }

    async function init() {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(initialSession ?? null);
      setAuthLoading(false);
      await loadProfile(initialSession ?? null);
    }

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession ?? null);
      setAuthLoading(false);
      await loadProfile(nextSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading || session === undefined) {
    return <div className="page-center">Loading Momentum X...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading) {
    return <div className="page-center">Loading Momentum X...</div>;
  }

  if (profile?.lead_access_banned) {
    return <Navigate to="/ineligible" replace />;
  }

  return children;
}
