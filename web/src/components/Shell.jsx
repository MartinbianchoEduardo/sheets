import { useEffect } from 'preact/hooks';
import { currentFaturaIdSignal } from '../lib/state.js';
import { useCurrentFatura } from '../hooks/useCurrentFatura.js';
import { Header } from './Header.jsx';
import { RolloverBanner } from './RolloverBanner.jsx';
import { Tabs } from './Tabs.jsx';
import { Deck } from './Deck.jsx';
import { Subpage } from './Subpage.jsx';
import { CategoryDrillSubpage } from './CategoryDrillSubpage.jsx';
import { Toast } from './Toast.jsx';
import { AddView } from '../views/AddView.jsx';
import { HistoryView } from '../views/HistoryView.jsx';
import { SummaryView } from '../views/SummaryView.jsx';
import { PainelView } from '../views/PainelView.jsx';
import { ConfigView } from '../views/ConfigView.jsx';
import { RegrasView } from '../views/RegrasView.jsx';
import { ImportView } from '../views/ImportView.jsx';

// Placeholder body for each tab. Real views land in Phases 4c–4f.
function ViewStub({ id, title }) {
  return (
    <section id={id} class="deck-page">
      <div class="empty">{title} — em breve</div>
    </section>
  );
}

export function Shell() {
  // Hydrate the current-fatura signal on first load.
  const { data: current } = useCurrentFatura();
  useEffect(() => {
    if (currentFaturaIdSignal.value == null && current?.fatura?.id) {
      currentFaturaIdSignal.value = current.fatura.id;
    }
  }, [current?.fatura?.id]);

  return (
    <>
      <div id="app" class="app">
        <Header />
        <RolloverBanner />
        <Tabs />
        <Deck>
          <AddView />
          <HistoryView />
          <SummaryView />
          <PainelView />
          <ConfigView />
        </Deck>
      </div>
      <Subpage regras={<RegrasView />} importar={<ImportView />} />
      <CategoryDrillSubpage />
      <Toast />
    </>
  );
}
