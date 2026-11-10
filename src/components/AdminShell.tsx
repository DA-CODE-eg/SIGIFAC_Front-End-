import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface AdminShellProps {
  children: React.ReactNode;
}

const menuItems = [
  { to: '/admin', label: 'Resumen', end: true, icon: 'resumen' },
  { to: '/admin/empresas', label: 'Empresas', end: false, icon: 'empresas' },
] as const;

function AdminIcon({ name }: { name: 'resumen' | 'empresas' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/90" aria-hidden="true">
      {name === 'resumen' ? (
        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>
      ) : (
        <><path d="M4 21V6l8-3 8 3v15"/><path d="M9 9h2M9 13h2M9 17h2M15 9h1M15 13h1M15 17h1"/></>
      )}
    </svg>
  );
}

export default function AdminShell({ children }: AdminShellProps) {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#eef2f7] text-[#253043]">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-[#102b46] text-white p-5 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-2xl font-bold tracking-tight">SIGIFAC</p>
            </div>
            <button
              type="button"
              className="lg:hidden text-slate-200 hover:text-white"
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
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/12 text-white shadow-sm'
                      : 'text-slate-200 hover:bg-white/8 hover:text-white'
                  }`
                }
              >
                <AdminIcon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-white/8 border border-white/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300 mb-2">Superadministrador</p>
            <p className="text-sm font-semibold text-white">{usuario?.nombreCompleto ?? 'Administrador SIGIFAC'}</p>
            <p className="text-xs text-slate-400 mt-1">{usuario?.correo}</p>
            <p className="mt-3 inline-flex rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
              {usuario?.rol ?? 'SUPER_ADMIN'}
            </p>
            <button
              onClick={cerrarSesion}
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
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
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#eef2f7]/90 backdrop-blur">
            <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="lg:hidden inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
                <div>
                  
                  <h1 className="text-lg sm:text-xl font-semibold text-[#253043]">SIGIFAC · Panel maestro</h1>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <div className="h-10 w-10 rounded-full bg-[#102b46] text-white flex items-center justify-center text-xs font-bold">
                  SA
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#253043]">{usuario?.nombreCompleto}</p>
                  
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
