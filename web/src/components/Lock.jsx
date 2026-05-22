import { useState } from 'preact/hooks';
import { loginWithPasskey, registerDevice } from '../lib/auth.js';

// iOS Safari requires the WebAuthn ceremony to fire inside the user gesture
// that triggered it. Network awaits don't consume activation, but prompt()/
// alert()/confirm()/setTimeout() do — so the bootstrap secret is gathered via
// an inline <input>, not a modal prompt.
export function Lock() {
  const [busy, setBusy] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [bootstrap, setBootstrap] = useState('');
  const [msg, setMsg] = useState('Toque para entrar com Face ID');

  async function onLogin() {
    setBusy(true);
    try {
      await loginWithPasskey();
      // jwtSignal flip routes App away from <Lock/>
    } catch (err) {
      if (err.name === 'NotAllowedError') setMsg('Autenticação cancelada');
      else setMsg('Erro: ' + (err.message || err));
      setBusy(false);
    }
  }

  function onShowRegister(e) {
    e.preventDefault();
    setShowRegister(true);
    setMsg('Cole o bootstrap secret e toque registrar');
  }

  async function onRegister() {
    if (!bootstrap.trim()) {
      setMsg('Cole o bootstrap secret');
      return;
    }
    setBusy(true);
    try {
      await registerDevice(bootstrap.trim());
      setBootstrap('');
      setShowRegister(false);
      setMsg('Dispositivo registrado — toque Entrar');
    } catch (err) {
      if (err.name === 'NotAllowedError') setMsg('Registro cancelado');
      else setMsg('Erro: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="lock" class="lock">
      <h1>gastos<em>.</em></h1>
      <p id="lock-msg">{msg}</p>

      {!showRegister && (
        <button class="btn-primary" id="lock-btn" disabled={busy} onClick={onLogin}>
          {busy ? <span class="spinner" /> : 'Entrar'}
        </button>
      )}

      {showRegister && (
        <div id="register-form" style={{ marginTop: 8 }}>
          <div class="field">
            <label>Bootstrap secret</label>
            <input
              type="text"
              id="bootstrap-input"
              placeholder="Cole o segredo aqui"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellcheck={false}
              value={bootstrap}
              onInput={(e) => setBootstrap(e.currentTarget.value)}
            />
          </div>
          <button class="btn-primary" id="register-btn" disabled={busy} onClick={onRegister}>
            {busy ? <span class="spinner" /> : 'Registrar dispositivo'}
          </button>
        </div>
      )}

      {!showRegister && (
        <p style={{ marginTop: 32, fontSize: 13, textAlign: 'center', color: 'var(--text-mute)', fontStyle: 'normal' }}>
          <a
            id="register-link"
            href="#"
            onClick={onShowRegister}
            style={{ color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '1px dotted var(--text-mute)', paddingBottom: 2 }}
          >
            Registrar este dispositivo
          </a>
        </p>
      )}
    </div>
  );
}
