import { useState } from 'preact/hooks';
import { useCaptureStatus, useCaptureKey } from '../hooks/useCapture.js';
import { useToast } from './Toast.jsx';

export function CaptureSettings() {
  const status = useCaptureStatus();
  const rotate = useCaptureKey('rotate');
  const revoke = useCaptureKey('revoke');
  const [key, setKey] = useState('');
  const toast = useToast();
  const endpoint = (window.__GASTOS_CONFIG__?.WORKER_URL || '').replace(/\/$/, '') + '/capture/wallet';
  const busy = rotate.isPending || revoke.isPending;

  async function changeKey(action) {
    try {
      const result = await action.mutateAsync();
      setKey(result.key || '');
      action.reset();
      toast(result.key ? 'Chave criada · copie para o Atalhos' : 'Automação desconectada', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Não foi possível alterar a chave', 'err');
    }
  }

  async function copy(value) {
    try { await navigator.clipboard.writeText(value); toast('Copiado', 'ok'); }
    catch { toast('Não foi possível copiar · selecione o texto', 'err'); }
  }

  return <div class="config-section capture-settings">
    <h3>Apple Wallet · Atalhos</h3>
    {status.isLoading && <p>Carregando…</p>}
    {status.isError && <p>Não foi possível carregar a automação <button class="config-btn" onClick={() => status.refetch()}>tentar novamente</button></p>}
    {status.data && <>
      <p>{status.data.enabled ? 'Chave ativa' : 'Automação desconectada'} · {status.data.card}</p>
      <p>Aplica suas regras de categoria e registra direto no histórico com ⚡</p>
      <div class="config-btn-row">
        <button class="config-btn" disabled={busy} onClick={() => changeKey(rotate)}>{status.data.enabled ? 'gerar nova chave' : 'conectar Atalhos'}</button>
        {status.data.enabled && <button class="config-btn" disabled={busy} onClick={() => changeKey(revoke)}>desconectar</button>}
      </div>
      {status.data.enabled && <p>Uma nova chave substitui a anterior. Atualize o Atalhos após a troca.</p>}
      {key && <div class="capture-secret">
        <label>Authorization<input type="text" readOnly value={`Bearer ${key}`} aria-label="Chave privada do Atalhos" /></label>
        <button class="config-btn" onClick={() => copy(`Bearer ${key}`)}>copiar autorização</button>
        <p>Copie agora. A chave não aparece novamente após recarregar a página. Não compartilhe o atalho com a chave.</p>
        <button class="config-btn" onClick={() => setKey('')}>ocultar chave</button>
      </div>}
      <label>Endereço<input type="text" readOnly value={endpoint} /></label>
      <button class="config-btn" onClick={() => copy(endpoint)}>copiar endereço</button>
      <details>
        <summary>Como configurar no iPhone</summary>
        <ol>
          <li>No Atalhos, crie uma automação Wallet / Transação para o cartão Itaú Latam Pass.</li>
          <li>Ative a execução imediata. Permita a execução com o iPhone bloqueado, se essa opção aparecer.</li>
          <li>Na própria automação, extraia Amount e Merchant da Entrada do Atalho. Toque na variável para escolher cada propriedade.</li>
          <li>Adicione Gerar UUID. Use o resultado em event_id.</li>
          <li>Adicione Obter Conteúdo de URL com o endereço acima e método POST.</li>
          <li>Nos cabeçalhos, adicione Authorization com o valor copiado e Content-Type com application/json.</li>
          <li>No corpo JSON, adicione amount com Amount, description com Merchant e event_id com o UUID.</li>
          <li>Confira o campo ok da resposta. Se for verdadeiro, mostre uma notificação de registro concluído.</li>
        </ol>
        <p>Não envie o objeto Transação inteiro. Envie os campos Amount e Merchant separadamente.</p>
        <p>O valor deve estar em reais. A data e a hora usam o momento de recebimento em São Paulo.</p>
        <p>A automação precisa de internet. Não há reenvio automático sem conexão.</p>
        <p>Este método usa os campos do Wallet, não interpreta texto livre de notificações. Compras recusadas podem exigir exclusão manual.</p>
      </details>
    </>}
  </div>;
}
