import { memo, useEffect, useState } from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z' },
  { id: 'chart', label: 'Price chart', icon: 'M3 15l4-5 3 3 4-6 3 4M3 17h14' },
  { id: 'trades', label: 'Trade tape', icon: 'M4 5h12M4 10h12M4 15h8' },
  { id: 'controls', label: 'Feed controls', icon: 'M5 3v14M10 3v14M15 3v14M3 7h4M8 12h4M13 6h4' },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]['id'];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar = memo(function Sidebar({ open, onClose }: SidebarProps) {
  const [active, setActive] = useState<SectionId>('overview');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <aside id="sidebar" className="sidebar" data-open={open}>
        <div className="sidebar__brand">
          <div>
            <strong className="sidebar__name">Technical Assessment</strong>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Dashboard sections">
          <p className="sidebar__heading">Dashboard</p>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="nav-link"
              aria-current={active === item.id ? 'true' : undefined}
              onClick={() => {
                setActive(item.id);
                onClose();
              }}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
    </>
  );
});
