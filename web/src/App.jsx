import { useEffect } from 'preact/hooks';
import { jwtSignal } from './lib/state.js';
import { bootRefresh } from './lib/auth.js';
import { Lock } from './components/Lock.jsx';

// Rewrite-only environment badge. Remove at Phase 5 cutover.
function EnvBadge() {
  const url = window.__GASTOS_CONFIG__?.WORKER_URL ?? '';
  const env = url.includes('staging') ? 'staging' : 'live';
  const color = env === 'staging' ? '#c97a00' : '#1f7a1f';
  return (
    <div style={{
      position: 'fixed', top: 8, right: 8,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontFamily: 'system-ui, sans-serif',
      background: color, color: 'white', opacity: 0.85,
      pointerEvents: 'none', zIndex: 1000,
    }}>
      {env}
    </div>
  );
}

export function App() {
  // One-shot at boot: if sessionStorage held a JWT, try to refresh it for a
  // tap-skip experience. On failure, clear it and fall through to Lock.
  useEffect(() => { bootRefresh(); }, []);

  return (
    <>
      <EnvBadge />
      {jwtSignal.value ? <h1>logged in</h1> : <Lock />}
    </>
  );
}
