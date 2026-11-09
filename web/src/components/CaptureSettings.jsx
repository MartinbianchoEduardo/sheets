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
          <li>No Atalhos do iOS 27, crie um atalho chamado Gastos Wallet. Abra Editar → Automação.</li>
          <li>Escolha o gatilho Transação e selecione o cartão Itaú em Quando eu aproximar. Configure a execução imediata, sem confirmação.</li>
          <li>Adicione Obter Conteúdo de URL. Cole o endereço acima e abra as opções da ação.</li>
          <li>Escolha o método POST e o corpo da solicitação JSON.</li>
          <li>Nos cabeçalhos, adicione Authorization com o valor copiado, incluindo Bearer.</li>
          <li>No corpo JSON, adicione um campo de texto com a chave amount. No valor, selecione a variável Transação.</li>
          <li>Toque na variável Transação dentro desse valor e escolha a propriedade Amount / Valor.</li>
          <li>Adicione outro campo de texto com a chave description. Selecione Transação e escolha Merchant / Comerciante.</li>
          <li>Adicione Mostrar Notificação após a solicitação. Use Gastos como título e o resultado Conteúdo de URL como texto.</li>
          <li>Salve a automação. A resposta com ok e saved verdadeiros indica que o registro foi salvo.</li>
        </ol>
        <p>Os nomes variam conforme o idioma e o iOS. A variável pode aparecer como Entrada do Atalho. A Apple não publica a lista completa de propriedades da Transação.</p>
        <p>Os valores devem ser variáveis, não as palavras Amount ou Merchant. Não envie o objeto Transação inteiro.</p>
        <p>O servidor gera o identificador. Não é necessário adicionar Gerar UUID ou event_id.</p>
        <p>O Gastos lê o corpo JSON sem exigir o cabeçalho Content-Type. Não é necessário adicioná-lo manualmente.</p>
        <p>O valor deve estar em reais. A data e a hora usam o momento de recebimento em São Paulo.</p>
        <p>A automação precisa de internet. Não há reenvio automático sem conexão.</p>
        <p>Uma nova execução cria um novo registro, mesmo com o mesmo valor e estabelecimento.</p>
        <p>Este método usa os campos do Wallet, não interpreta texto livre de notificações. Compras recusadas podem exigir exclusão manual.</p>
      </details>
    </>}
  </div>;
}
