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

    async function refreshFromSession() {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession ?? null);
      setAuthLoading(false);
      await loadProfile(currentSession ?? null);
    }

    async function init() {
      await refreshFromSession();
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

    async function handleVisibilityWake() {
      if (document.visibilityState !== 'visible') return;
      await refreshFromSession();
    }

    async function handleWindowFocus() {
      await refreshFromSession();
    }

    document.addEventListener('visibilitychange', handleVisibilityWake);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityWake);
      window.removeEventListener('focus', handleWindowFocus);
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
