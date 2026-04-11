import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Starfield from '../components/Starfield';

export default function Landing() {
  const navigate = useNavigate();
  const [showX, setShowX] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hash = window.location.hash || '';
    const search = window.location.search || '';

    if (
      hash.includes('access_token=') ||
      hash.includes('refresh_token=') ||
      search.includes('code=')
    ) {
      navigate('/auth/callback', { replace: true });
      return;
    }

    async function bootstrap() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (mounted && session) {
        navigate('/auth/callback', { replace: true });
      }
    }

    bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (
        session &&
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION')
      ) {
        navigate('/auth/callback', { replace: true });
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
    const redirectTo = `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
        scopes: 'identify guilds guilds.members.read'
      }
    });
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

        <button className="btn btn-primary landing-login" onClick={loginWithDiscord}>
          Login with Discord
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
