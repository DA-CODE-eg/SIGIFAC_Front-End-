import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { api } from '../api/client';

interface NotificacionItem {
  id: number;
  productoId: number | null;
  tipo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: string;
}

export default function Navbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };

  // Conteo de no leídas — se refresca solo cada 60s, no necesita el panel abierto
  // NOTA: ajusta "noLeidas" si tu backend devuelve el conteo con otro nombre de campo
  const { data: resumen } = useQuery({
    queryKey: ['notificaciones-resumen'],
    queryFn: async () => (await api.get('/notificaciones/resumen')).data,
    refetchInterval: 60000,
  });
  const noLeidas: number = resumen?.noLeidas ?? 0;

  // Lista completa — solo se pide cuando el panel está abierto, para no gastar
  // peticiones de más
  const { data: notificaciones, isLoading: cargandoNotificaciones } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: async () => (await api.get<NotificacionItem[]>('/notificaciones')).data,
    enabled: panelAbierto,
  });

  const marcarLeida = useMutation({
    mutationFn: (id: number) => api.patch(`/notificaciones/${id}/leida`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-resumen'] });
    },
  });

  const handleClickNotificacion = (n: NotificacionItem) => {
    if (!n.leida) marcarLeida.mutate(n.id);
    setPanelAbierto(false);
    if (n.productoId) {
      // TODO: cuando exista la pantalla de editar producto, navegar directo a
      // `/productos/${n.productoId}/editar`. Por ahora manda al listado general.
      navigate('/productos');
    }
  };

  // Cierra el panel si se hace click fuera de él
  useEffect(() => {
    if (!panelAbierto) return;
    const handleClickFuera = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [panelAbierto]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-sm text-sm transition-colors ${
      isActive ? 'bg-emerald text-paper' : 'text-ink hover:bg-slate-100'
    }`;

  const linkClassMobile = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-3 rounded-sm text-base transition-colors ${
      isActive ? 'bg-emerald text-paper' : 'text-ink hover:bg-slate-100'
    }`;

  const formatearFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const Campanita = () => (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setPanelAbierto((v) => !v)}
        className="relative p-2 rounded-sm hover:bg-slate-100 transition-colors"
        aria-label="Notificaciones"
        aria-expanded={panelAbierto}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="w-5 h-5 text-ink"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.6-2.13a2 2 0 01-.4-1.2V10a6 6 0 10-12 0v3.67a2 2 0 01-.4 1.2L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
          />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-amber text-ink text-[10px] font-bold leading-none">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {panelAbierto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-paper border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-display text-ink text-sm">Notificaciones</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {cargandoNotificaciones && (
              <p className="px-4 py-6 text-sm text-slate text-center">Cargando...</p>
            )}
            {!cargandoNotificaciones && (!notificaciones || notificaciones.length === 0) && (
              <p className="px-4 py-6 text-sm text-slate text-center">No tienes notificaciones.</p>
            )}
            {notificaciones?.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotificacion(n)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors ${
                  !n.leida ? 'bg-emerald/5' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.leida && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald shrink-0" />}
                  <div className="flex-1">
                    <p className={`text-sm ${!n.leida ? 'text-ink font-medium' : 'text-slate'}`}>{n.mensaje}</p>
                    <p className="text-xs text-slate mt-0.5">{formatearFecha(n.fechaCreacion)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <nav className="border-b border-slate-200 relative">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-display text-lg text-ink">SIGIFAC</span>

          {/* Links — visibles desde tablet en adelante */}
          <div className="hidden md:flex gap-2">
            <NavLink to="/empresas" className={linkClass}>Empresas</NavLink>
            <NavLink to="/productos" className={linkClass}>Productos</NavLink>
            <NavLink to="/inventario" className={linkClass}>Inventario</NavLink>
            <NavLink to="/facturas" className={linkClass}>Facturas</NavLink>
            <NavLink to="/certificacion" className={linkClass}>Certificación</NavLink>
            <NavLink to="/notificaciones" className={linkClass}>Notificaciones</NavLink>
          </div>
        </div>

        {/* Campanita + Usuario + logout — visibles desde tablet en adelante */}
        <div className="hidden md:flex items-center gap-4">
          <Campanita />
          {usuario && <span className="text-sm text-slate">{usuario.nombreCompleto}</span>}
          <button
            onClick={cerrarSesion}
            className="text-sm text-slate hover:text-ink transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Campanita + botón hamburguesa — solo en móvil */}
        <div className="md:hidden flex items-center gap-1">
          <Campanita />
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            className="p-2 -mr-2"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
          >
            <div className="w-6 flex flex-col gap-1.5">
              <span className={`block h-0.5 bg-ink transition-transform ${menuAbierto ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`block h-0.5 bg-ink transition-opacity ${menuAbierto ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 bg-ink transition-transform ${menuAbierto ? '-translate-y-2 -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Menú desplegable — solo en móvil */}
      {menuAbierto && (
        <div className="md:hidden border-t border-slate-200 px-4 py-3 flex flex-col gap-1 bg-paper">
          <NavLink to="/empresas" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
            Empresas
          </NavLink>
          <NavLink to="/productos" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
            Productos
          </NavLink>
          <NavLink to="/inventario" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
            Inventario
          </NavLink>
          <NavLink to="/facturas" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
            Facturas
          </NavLink>
          <NavLink to="/certificacion" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
            Certificación
          </NavLink>
          <NavLink to="/notificaciones" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
            Notificaciones
          </NavLink>

          <div className="border-t border-slate-200 mt-2 pt-3 flex items-center justify-between">
            {usuario && <span className="text-sm text-slate">{usuario.nombreCompleto}</span>}
            <button
              onClick={cerrarSesion}
              className="text-sm text-slate hover:text-ink transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}