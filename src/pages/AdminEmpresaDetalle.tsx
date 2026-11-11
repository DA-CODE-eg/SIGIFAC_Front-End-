import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';
import { useAuthStore } from '../store/auth.store';

interface Empresa {
  id: number;
  nombreEmpresa: string;
  identificacion: string;
  tipoEmpresa: string;
  accesoPorUsuario?: boolean;
  wompiSandbox?: boolean;
  correoContacto: string;
  estado: string;
  _count?: { usuarios?: number; modulos?: number; inventarios?: number };
}

interface UsuarioEmpresa {
  id: number;
  nombreCompleto: string;
  correo: string;
  sede?: { id: number; nombre: string } | null;
  rol: string;
  estado: string;
  rolEmpresa?: { id: number; nombre: string; activo: boolean } | null;
}

export default function AdminEmpresaDetalle() {
  const { id } = useParams();
  const empresaId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const entrarComoEmpresa = useAuthStore((state) => state.entrarComoEmpresa);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
  const [estado, setEstado] = useState('ACTIVA');
  const [wompiSandbox, setWompiSandbox] = useState(false);
  const [accesoPorUsuario, setAccesoPorUsuario] = useState(false);

  const { data: empresa, isLoading: cargandoEmpresa } = useQuery<Empresa>({
    queryKey: ['admin-empresa', empresaId],
    queryFn: async () => (await api.get(`/admin/empresas/${empresaId}`)).data,
    enabled: Number.isFinite(empresaId),
  });

  const { data: usuarios = [], isLoading: cargandoUsuarios } = useQuery<UsuarioEmpresa[]>({
    queryKey: ['admin-empresa-usuarios', empresaId],
    queryFn: async () => (await api.get(`/admin/empresas/${empresaId}/usuarios`)).data,
    enabled: Number.isFinite(empresaId),
  });

  useEffect(() => {
    if (!empresa) return;
    setNombreEmpresa(empresa.nombreEmpresa);
    setCorreoContacto(empresa.correoContacto);
    setEstado(empresa.estado);
    setAccesoPorUsuario(Boolean(empresa.accesoPorUsuario));
    setWompiSandbox(Boolean(empresa.wompiSandbox));
  }, [empresa]);

  const actualizarEmpresa = useMutation({
    mutationFn: async () => api.patch(`/admin/empresas/${empresaId}`, { nombreEmpresa, correoContacto, estado, accesoPorUsuario, wompiSandbox }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-empresa', empresaId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-empresas'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
      await feedback.exito('Empresa actualizada', 'Los cambios se guardaron correctamente.');
    },
  });

  const actuar = useMutation({
    mutationFn: async () => (await api.post(`/admin/empresas/${empresaId}/actuar`)).data,
    onSuccess: async (data) => {
      entrarComoEmpresa(data);
      navigate('/dashboard');
      await feedback.exito('Modo empresa activado', `Ahora estás operando ${data.empresa?.nombreEmpresa ?? 'esta empresa'} como SUPER_ADMIN.`);
    },
  });

  const cambiarContrasena = async (usuario: UsuarioEmpresa) => {
    const contrasena = window.prompt(`Nueva contraseña para ${usuario.nombreCompleto} (mínimo 8 caracteres):`);
    if (!contrasena) return;
    if (contrasena.length < 8) {
      await feedback.error('Contraseña inválida', 'Debe tener mínimo 8 caracteres.');
      return;
    }
    await api.patch(`/admin/empresas/${empresaId}/usuarios/${usuario.id}/contrasena`, { contrasena });
    await feedback.exito('Contraseña actualizada', 'El usuario ya puede ingresar con la nueva contraseña.');
  };

  const eliminarUsuario = async (usuario: UsuarioEmpresa) => {
    const r = await feedback.confirmar('¿Eliminar usuario?', `${usuario.nombreCompleto} será eliminado permanentemente de esta empresa.`, 'Eliminar');
    if (!r.isConfirmed) return;
    await api.delete(`/admin/empresas/${empresaId}/usuarios/${usuario.id}`);
    await queryClient.invalidateQueries({ queryKey: ['admin-empresa-usuarios', empresaId] });
    await queryClient.invalidateQueries({ queryKey: ['admin-empresa', empresaId] });
    await feedback.exito('Usuario eliminado', 'El usuario fue eliminado correctamente.');
  };

  const eliminarEmpresa = async () => {
    if (!empresa) return;
    const confirmacion = window.prompt(`Esta operación elimina permanentemente el empresa y sus datos.\nEscribe exactamente:\nELIMINAR ${empresa.nombreEmpresa}`);
    if (!confirmacion) return;
    await api.delete(`/admin/empresas/${empresa.id}`, { data: { confirmacion } });
    await feedback.exito('Empresa eliminada', `${empresa.nombreEmpresa} fue eliminada permanentemente.`);
    navigate('/admin/empresas');
  };

  const roles = useMemo(() => {
    const mapa = new Map<string, number>();
    usuarios.forEach((u) => {
      const nombre = u.rol === 'OPERADOR' ? u.rolEmpresa?.nombre ?? 'OPERADOR sin rol' : u.rol;
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1);
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [usuarios]);

  if (cargandoEmpresa) return <p className="text-sm text-slate-500">Cargando configuración de empresa...</p>;
  if (!empresa) return <p className="text-sm text-red-600">No se encontró la empresa.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/empresas" className="text-sm font-medium text-[#254a7e] hover:underline">← Volver a empresas</Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-[#254a7e]">Tenant #{empresa.id}</p>
            <h2 className="mt-1 text-3xl font-semibold text-[#10274d]">{empresa.nombreEmpresa}</h2>
            
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-2 text-sm font-semibold ${empresa.estado === 'ACTIVA' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{empresa.estado}</span>
            <button disabled={empresa.estado !== 'ACTIVA' || actuar.isPending} onClick={() => actuar.mutate()} className="rounded-xl bg-[#254a7e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{actuar.isPending ? 'Ingresando...' : 'Ingresar como empresa'}</button>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <form onSubmit={(e) => { e.preventDefault(); actualizarEmpresa.mutate(); }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-[#10274d]">Configuración general</h3>
          
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600 md:col-span-2">Nombre de empresa<input className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} /></label>
            <label className="text-sm text-slate-600">NIT / Identificación<input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500" value={empresa.identificacion} disabled /></label>
            <label className="text-sm text-slate-600">Estado<select className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="ACTIVA">ACTIVA</option><option value="INACTIVA">INACTIVA</option></select></label>
            <label className="text-sm text-slate-600 md:col-span-2">Correo de contacto<input type="email" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={correoContacto} onChange={(e) => setCorreoContacto(e.target.value)} /></label>
          </div>
          <label className="mt-5 flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-ink">
            <input className="mt-1" type="checkbox" checked={accesoPorUsuario} onChange={(e) => setAccesoPorUsuario(e.target.checked)} />
            <span>Permitir ingreso con nombre de usuario <small className="block text-slate-600">Puedes asignar los nombres desde Usuarios en el espacio de la empresa.</small></span>
          </label>
          <label className="mt-3 flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-ink">
            <input className="mt-1" type="checkbox" checked={wompiSandbox} onChange={(e) => setWompiSandbox(e.target.checked)} />
            <span>Activar Wompi Sandbox <small className="block text-slate-600">Los nuevos enlaces de esta empresa serán de prueba y no moverán dinero real.</small></span>
          </label>
          <div className="mt-5 flex justify-end"><button disabled={actualizarEmpresa.isPending} className="rounded-xl bg-[#254a7e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{actualizarEmpresa.isPending ? 'Guardando...' : 'Guardar cambios'}</button></div>
        </form>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-[#10274d]">Resumen</h3>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Usuarios</p><p className="mt-1 text-2xl font-semibold">{usuarios.length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Roles</p><p className="mt-1 text-2xl font-semibold">{roles.length}</p></div><div className="col-span-2 rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Inventarios</p><p className="mt-1 text-2xl font-semibold">{empresa._count?.inventarios ?? 0}</p></div></div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><h3 className="font-semibold text-red-800">Zona de peligro</h3><p className="mt-1 text-xs leading-5 text-red-700">La eliminación permanente borra los datos relacionados del empresa.</p><button onClick={eliminarEmpresa} className="mt-4 w-full rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700">Eliminar empresa permanentemente</button></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-semibold text-[#10274d]">Usuarios del empresa</h3></div><button disabled={empresa.estado !== 'ACTIVA'} onClick={() => actuar.mutate()} className="rounded-xl border border-[#254a7e]/25 bg-[#f3f7fc] px-4 py-2 text-sm font-semibold text-[#254a7e] disabled:opacity-50">Gestionar usuarios dentro del empresa</button></div>
        {cargandoUsuarios ? <p className="py-8 text-center text-sm text-slate-500">Cargando usuarios...</p> : usuarios.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Esta empresa todavía no tiene usuarios.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="pb-3 font-medium">Usuario</th><th className="pb-3 font-medium">Tipo</th><th className="pb-3 font-medium">Rol empresa</th><th className="pb-3 font-medium">Estado</th><th className="pb-3 text-right font-medium">Acciones</th></tr></thead><tbody>{usuarios.map((u) => <tr key={u.id} className="border-b border-slate-100"><td className="py-4"><p className="font-medium text-[#10274d]">{u.nombreCompleto}</p><p className="text-xs text-slate-500">{u.correo}</p><p className="text-xs text-slate-500">{u.sede?.nombre ?? 'Sin sede asignada'}</p></td><td className="py-4">{u.rol}</td><td className="py-4">{u.rolEmpresa?.nombre ?? (u.rol === 'ADMINISTRADOR' ? 'Acceso total' : '—')}</td><td className="py-4">{u.estado}</td><td className="py-4"><div className="flex justify-end gap-2"><button onClick={() => cambiarContrasena(u)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Cambiar clave</button><button onClick={() => eliminarUsuario(u)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">Eliminar</button></div></td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
