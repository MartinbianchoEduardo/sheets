import { useEffect, useRef } from 'preact/hooks';
import { selectedTabSignal, isIOSuppressed } from '../lib/state.js';

// IO mirrors the visible page into the signal so swipes update the active pill.
// Scrolling is imperative (lib/state.js#setTab) — no effect re-scrolls when the
// signal changes, which is what caused jump-to-wrong-tab and clunky swipes.
export function Deck({ children }) {
  const deckRef = useRef(null);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const io = new IntersectionObserver((entries) => {
      if (isIOSuppressed()) return;
      entries.forEach(entry => {
        if (entry.intersectionRatio >= 0.5) {
          const name = entry.target.id.replace('view-', '');
          if (selectedTabSignal.value !== name) selectedTabSignal.value = name;
        }
      });
    }, { root: deck, threshold: [0.5] });
    deck.querySelectorAll('.deck-page').forEach(p => io.observe(p));
    return () => io.disconnect();
  }, []);

  return (
    <div class="deck" id="deck" ref={deckRef}>
      {children}
    </div>
  );
}
