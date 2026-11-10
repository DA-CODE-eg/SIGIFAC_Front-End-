import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';
import { tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

interface RolPermiso { id: number; permiso: string }
interface RolEmpresa {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  permisos: RolPermiso[];
  _count?: { usuarios: number };
}

type FormRol = {
  nombre: string;
  descripcion: string;
  permisos: string[];
};

const formInicial: FormRol = { nombre: '', descripcion: '', permisos: [] };

const nombresGrupo: Record<string, string> = {
  DASHBOARD: 'Dashboard',
  INVENTARIOS: 'Inventarios',
  PRODUCTOS: 'Productos',
  CLIENTES: 'Clientes',
  PROVEEDORES: 'Proveedores',
  FACTURAS: 'Facturación',
  PAGOS: 'Pagos y cartera',
  CERTIFICACION: 'Certificación',
  NOTIFICACIONES: 'Notificaciones',
  REPORTES: 'Reportes',
  CARGA: 'Carga masiva',
  USUARIOS: 'Usuarios',
  ROLES: 'Roles y permisos',
  AUDITORIA: 'Auditoría',
  CONFIGURACION: 'Configuración',
};

function grupoPermiso(permiso: string) {
  if (permiso === 'CARGA_MASIVA') return 'CARGA';
  return permiso.split('_')[0] || 'OTROS';
}

function etiquetaPermiso(permiso: string) {
  const partes = permiso.split('_');
  return partes.slice(1).join(' ').toLowerCase().replace(/^./, (x) => x.toUpperCase()) || permiso;
}

export default function RolesPermisos() {
  const queryClient = useQueryClient();
  const usuarioSesion = useAuthStore((state) => state.usuario);
  const puedeCrear = tienePermiso(usuarioSesion, 'ROLES_CREAR');
  const puedeEditar = tienePermiso(usuarioSesion, 'ROLES_EDITAR');
  const puedeDesactivar = tienePermiso(usuarioSesion, 'ROLES_DESACTIVAR');
  const puedeEliminar = tienePermiso(usuarioSesion, 'ROLES_ELIMINAR');
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<RolEmpresa | null>(null);
  const [form, setForm] = useState<FormRol>(formInicial);

  const { data: roles = [], isLoading } = useQuery<RolEmpresa[]>({
    queryKey: ['roles-empresa'],
    queryFn: async () => (await api.get('/roles')).data,
  });

  const { data: catalogo = [] } = useQuery<string[]>({
    queryKey: ['roles-permisos-catalogo'],
    queryFn: async () => (await api.get('/roles/permisos')).data,
  });

  const grupos = useMemo(() => {
    const mapa = new Map<string, string[]>();
    catalogo.forEach((permiso) => {
      const grupo = grupoPermiso(permiso);
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), permiso]);
    });
    return Array.from(mapa.entries());
  }, [catalogo]);

  const cerrar = () => {
    setMostrar(false);
    setEditando(null);
    setForm(formInicial);
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        permisos: form.permisos,
      };
      if (editando) return api.patch(`/roles/${editando.id}`, payload);
      return api.post('/roles', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles-empresa'] });
      cerrar();
      await feedback.exito(editando ? 'Rol actualizado' : 'Rol creado', 'Los permisos quedaron guardados correctamente.');
    },
  });

  const cambiarActivo = useMutation({
    mutationFn: async (rol: RolEmpresa) =>
      rol.activo ? api.patch(`/roles/${rol.id}/desactivar`) : api.patch(`/roles/${rol.id}`, { activo: true }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['roles-empresa'] }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: number) => api.delete(`/roles/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles-empresa'] });
      await feedback.exito('Rol eliminado', 'El rol fue eliminado de la empresa.');
    },
  });

  const confirmarEliminar = async (rol: RolEmpresa) => {
    const r = await feedback.confirmar(
      '¿Eliminar rol?',
      `${rol.nombre} se eliminará permanentemente. Solo es posible si no tiene usuarios asignados.`,
      'Eliminar',
    );
    if (r.isConfirmed) eliminar.mutate(rol.id);
  };

  const abrirEditar = (rol: RolEmpresa) => {
    setEditando(rol);
    setForm({
      nombre: rol.nombre,
      descripcion: rol.descripcion ?? '',
      permisos: rol.permisos.map((p) => p.permiso),
    });
    setMostrar(true);
  };

  const togglePermiso = (permiso: string) => {
    setForm((actual) => ({
      ...actual,
      permisos: actual.permisos.includes(permiso)
        ? actual.permisos.filter((p) => p !== permiso)
        : [...actual.permisos, permiso],
    }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          
          <h1 className="text-3xl font-semibold text-[#253043]">Roles y permisos</h1>
          
        </div>
        {puedeCrear && <button type="button" onClick={() => { setEditando(null); setForm(formInicial); setMostrar(true); }} className="rounded-xl bg-[#1f4f82] px-5 py-3 text-sm font-semibold text-white">
          + Crear rol
        </button>}
      </div>

      {isLoading ? (
        <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Cargando roles...</p>
      ) : roles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Todavía no hay roles personalizados.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((rol) => (
            <article key={rol.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#253043]">{rol.nombre}</h2>
                  <p className="mt-1 text-sm text-slate-500">{rol.descripcion || 'Sin descripción'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rol.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rol.activo ? 'ACTIVO' : 'INACTIVO'}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Usuarios</p><p className="mt-1 text-xl font-semibold">{rol._count?.usuarios ?? 0}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Permisos</p><p className="mt-1 text-xl font-semibold">{rol.permisos.length}</p></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {puedeEditar && <button type="button" onClick={() => abrirEditar(rol)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#1f4f82]">Editar</button>}
                {(rol.activo ? puedeDesactivar : puedeEditar) && <button type="button" onClick={() => cambiarActivo.mutate(rol)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">{rol.activo ? 'Desactivar' : 'Activar'}</button>}
                {puedeEliminar && <button type="button" onClick={() => confirmarEliminar(rol)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Eliminar</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {mostrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div><h2 className="text-xl font-semibold text-[#253043]">{editando ? 'Editar rol' : 'Crear rol'}</h2></div>
              <button type="button" onClick={cerrar} className="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }} className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">Nombre del rol<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Ej. Auxiliar de cartera" /></label>
                <label className="text-sm font-medium">Descripción<input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Funciones principales del rol" /></label>
              </div>

              <div className="mt-6 flex items-center justify-between"><div><h3 className="font-semibold text-[#253043]">Permisos</h3><p className="text-xs text-slate-500">{form.permisos.length} permiso(s) seleccionado(s)</p></div><button type="button" onClick={() => setForm({ ...form, permisos: form.permisos.length === catalogo.length ? [] : [...catalogo] })} className="text-xs font-semibold text-[#1f4f82]">{form.permisos.length === catalogo.length ? 'Quitar todos' : 'Seleccionar todos'}</button></div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {grupos.map(([grupo, permisos]) => (
                  <section key={grupo} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-[#253043]">{nombresGrupo[grupo] ?? grupo}</h4><span className="text-xs text-slate-400">{permisos.filter((p) => form.permisos.includes(p)).length}/{permisos.length}</span></div>
                    <div className="space-y-2">
                      {permisos.map((permiso) => (
                        <label key={permiso} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-slate-50">
                          <input type="checkbox" checked={form.permisos.includes(permiso)} onChange={() => togglePermiso(permiso)} className="mt-0.5 h-4 w-4" />
                          <div><p className="text-sm font-medium text-slate-700">{etiquetaPermiso(permiso)}</p><p className="text-[10px] text-slate-400">{permiso}</p></div>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-5"><button type="button" onClick={cerrar} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={guardar.isPending} className="rounded-xl bg-[#1f4f82] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{guardar.isPending ? 'Guardando...' : 'Guardar rol'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
