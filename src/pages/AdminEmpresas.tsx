import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';
import { useAuthStore } from '../store/auth.store';

interface Empresa {
  id: number;
  nombreEmpresa: string;
  identificacion: string;
  tipoEmpresa: string;
  correoContacto: string;
  estado: string;
  fechaRegistro?: string;
  _count?: {
    usuarios?: number;
    modulos?: number;
  };
}

export default function AdminEmpresas() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const entrarComoEmpresa = useAuthStore((state) => state.entrarComoEmpresa);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [correoAdmin, setCorreoAdmin] = useState('');
  const [contrasena, setContrasena] = useState('');

  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ['admin-empresas'],
    queryFn: async () => (await api.get('/admin/empresas')).data,
  });

  const crearEmpresa = useMutation({
    mutationFn: async () =>
      api.post('/admin/empresas', {
        nombreEmpresa,
        identificacion,
        tipoEmpresa: 'PEQUENA',
        correoContacto,
        administrador: nombreAdmin && correoAdmin && contrasena
          ? {
              nombreCompleto: nombreAdmin,
              correo: correoAdmin,
              contrasena,
            }
          : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-empresas'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setNombreEmpresa('');
      setIdentificacion('');
      setCorreoContacto('');
      setNombreAdmin('');
      setCorreoAdmin('');
      setContrasena('');
      setMostrarFormulario(false);
    },
  });


  const actuarComoEmpresa = useMutation({
    mutationFn: async (empresa: Empresa) => (await api.post(`/admin/empresas/${empresa.id}/actuar`)).data,
    onSuccess: async (data) => {
      entrarComoEmpresa(data);
      navigate('/dashboard');
      await feedback.exito('Modo empresa activado', `Ahora estás operando ${data.empresa?.nombreEmpresa ?? 'la empresa seleccionada'} como SUPER_ADMIN.`);
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: async (empresa: Empresa) =>
      api.patch(`/admin/empresas/${empresa.id}/${empresa.estado === 'ACTIVA' ? 'desactivar' : 'activar'}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-empresas'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const eliminarEmpresa = async (empresa: Empresa) => {
    const confirmacion = window.prompt(`Para eliminar permanentemente escribe exactamente:\nELIMINAR ${empresa.nombreEmpresa}`);
    if (!confirmacion) return;
    await api.delete(`/admin/empresas/${empresa.id}`, { data: { confirmacion } });
    await queryClient.invalidateQueries({ queryKey: ['admin-empresas'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    await feedback.exito('Empresa eliminada', `${empresa.nombreEmpresa} fue eliminada permanentemente.`);
  };

  const filtro = busqueda.trim().toLowerCase();
  const empresasFiltradas = empresas.filter((empresa) =>
    [empresa.nombreEmpresa, empresa.identificacion, empresa.correoContacto]
      .filter(Boolean)
      .some((valor) => valor.toLowerCase().includes(filtro)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-[#edf3ff] to-[#f6f2ff] p-5 sm:p-7 xl:flex-row xl:items-center xl:justify-between">
        <div>
          
          <h2 className="mt-1 text-3xl font-semibold text-[#202a47]">Gestión de empresas</h2>
          
        </div>
        <button
          onClick={() => setMostrarFormulario((valor) => !valor)}
          className="rounded-xl bg-[#284bc2] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#203ba0]"
        >
          {mostrarFormulario ? 'Cancelar' : '+ Nueva empresa'}
        </button>
      </div>

      {mostrarFormulario && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crearEmpresa.mutate();
          }}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-xl font-semibold text-[#202a47]">Registrar empresa</h3>
              
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-slate-600">
              Nombre de empresa
              <input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#284bc2] focus:ring-2 focus:ring-[#284bc2]/10" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required />
            </label>
            <label className="text-sm text-slate-600">
              NIT / Identificación
              <input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#284bc2] focus:ring-2 focus:ring-[#284bc2]/10" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} required />
            </label>
            <label className="text-sm text-slate-600 md:col-span-2">
              Correo de contacto
              <input type="email" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#284bc2] focus:ring-2 focus:ring-[#284bc2]/10" value={correoContacto} onChange={(e) => setCorreoContacto(e.target.value)} required />
            </label>
          </div>

          <div className="my-6 border-t border-slate-200" />

          <div className="mb-4">
            <h4 className="font-semibold text-[#202a47]">Administrador inicial</h4>
            
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#284bc2]" placeholder="Nombre completo" value={nombreAdmin} onChange={(e) => setNombreAdmin(e.target.value)} />
            <input type="email" className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#284bc2]" placeholder="Correo administrador" value={correoAdmin} onChange={(e) => setCorreoAdmin(e.target.value)} />
            <input type="password" className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#284bc2]" placeholder="Contraseña inicial" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
          </div>

          {crearEmpresa.isError && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo crear la empresa. Revisa si el NIT o correo ya existen.</p>
          )}

          <div className="mt-5 flex justify-end">
            <button disabled={crearEmpresa.isPending} className="rounded-xl bg-[#284bc2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {crearEmpresa.isPending ? 'Creando...' : 'Crear empresa'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-semibold text-[#202a47]">Empresas registradas</h3>
            <p className="text-sm text-slate-500 mt-1">{empresas.length} empresas en la plataforma.</p>
          </div>
          <input
            className="w-full sm:w-80 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#284bc2] focus:bg-white"
            placeholder="Buscar empresa, NIT o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-500">Cargando empresas...</p>
        ) : empresasFiltradas.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No se encontraron empresas.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {empresasFiltradas.map((empresa) => (
              <article key={empresa.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#284bc2]/35 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-[#202a47] truncate">{empresa.nombreEmpresa}</p>
                    <p className="text-sm text-slate-500 mt-1">NIT {empresa.identificacion}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    empresa.estado === 'ACTIVA' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {empresa.estado}
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-600 break-all">{empresa.correoContacto}</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f1f4ff] p-3">
                    <p className="text-xs text-slate-500">Usuarios</p>
                    <p className="mt-1 text-xl font-semibold text-[#202a47]">{empresa._count?.usuarios ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-[#f1f4ff] p-3">
                    <p className="text-xs text-slate-500">Módulos</p>
                    <p className="mt-1 text-xl font-semibold text-[#202a47]">{empresa._count?.modulos ?? 0}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={actuarComoEmpresa.isPending || empresa.estado !== 'ACTIVA'}
                    onClick={() => actuarComoEmpresa.mutate(empresa)}
                    className="rounded-xl bg-[#284bc2] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Ingresar
                  </button>
                  <Link
                    to={`/admin/empresas/${empresa.id}`}
                    className="flex items-center justify-center rounded-xl border border-[#284bc2]/25 bg-[#f3f7fc] px-3 py-2.5 text-sm font-semibold text-[#284bc2]"
                  >
                    Administrar
                  </Link>
                  <button
                    type="button"
                    onClick={() => cambiarEstado.mutate(empresa)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    {empresa.estado === 'ACTIVA' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarEmpresa(empresa)}
                    className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
