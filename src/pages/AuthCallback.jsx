import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message] = useState('Verifying access...');

  useEffect(() => {
    let active = true;

    async function run() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        navigate('/');
        return;
      }

      const providerToken = session.provider_token;

      if (!providerToken) {
        await supabase.auth.signOut();
        navigate('/denied');
        return;
      }

      const response = await fetch('/.netlify/functions/discord-membership-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerToken,
          userId: session.user.id,
          email: session.user.email,
          fullName:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email ||
            'Momentum Agent',
          avatarUrl: session.user.user_metadata?.avatar_url || null,
          discordId: session.user.user_metadata?.provider_id || null,
          discordUsername:
            session.user.user_metadata?.preferred_username ||
            session.user.user_metadata?.full_name ||
            session.user.email
        })
      });

      const data = await response.json();

      if (!active) return;

      if (!response.ok || !data.ok) {
        await supabase.auth.signOut();
        navigate('/denied');
        return;
      }

      if (data.banned) {
        navigate('/ineligible');
        return;
      }

      if (data.isAdmin) {
        navigate('/admin/overview');
        return;
      }

      navigate('/app/dashboard');
    }

    run();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <div className="page-center">{message}</div>;
}
