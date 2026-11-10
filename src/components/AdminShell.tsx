import Marca from './Marca';
import PerfilCuenta from './PerfilCuenta';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

interface AdminShellProps {
  children: React.ReactNode;
}

const menuItems = [
  { to: '/admin', label: 'Resumen', end: true, icon: 'resumen' },
  { to: '/admin/empresas', label: 'Empresas', end: false, icon: 'empresas' },
] as const;

function AdminIcon({ name }: { name: 'resumen' | 'empresas' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-current" aria-hidden="true">
      {name === 'resumen' ? (
        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>
      ) : (
        <><path d="M4 21V6l8-3 8 3v15"/><path d="M9 9h2M9 13h2M9 17h2M15 9h1M15 13h1M15 17h1"/></>
      )}
    </svg>
  );
}

export default function AdminShell({ children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-[#202a47]">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[280px] border-r border-[#e1e7f5] bg-white text-ink p-5 flex flex-col transition-transform duration-300 lg:translate-x-0 overflow-y-auto lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between mb-8">
            <Marca />
            <button
              type="button"
              className="lg:hidden text-slate-600 hover:text-ink"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#e9eeff] text-[#284bc2]'
                      : 'text-slate-600 hover:bg-[#f0f4ff] hover:text-[#284bc2]'
                  }`
                }
              >
                <AdminIcon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          />
        )}

        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
            <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="lg:hidden inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
                <div className="min-w-0">
                  
                  <h1 className="truncate text-base sm:text-lg font-semibold text-[#202a47]">Administración global</h1>
                </div>
              </div>

              <PerfilCuenta />
            </div>
          </header>

          <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
