import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';
import { tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

interface RolEmpresa { id: number; nombre: string; activo: boolean }
interface UsuarioEmpresa {
  id: number;
  nombreCompleto: string;
  correo: string;
  rol: 'ADMINISTRADOR' | 'OPERADOR';
  estado: 'ACTIVO' | 'INACTIVO';
  rolEmpresaId?: number | null;
  rolEmpresa?: RolEmpresa | null;
}

type FormUsuario = {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  rol: 'ADMINISTRADOR' | 'OPERADOR';
  rolEmpresaId: string;
};

const inicial: FormUsuario = { nombreCompleto: '', correo: '', contrasena: '', rol: 'OPERADOR', rolEmpresaId: '' };

export default function Usuarios() {
  const queryClient = useQueryClient();
  const usuarioSesion = useAuthStore((state) => state.usuario);
  const puedeCrear = tienePermiso(usuarioSesion, 'USUARIOS_CREAR');
  const puedeEditar = tienePermiso(usuarioSesion, 'USUARIOS_EDITAR');
  const puedeDesactivar = tienePermiso(usuarioSesion, 'USUARIOS_DESACTIVAR');
  const puedeEliminar = tienePermiso(usuarioSesion, 'USUARIOS_ELIMINAR');
  const puedePassword = tienePermiso(usuarioSesion, 'USUARIOS_PASSWORD');
  const puedeVerRoles = tienePermiso(usuarioSesion, 'ROLES_VER');
  const [buscar, setBuscar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState<UsuarioEmpresa | null>(null);
  const [form, setForm] = useState<FormUsuario>(inicial);

  const { data: usuarios = [], isLoading } = useQuery<UsuarioEmpresa[]>({ queryKey: ['usuarios-empresa'], queryFn: async () => (await api.get('/usuarios')).data });
  const { data: roles = [] } = useQuery<RolEmpresa[]>({ queryKey: ['roles-empresa'], queryFn: async () => (await api.get('/roles')).data, enabled: puedeVerRoles });

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return usuarios.filter((u) => `${u.nombreCompleto} ${u.correo} ${u.rol} ${u.rolEmpresa?.nombre ?? ''}`.toLowerCase().includes(q));
  }, [usuarios, buscar]);

  const cerrar = () => { setMostrar(false); setEditando(null); setForm(inicial); };

  const guardar = useMutation({
    mutationFn: async () => {
      if (editando) {
        return api.patch(`/usuarios/${editando.id}`, {
          nombreCompleto: form.nombreCompleto,
          correo: form.correo,
          rol: form.rol,
          rolEmpresaId: form.rol === 'OPERADOR' ? Number(form.rolEmpresaId) : null,
        });
      }
      return api.post('/usuarios', {
        nombreCompleto: form.nombreCompleto,
        correo: form.correo,
        contrasena: form.contrasena,
        rol: form.rol,
        rolEmpresaId: form.rol === 'OPERADOR' ? Number(form.rolEmpresaId) : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios-empresa'] });
      cerrar();
      await feedback.exito(editando ? 'Usuario actualizado' : 'Usuario creado', 'La configuración del usuario quedó guardada.');
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: async (u: UsuarioEmpresa) => api.patch(`/usuarios/${u.id}/${u.estado === 'ACTIVO' ? 'desactivar' : 'activar'}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['usuarios-empresa'] }),
  });

  const cambiarContrasena = async (u: UsuarioEmpresa) => {
    const nueva = window.prompt(`Nueva contraseña para ${u.nombreCompleto} (mínimo 8 caracteres):`);
    if (!nueva) return;
    if (nueva.length < 8) { await feedback.error('Contraseña inválida', 'Debe tener mínimo 8 caracteres.'); return; }
    await api.patch(`/usuarios/${u.id}/contrasena`, { contrasena: nueva });
    await feedback.exito('Contraseña actualizada', 'La nueva contraseña quedó guardada.');
  };

  const eliminarUsuario = async (u: UsuarioEmpresa) => {
    const r = await feedback.confirmar('¿Eliminar usuario?', `${u.nombreCompleto} se eliminará permanentemente.`, 'Eliminar');
    if (!r.isConfirmed) return;
    await api.delete(`/usuarios/${u.id}`);
    await queryClient.invalidateQueries({ queryKey: ['usuarios-empresa'] });
    await feedback.exito('Usuario eliminado', 'El usuario fue eliminado correctamente.');
  };

  const abrirEditar = (u: UsuarioEmpresa) => {
    setEditando(u);
    setForm({ nombreCompleto: u.nombreCompleto, correo: u.correo, contrasena: '', rol: u.rol, rolEmpresaId: u.rolEmpresaId ? String(u.rolEmpresaId) : '' });
    setMostrar(true);
  };

  const activos = usuarios.filter((u) => u.estado === 'ACTIVO').length;
  const admins = usuarios.filter((u) => u.rol === 'ADMINISTRADOR').length;
  const operadores = usuarios.filter((u) => u.rol === 'OPERADOR').length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h1 className="text-3xl font-semibold text-[#253043]">Usuarios</h1></div>
        {puedeCrear && <button onClick={() => { setEditando(null); setForm(inicial); setMostrar(true); }} className="rounded-xl bg-[#1f4f82] px-5 py-3 text-sm font-semibold text-white">+ Nuevo usuario</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Usuarios', usuarios.length], ['Activos', activos], ['Administradores', admins], ['Operadores', operadores]].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-[#253043]">{value}</p></div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-[#253043]">Usuarios de la empresa</h2><p className="text-xs text-slate-500">{filtrados.length} resultado(s)</p></div><input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar nombre, correo o rol..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm md:w-80" /></div>
        {isLoading ? <p className="p-8 text-center text-sm text-slate-500">Cargando usuarios...</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Rol empresarial</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody>{filtrados.map((u) => (
            <tr key={u.id} className="border-t"><td className="px-4 py-3"><p className="font-semibold text-[#253043]">{u.nombreCompleto}</p><p className="text-xs text-slate-500">{u.correo}</p></td><td className="px-4 py-3">{u.rol}</td><td className="px-4 py-3">{u.rol === 'ADMINISTRADOR' ? 'Acceso total' : u.rolEmpresa?.nombre ?? 'Sin rol'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{u.estado}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2">{puedeEditar && <button onClick={() => abrirEditar(u)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#1f4f82]">Editar</button>}{(u.estado === 'INACTIVO' ? puedeEditar : puedeDesactivar) && <button onClick={() => cambiarEstado.mutate(u)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">{u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>}{puedePassword && <button onClick={() => cambiarContrasena(u)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Contraseña</button>}{puedeEliminar && <button onClick={() => eliminarUsuario(u)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">Eliminar</button>}</div></td></tr>
          ))}</tbody></table></div>
        )}
      </section>

      {mostrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-6 py-4"><div><h2 className="text-xl font-semibold text-[#253043]">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2></div><button onClick={cerrar} className="h-9 w-9 rounded-lg text-xl text-slate-400">×</button></div>
          <form onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }} className="grid gap-4 p-6">
            <label className="text-sm font-medium">Nombre completo<input required value={form.nombreCompleto} onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            <label className="text-sm font-medium">Correo<input required type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
            {!editando && <label className="text-sm font-medium">Contraseña inicial<input required minLength={8} type="password" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>}
            <label className="text-sm font-medium">Tipo de usuario<select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as 'ADMINISTRADOR' | 'OPERADOR', rolEmpresaId: e.target.value === 'ADMINISTRADOR' ? '' : form.rolEmpresaId })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3"><option value="OPERADOR">OPERADOR</option><option value="ADMINISTRADOR">ADMINISTRADOR</option></select></label>
            {form.rol === 'OPERADOR' && <label className="text-sm font-medium">Rol empresarial<select required value={form.rolEmpresaId} onChange={(e) => setForm({ ...form, rolEmpresaId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3"><option value="">Selecciona un rol</option>{roles.filter((r) => r.activo).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>{roles.filter((r) => r.activo).length === 0 && <p className="mt-1 text-xs text-amber-700">Primero debes crear un rol activo en Roles y permisos.</p>}</label>}
            <div className="mt-2 flex justify-end gap-3 border-t pt-5"><button type="button" onClick={cerrar} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={guardar.isPending || (form.rol === 'OPERADOR' && !form.rolEmpresaId)} className="rounded-xl bg-[#1f4f82] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{guardar.isPending ? 'Guardando...' : 'Guardar usuario'}</button></div>
          </form>
        </div></div>
      )}
    </div>
  );
}
