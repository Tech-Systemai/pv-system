'use client';

export type Integrations = { apify: boolean; claude: boolean };

const ITEMS: { key: keyof Integrations; label: string; needs: string; unlocks: string }[] = [
  { key: 'apify', label: 'Apify (Google Maps)', needs: 'APIFY_TOKEN and APIFY_WEBHOOK_SECRET', unlocks: 'Lead Generation can pull real businesses' },
  { key: 'claude', label: 'Claude (research)', needs: 'ANTHROPIC_API_KEY', unlocks: 'Research reads each lead\'s site and reviews and qualifies it' },
];

/** Shown to managers until every outside service the agents need is connected. */
export default function SetupChecklist({ integrations }: { integrations: Integrations }) {
  if (ITEMS.every(i => integrations[i.key])) return null;
  return (
    <div className="sc-card">
      <b>Connect the real agents</b>
      <span className="tb-sub">Add these in Vercel → the <code>system</code> project → Settings → Environment Variables, then redeploy.</span>
      <ul>
        {ITEMS.map(i => (
          <li key={i.key} className={integrations[i.key] ? 'ok' : ''}>
            <span>{integrations[i.key] ? '✓' : '○'}</span>
            <span><b>{i.label}</b> — {integrations[i.key] ? 'connected' : <><code>{i.needs}</code>. {i.unlocks}.</>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
