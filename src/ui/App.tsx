import { useState } from 'react';
import { HeroCard } from './HeroCard';
import { MissionList } from './MissionList';
import { Warehouse } from './Warehouse';
import { WelcomeBack } from './WelcomeBack';
import { useGame } from './useGame';
import './styles.css';

export function App() {
  const { state, now, welcomeBack, dismissWelcome, run } = useGame();
  const [selectedHeroId, setSelectedHeroId] = useState(state.heroes[0]!.id);

  return (
    <main className="app">
      <h1>MerchantNext</h1>

      {welcomeBack && <WelcomeBack events={welcomeBack} onDismiss={dismissWelcome} />}

      <button data-testid="collect-all" onClick={() => run({ type: 'collectAll' })}>
        Collect all
      </button>

      <section className="heroes">
        {state.heroes.map((hero) => (
          <HeroCard key={hero.id} hero={hero} now={now} run={run} />
        ))}
      </section>

      <MissionList
        state={state}
        selectedHeroId={selectedHeroId}
        onSelectHero={setSelectedHeroId}
        run={run}
      />

      <Warehouse state={state} run={run} />
    </main>
  );
}
