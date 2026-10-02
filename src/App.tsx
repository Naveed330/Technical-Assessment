import { useCallback, useState } from 'react';
import { ConnectionBar } from './components/ConnectionBar';
import { Controls } from './components/Controls';
import { EventsList } from './components/EventsList';
import { Footer } from './components/Footer';
import { KpiCards } from './components/KpiCards';
import { LiveChart } from './components/LiveChart';
import { Sidebar } from './components/Sidebar';
import { appConfig } from './config';
import { useLiveStream } from './hooks/useLiveStream';
import { LiveStoreContext } from './store/context';
import type { Filters } from './types/filters';

export default function App() {
  const { store, retry } = useLiveStream(appConfig);
  const [filters, setFilters] = useState<Filters>({ windowSec: 300, side: 'all' });
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <LiveStoreContext.Provider value={store}>
      <div className="shell">
        <Sidebar open={navOpen} onClose={closeNav} />

        <div className="shell__main">
          <header className="topbar">
            <button
              type="button"
              className="topbar__menu"
              aria-label="Open navigation"
              aria-controls="sidebar"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="topbar__text">
              <h1 className="topbar__title">Technical Assessment — Front-End Developer (React) By Naveed Aslam · Live Monitoring Dashboard</h1>
            </div>
          </header>

          <main className="content">
            <ConnectionBar symbol={appConfig.symbol} onRetry={retry} />
            <Controls filters={filters} onFiltersChange={setFilters} />

            <section id="overview" className="section" aria-labelledby="overview-title">
              <div className="section__head">
                <h2 id="overview-title" className="section__title">Overview</h2>
                <span className="section__note">24h ticker, selected window and stream health</span>
              </div>
              <KpiCards windowSec={filters.windowSec} />
            </section>

            <div className="dashboard-grid">
              <LiveChart windowSec={filters.windowSec} />
              <EventsList side={filters.side} windowSec={filters.windowSec} />
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </LiveStoreContext.Provider>
  );
}
