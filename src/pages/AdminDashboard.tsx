import ComercialSertiva from '../components/ComercialSertiva';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface AdminResumen {
  empresas: number;
  empresasActivas: number;
  usuarios: number;
  administradores: number;
}

interface Empresa {
  id: number;
  nombreEmpresa: string;
  identificacion: string;
  correoContacto: string;
  estado: string;
  fechaRegistro?: string;
  _count?: {
    usuarios?: number;
    modulos?: number;
  };
}

export default function AdminDashboard() {
  const { data: resumen, isLoading: cargandoResumen } = useQuery<AdminResumen>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data,
  });

  const { data: empresas = [], isLoading: cargandoEmpresas } = useQuery<Empresa[]>({
    queryKey: ['admin-empresas'],
    queryFn: async () => (await api.get('/admin/empresas')).data,
  });

  const cards = [
    { label: 'Empresas registradas', value: resumen?.empresas ?? 0, note: 'Tenants creados', accent: 'border-[#4a7be5]' },
    { label: 'Empresas activas', value: resumen?.empresasActivas ?? 0, note: 'Operando actualmente', accent: 'border-[#43a66e]' },
    { label: 'Usuarios', value: resumen?.usuarios ?? 0, note: 'Usuarios de empresas', accent: 'border-[#6548b6]' },
    { label: 'Administradores', value: resumen?.administradores ?? 0, note: 'Administradores empresa', accent: 'border-[#d9a441]' },
  ];

  const recientes = empresas.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#284bc2]">Control global</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#202a47]">Resumen de plataforma</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Aquí administras la estructura de Sertiva. No se muestran inventarios, productos ni facturación de las empresas.
          </p>
        </div>
        <Link
          to="/admin/empresas"
          className="inline-flex justify-center rounded-xl bg-[#284bc2] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#203ba0]"
        >
          Gestionar empresas
        </Link>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl border border-slate-200 border-l-4 ${card.accent} bg-white p-5 shadow-sm`}>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#202a47]">{cargandoResumen ? '—' : card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.note}</p>
          </div>
        ))}
      </section>

      <ComercialSertiva />

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_360px] gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xl font-semibold text-[#202a47]">Empresas recientes</h3>
              <p className="text-sm text-slate-500 mt-1">Vista administrativa, sin datos operacionales.</p>
            </div>
            <Link to="/admin/empresas" className="text-sm font-medium text-[#284bc2] hover:underline">Ver todas</Link>
          </div>

          {cargandoEmpresas ? (
            <p className="py-8 text-center text-sm text-slate-500">Cargando empresas...</p>
          ) : recientes.length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center">
              <p className="font-medium text-[#202a47]">No hay empresas registradas</p>
              <p className="text-sm text-slate-500 mt-1">Crea el primer empresa desde Gestión de empresas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-3 font-medium">Empresa</th>
                    <th className="pb-3 font-medium">NIT / ID</th>
                    <th className="pb-3 font-medium">Usuarios</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((empresa) => (
                    <tr key={empresa.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-4">
                        <p className="font-medium text-[#202a47]">{empresa.nombreEmpresa}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{empresa.correoContacto}</p>
                      </td>
                      <td className="py-4 text-slate-600">{empresa.identificacion}</td>
                      <td className="py-4 text-slate-600">{empresa._count?.usuarios ?? 0}</td>
                      <td className="py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          empresa.estado === 'ACTIVA'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {empresa.estado}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <Link to={`/admin/empresas/${empresa.id}`} className="text-sm font-medium text-[#284bc2] hover:underline">
                          Configurar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-[#202a47]">Alcance del SUPER_ADMIN</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {[
              'Crear y actualizar empresas.',
              'Consultar usuarios y roles por empresa.',
              'Controlar estado y configuración del empresa.',
              'Mantener separado el contenido operacional.',
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[#284bc2]/10 text-[#284bc2] flex items-center justify-center text-xs font-bold">✓</span>
                <p>{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Acceso a empresa</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              El modo soporte/impersonación se habilitará después con acceso temporal y auditado. No se activa silenciosamente.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
