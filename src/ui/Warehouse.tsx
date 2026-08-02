import { getItem } from '../core/catalog';
import { countItems } from '../core/pack';
import type { Command } from '../core/commands';
import type { GameState } from '../core/types';

export function Warehouse({
  state,
  run,
}: {
  state: GameState;
  run: (cmd: Command) => void;
}) {
  return (
    <section className="warehouse">
      <h2>Warehouse</h2>
      <p data-testid="warehouse-total">{countItems(state.warehouse)} items</p>

      <ul>
        {state.warehouse.map((stack) => {
          const def = getItem(stack.itemId);
          if (!def) return null;
          return (
            <li key={stack.itemId} data-testid={`warehouse-${stack.itemId}`}>
              {def.name} x{stack.qty}
              <span className="value"> ({def.baseValue}g each)</span>
              {def.kind === 'trinket' && (
                <button
                  onClick={() =>
                    run({
                      type: 'equip',
                      heroId: state.heroes[0]!.id,
                      itemId: stack.itemId,
                    })
                  }
                >
                  Equip to {state.heroes[0]!.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
