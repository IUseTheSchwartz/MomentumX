// src/pages/Landing.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Starfield from '../components/Starfield';

function hasOAuthParams() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  return (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    hash.includes('error=') ||
    search.includes('code=') ||
    search.includes('error=')
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [showX, setShowX] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (hasOAuthParams()) {
      navigate('/auth/callback', { replace: true });
      return;
    }

    async function bootstrap() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted || !session) return;

      // Normal restored session should go straight into app routing,
      // not back through OAuth callback handling.
      navigate('/app/dashboard', { replace: true });
    }

    bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Fresh login or restored valid session should go into the app.
      if (
        session &&
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION')
      ) {
        navigate('/app/dashboard', { replace: true });
      }
    });

    const timer = setTimeout(() => {
      if (mounted) setShowX(true);
    }, 500);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  async function loginWithDiscord() {
    if (loggingIn) return;

    setLoggingIn(true);

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo,
          scopes: 'identify email guilds guilds.members.read'
        }
      });

      if (error) {
        console.error('[Landing] Discord login failed', error);
        setLoggingIn(false);
      }
    } catch (error) {
      console.error('[Landing] Discord login failed', error);
      setLoggingIn(false);
    }
  }

  return (
    <div className="landing landing-full">
      <Starfield />

      <section className="landing-hero">
        <div className="hero-wordmark">
          <span className="momentum-word">MOMENTUM</span>
          <span className={showX ? 'x-mark visible' : 'x-mark'}>X</span>
        </div>

        <p className="landing-subcopy">
          Performance-based lead access for agents who produce, stay accountable,
          and scale with consistency.
        </p>

        <button
          className="btn btn-primary landing-login"
          onClick={loginWithDiscord}
          disabled={loggingIn}
        >
          {loggingIn ? 'Redirecting...' : 'Login with Discord'}
        </button>
      </section>

      <section className="landing-info">
        <div className="info-block glass">
          <h2>What the system is used for</h2>
          <p>
            Momentum X is built to get new agents producing faster, reward performance,
            scale top producers, and maximize every lead opportunity.
          </p>
        </div>

        <div className="info-grid">
          <div className="info-card glass">
            <h3>Tier 1</h3>
            <p>Foundation phase. Build work ethic, activity, and consistency.</p>
          </div>

          <div className="info-card glass">
            <h3>Tier 2</h3>
            <p>Development phase. Proven producers get access to better lead flow and more opportunity.</p>
          </div>

          <div className="info-card glass">
            <h3>Tier 3</h3>
            <p>Scale phase. Reserved for strong, consistent producers who maintain volume.</p>
          </div>
        </div>

        <div className="info-block glass">
          <h2>Bottom line</h2>
          <p>
            Produce → Earn More Leads → Scale Faster → Keep More Income
          </p>
        </div>
      </section>
    </div>
  );
}
