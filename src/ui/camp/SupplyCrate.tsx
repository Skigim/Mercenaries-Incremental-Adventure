import { getItem } from '../../core/catalog';
import { countItems } from '../../core/pack';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId } from '../../core/types';

function monogram(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function SupplyCrate({
  state,
  selectedHeroId,
  run,
  variant,
}: {
  state: GameState;
  selectedHeroId: HeroId;
  run: (cmd: Command) => GameEvent[];
  variant: 'desktop' | 'mobile';
}) {
  const totalItems = countItems(state.warehouse);

  const list = (
    <>
      {state.warehouse.map((stack) => {
        const def = getItem(stack.itemId);
        if (!def) return null;
        const isTrinket = def.kind === 'trinket';
        return (
          <div
            key={stack.itemId}
            className={`item-row${isTrinket ? ' item-row--trinket' : ''}`}
            data-testid={`warehouse-${stack.itemId}`}
          >
            <div className="item-left">
              <div
                className="item-chip"
                style={{
                  background: isTrinket ? 'var(--color-accent-500)' : 'var(--color-neutral-300)',
                  color: isTrinket ? '#fff' : 'var(--color-neutral-800)',
                }}
              >
                {monogram(def.name)}
              </div>
              <span className="item-name">{def.name} x{stack.qty}</span>
            </div>
            {isTrinket ? (
              <button
                type="button"
                className="btn btn-ghost"
                data-testid={`equip-${stack.itemId}`}
                onClick={() => run({ type: 'equip', heroId: selectedHeroId, itemId: stack.itemId })}
              >
                Equip
              </button>
            ) : (
              <span className="item-value">{def.baseValue}g</span>
            )}
          </div>
        );
      })}
    </>
  );

  if (variant === 'desktop') {
    return (
      <div className="card elev-sm supply-crate">
        <div className="card-kicker">Supply crate</div>
        <p className="supply-crate-total" data-testid="warehouse-total">
          {totalItems} <span className="mobile-warehouse-total-label">items</span>
        </p>
        {list}
      </div>
    );
  }

  return (
    <>
      <div className="mobile-tab-fixed">
        <p className="mobile-warehouse-total" data-testid="warehouse-total">
          {totalItems} <span className="mobile-warehouse-total-label">items</span>
        </p>
      </div>
      <div className="mobile-tab-scroll">
        <div className="card elev-sm">{list}</div>
      </div>
    </>
  );
}
