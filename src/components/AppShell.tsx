import Marca from './Marca';
import PerfilCuenta from './PerfilCuenta';
import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';
import { tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

interface AppShellProps {
  children: React.ReactNode;
}

interface MenuItem {
  to: string;
  label: string;
  permiso?: string;
  icon: IconName;
}

type IconName =
  | 'dashboard'
  | 'productos'
  | 'inventario'
  | 'carga'
  | 'clientes'
  | 'proveedores'
  | 'facturas'
  | 'certificacion'
  | 'notificaciones'
  | 'reportes'
  | 'usuarios'
  | 'roles';

const menuItems: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard', permiso: 'DASHBOARD_VER', icon: 'dashboard' },
  { to: '/productos', label: 'Productos', permiso: 'PRODUCTOS_VER', icon: 'productos' },
  { to: '/inventario', label: 'Inventario', permiso: 'INVENTARIOS_VER', icon: 'inventario' },
  { to: '/carga-masiva', label: 'Carga masiva', permiso: 'CARGA_MASIVA', icon: 'carga' },
  { to: '/clientes', label: 'Clientes', permiso: 'CLIENTES_VER', icon: 'clientes' },
  { to: '/proveedores', label: 'Proveedores', permiso: 'PROVEEDORES_VER', icon: 'proveedores' },
  { to: '/facturas', label: 'Facturación', permiso: 'FACTURAS_VER', icon: 'facturas' },
  { to: '/certificacion', label: 'Certificación', permiso: 'CERTIFICACION_VER', icon: 'certificacion' },
  { to: '/notificaciones', label: 'Notificaciones', permiso: 'NOTIFICACIONES_VER', icon: 'notificaciones' },
  { to: '/reportes', label: 'Reportes', permiso: 'REPORTES_VER', icon: 'reportes' },
  { to: '/usuarios', label: 'Usuarios', permiso: 'USUARIOS_VER', icon: 'usuarios' },
  { to: '/roles', label: 'Roles y permisos', permiso: 'ROLES_VER', icon: 'roles' },
];

function MenuIcon({ name }: { name: IconName }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    productos: <><path d="M5 7.5 12 4l7 3.5-7 3.5-7-3.5Z"/><path d="M5 7.5V16l7 4 7-4V7.5"/><path d="M12 11v9"/></>,
    inventario: <><path d="M4 7h16v13H4z"/><path d="M7 4h10l2 3H5l2-3Z"/><path d="M9 11h6"/></>,
    carga: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
    clientes: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><path d="M16 11a3 3 0 1 0 0-6"/><path d="M16 14c2.5.2 4 2.2 4.5 5"/></>,
    proveedores: <><path d="M3 10h13v9H3z"/><path d="M16 13h3l2 3v3h-5z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 6h7"/></>,
    facturas: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    certificacion: <><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
    notificaciones: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    reportes: <><path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/></>,
    usuarios: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6"/><path d="M17 8h4M19 6v4"/></>,
    roles: <><circle cx="8" cy="8" r="3"/><path d="M3 20c0-4 1.8-6 5-6 1.7 0 3 .6 4 1.6"/><path d="M16 14l1.5 1.5L21 12"/><path d="M14 20h7"/></>,
  };
  return <svg {...common} className="shrink-0 text-current">{paths[name]}</svg>;
}

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.usuario);
  const salirDeEmpresa = useAuthStore((state) => state.salirDeEmpresa);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saliendoEmpresa, setSaliendoEmpresa] = useState(false);

  const nombreEmpresa = useMemo(() => {
    if (usuario?.empresa?.nombreEmpresa) return usuario.empresa.nombreEmpresa;
    if (usuario?.actingEmpresaId) return `Empresa #${usuario.actingEmpresaId}`;
    if (usuario?.empresaId) return `Empresa #${usuario.empresaId}`;
    return 'Espacio de trabajo';
  }, [usuario]);

  const menuVisible = useMemo(
    () => menuItems.filter((item) => tienePermiso(usuario, item.permiso)),
    [usuario],
  );

  const volverAdministracionGlobal = async () => {
    try {
      setSaliendoEmpresa(true);
      const { data } = await api.post('/admin/salir-empresa');
      salirDeEmpresa(data);
      navigate('/admin');
      await feedback.exito('Modo empresa finalizado', 'Volviste a la administración global de Sertiva.');
    } finally {
      setSaliendoEmpresa(false);
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
      isActive
        ? 'bg-[#e9eeff] text-[#284bc2]'
        : 'text-slate-600 hover:bg-[#f0f4ff] hover:text-[#284bc2]'
    }`;

  return (
    <div className="min-h-screen bg-paper text-[#202a47]">
      <div className="flex min-h-screen">
        <aside
          className={`fixed top-0 left-0 z-40 h-screen w-[280px] border-r border-[#e1e7f5] bg-white text-ink p-5 flex flex-col overflow-y-auto transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <Marca />
            <button type="button" className="lg:hidden text-slate-600" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>

          {usuario?.rol === 'SUPER_ADMIN' && usuario?.modoEmpresa && (
            <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-700">Modo empresa</p>
              <p className="mt-1 text-sm font-semibold text-ink">{nombreEmpresa}</p>
              
              <button
                type="button"
                disabled={saliendoEmpresa}
                onClick={volverAdministracionGlobal}
                className="mt-3 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
              >
                {saliendoEmpresa ? 'Saliendo...' : 'Volver a administración global'}
              </button>
            </div>
          )}

          <nav className="flex flex-col gap-1.5">
            {menuVisible.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass} onClick={() => setSidebarOpen(false)}>
                <MenuIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

        </aside>

        {sidebarOpen && (
          <button type="button" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" />
        )}

        <main className="min-h-screen min-w-0 flex-1 lg:ml-[280px]">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
            <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" className="lg:hidden rounded-xl border border-slate-200 bg-white px-3 py-2" onClick={() => setSidebarOpen(true)}>☰</button>
                <div className="min-w-0">
                  
                  <h1 className="truncate text-base sm:text-lg font-semibold text-[#202a47]">{nombreEmpresa}</h1>
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
