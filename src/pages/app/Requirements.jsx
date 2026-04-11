import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function Section({ title, children }) {
  return (
    <div className="panel glass top-gap">
      <h2>{title}</h2>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

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
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Requirements</h1>
          <p>MomentumX Team Lead System and expectations.</p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          paddingRight: 4
        }}
      >
        <div className="panel glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginBottom: 8 }}>MOMENTUMX TEAM LEAD SYSTEM</h2>
              <p style={{ margin: 0 }}>
                Leads, systems, and opportunities are earned through performance.
              </p>
            </div>

            <div className="pill" style={{ alignSelf: 'flex-start' }}>
              Current Tier: {tier?.name || 'No Tier'}
            </div>
          </div>
        </div>

        <Section title="Purpose">
          <p>We are scaling fast with a large volume of high-quality leads.</p>
          <BulletList
            items={[
              'Get new agents producing quickly',
              'Reward performance',
              'Scale top producers',
              'Maximize every lead opportunity',
              'You keep your full commission',
              'Leads, systems, and opportunities are earned through performance'
            ]}
          />
        </Section>

        <Section title="Tier System Overview">
          <p>All tiers receive lead opportunities. Advancement after Tier 1 is based on performance, not time.</p>
        </Section>

        <Section title="Tier 1: Foundation (First 30 Days)">
          <p><strong>Leads Per Month:</strong></p>
          <BulletList items={['500 aged leads']} />

          <p style={{ marginTop: 16 }}><strong>Requirements:</strong></p>
          <BulletList
            items={[
              'Track ALL KPIs daily',
              'Dials / Contacts',
              'Close Rate',
              'Premium Submitted',
              'Record 2 sits per week and review them with your manager',
              'Must attend all team meetings unless approved reason',
              'Must dial unmuted no exceptions'
            ]}
          />

          <p style={{ marginTop: 16 }}><strong>Focus:</strong></p>
          <BulletList
            items={[
              'Build work ethic',
              'Master activity',
              'Learn the system'
            ]}
          />
        </Section>

        <Section title="Tier 2: Development (Proven Producers)">
          <p><strong>Leads Per Month:</strong></p>
          <BulletList items={['60 Fresh Leads', '500 Total Leads']} />

          <p style={{ marginTop: 16 }}><strong>Additional Benefits:</strong></p>
          <BulletList items={['Access to Dialer (once proven)']} />

          <p style={{ marginTop: 16 }}><strong>Requirements:</strong></p>
          <BulletList
            items={[
              'Track ALL KPIs',
              'Maintain consistent performance',
              'Record 1 sit per week and review it with your manager',
              'Required to buy 1 to stay and 2 to advance fresh lead packs/month (Agent Lead Labs)',
              '2 videos per week on Instagram'
            ]}
          />

          <p style={{ marginTop: 16 }}><strong>Focus:</strong></p>
          <BulletList
            items={[
              'Improve conversions',
              'Increase close rate',
              'Scale consistency'
            ]}
          />
        </Section>

        <Section title="Tier 3: Scale (Top Producers)">
          <p><strong>Leads Per Month:</strong></p>
          <BulletList items={['100 Fresh Leads', '600 Total Leads']} />

          <p style={{ marginTop: 16 }}><strong>Requirements:</strong></p>
          <BulletList
            items={[
              'Maintain high production',
              'Required: Purchase 4 fresh lead packs/month (Agent Lead Labs)',
              '2-3 videos on Instagram per week'
            ]}
          />

          <p style={{ marginTop: 16 }}><strong>KPI Tracking:</strong></p>
          <BulletList
            items={[
              'Not required unless production drops for 2 consecutive weeks',
              'Then full KPI tracking resumes temporarily'
            ]}
          />

          <p style={{ marginTop: 16 }}><strong>Focus:</strong></p>
          <BulletList
            items={[
              'Maximize volume',
              'Increase efficiency',
              'Scale income'
            ]}
          />
        </Section>

        <Section title="Tier 2 → Tier 3 Promotion">
          <p>Agents can qualify for Tier 3 through either of the following paths:</p>

          <p><strong>Option 1: Monthly Production</strong></p>
          <BulletList items={['Submit $45K+ in a single month']} />

          <p style={{ marginTop: 16 }}><strong>Option 2: Weekly Consistency</strong></p>
          <BulletList items={['Submit $12K+ per week for 2 consecutive weeks']} />

          <p style={{ marginTop: 16 }}>
            Tier 3 is reserved for agents who demonstrate consistent, reliable production.
          </p>
        </Section>

        <Section title="Tier 3 Maintenance">
          <BulletList
            items={[
              'Must NOT fall below $10K per week for 2 consecutive weeks',
              'If this occurs, agent may be moved back to Tier 2',
              'Full KPI tracking will resume until performance improves'
            ]}
          />
        </Section>

        <Section title="Promotion Rules (General)">
          <BulletList
            items={[
              'Tier 1 = First 30 days in the business',
              'Advancement is based on performance, not time (after Tier 1)',
              'Leads follow production. Always.'
            ]}
          />
        </Section>

        <Section title="Accountability Rules">
          <p>To continue receiving leads:</p>
          <BulletList
            items={[
              'Leads must be worked immediately',
              'No sitting on leads',
              'Consistent activity is required',
              'KPI tracking (Tier 1 & Tier 2) is mandatory'
            ]}
          />

          <p style={{ marginTop: 16 }}>Failure to meet expectations may result in:</p>
          <BulletList
            items={[
              'Reduced lead volume',
              'Removal from lead program'
            ]}
          />
        </Section>

        <Section title="How You Win In This System">
          <BulletList
            items={[
              'You keep 100% of your commissions',
              'You earn more leads through performance',
              'You scale your income by producing consistently',
              'The more you produce, the more opportunity you receive'
            ]}
          />
        </Section>

        <Section title="Bottom Line">
          <p style={{ fontWeight: 700, margin: 0 }}>
            Produce → Earn More Leads → Scale Faster → Keep More Income
          </p>
        </Section>
      </div>
    </div>
  );
}
