// ABOUTME: Renders Movie Log's desktop rail and mobile navigation from one archive view register.
// ABOUTME: Keeps icon, label, active-state, and logging-action behavior consistent across shell sizes.
import type { ArchiveView } from '../archive-model.js';
import {
  navigationItems,
  readNavigationView,
  type NavigationView,
  type NavIconName
} from './archive-navigation-data.js';

const navIconPaths: Record<NavIconName, string> = {
  diary: 'M3.5 2h8v12h-8zM3.5 5h8M6 8h3M6 10.5h3',
  library: 'M2.5 2.5h4.6v11H2.5zM8.9 2.5h4.6v11H8.9zM4.8 5h0M11.2 5h0',
  search: 'M6.6 2.6a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM9.6 9.6l3.6 3.6',
  settings: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11M5.5 3v3M10.5 6.5v3M7.5 10v3',
  statistics: 'M3 13.5V8M6.5 13.5V4.5M10 13.5V10M13.5 13.5V2.5'
};

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg aria-hidden="true" className="nav-icon" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path
        d={navIconPaths[name]}
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="1.2"
      />
    </svg>
  );
}

interface ArchiveNavigationProps {
  activeView: ArchiveView;
  onOpenLogPanel(): void;
  onViewChange(view: ArchiveView): void;
}

function NavigationButton({
  activeView,
  mobile,
  onViewChange,
  item
}: {
  activeView: NavigationView;
  item: (typeof navigationItems)[number];
  mobile: boolean;
  onViewChange(view: ArchiveView): void;
}) {
  return (
    <button
      aria-label={item.label}
      aria-current={activeView === item.view ? 'page' : undefined}
      className={mobile ? 'mobile-nav-item' : 'nav-item'}
      onClick={() => onViewChange(item.view)}
      type="button"
    >
      <NavIcon name={item.icon} />
      <span className={mobile ? undefined : 'nav-item-label'}>{mobile ? item.mobileLabel : item.label}</span>
      {mobile ? null : <span className="nav-item-index">{item.index}</span>}
    </button>
  );
}

export function ArchiveNavigation({ activeView, onOpenLogPanel, onViewChange }: ArchiveNavigationProps) {
  const activeNavigationView = readNavigationView(activeView);

  return (
    <>
      <div className="brand-mark">
        <span>ML</span>
        <small>Archive</small>
      </div>
      <nav aria-label="Primary" className="primary-navigation">
        {navigationItems.map((item) => (
          <NavigationButton
            activeView={activeNavigationView}
            item={item}
            key={item.view}
            mobile={false}
            onViewChange={onViewChange}
          />
        ))}
      </nav>
      <button className="log-action" onClick={onOpenLogPanel} type="button">
        <span aria-hidden="true" className="log-action-plus">
          +
        </span>
        Log a Film
      </button>
      <p className="rail-caption">A private register of watched things.</p>
    </>
  );
}

export function MobileArchiveNavigation({ activeView, onViewChange }: ArchiveNavigationProps) {
  const activeNavigationView = readNavigationView(activeView);

  return (
    <>
      {navigationItems.map((item) => (
        <NavigationButton
          activeView={activeNavigationView}
          item={item}
          key={item.view}
          mobile
          onViewChange={onViewChange}
        />
      ))}
    </>
  );
}
