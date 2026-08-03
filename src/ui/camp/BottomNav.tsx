import { Compass, Package, Users } from 'lucide-react';

export type TabId = 'heroes' | 'quests' | 'warehouse';

const TABS: { id: TabId; label: string; Icon: typeof Users }[] = [
  { id: 'heroes', label: 'Heroes', Icon: Users },
  { id: 'quests', label: 'Quest board', Icon: Compass },
  { id: 'warehouse', label: 'Warehouse', Icon: Package },
];

export function BottomNav({
  activeTab,
  onChangeTab,
}: {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}) {
  return (
    <div className="bottom-nav">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav-item${activeTab === id ? ' bottom-nav-item--active' : ''}`}
          data-testid={`mobile-tab-${id}`}
          onClick={() => onChangeTab(id)}
        >
          <Icon size={20} strokeWidth={2.75} />
          <div className="bottom-nav-label">{label}</div>
        </button>
      ))}
    </div>
  );
}
