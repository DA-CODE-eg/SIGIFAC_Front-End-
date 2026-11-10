import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { empresaEfectivaId, tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

interface DashboardData {
  empresa?: { nombreEmpresa: string };
  indicadores?: {
    productos?: number;
    bajoStock?: number;
    agotados?: number;
    vencidos?: number;
    proximosAVencer?: number;
    facturasPendientes?: number;
    totalFacturado?: number;
    carteraPendiente?: number;
  };
  productosRecientes?: { id?: number; nombre: string; inventario?: string; categoria?: string; stock?: number }[];
  facturasRecientes?: { id: number; numeroFactura?: string; clienteNombre?: string; estado?: string; valorTotal?: number }[];
}

const acciones = [
  { to: '/inventario', label: 'Inventario', permiso: 'INVENTARIOS_VER' },
  { to: '/inventario/sedes', label: 'Sedes y bodegas', permiso: 'INVENTARIOS_VER' },
  { to: '/carga-masiva', label: 'Carga masiva', permiso: 'CARGA_MASIVA' },
  { to: '/facturas', label: 'Facturación', permiso: 'FACTURAS_VER' },
  { to: '/certificacion', label: 'Certificación', permiso: 'CERTIFICACION_VER' },
  { to: '/reportes', label: 'Reportes', permiso: 'REPORTES_VER' },
];

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const numero = new Intl.NumberFormat('es-CO');

export default function Dashboard() {
  const usuario = useAuthStore((estado) => estado.usuario);
  const empresaId = empresaEfectivaId(usuario);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['dashboard-resumen-fase3', empresaId],
    queryFn: async () => (await api.get<DashboardData>('/dashboard/resumen')).data,
    retry: 1,
  });
  const accesos = acciones.filter((accion) => tienePermiso(usuario, accion.permiso));
  const inventarioVisible = tienePermiso(usuario, 'INVENTARIOS_VER');
  const productosVisibles = tienePermiso(usuario, 'PRODUCTOS_VER');
  const facturasVisibles = tienePermiso(usuario, 'FACTURAS_VER');
  const i = data?.indicadores;
  const indicadores = [
    ...(inventarioVisible ? [
      { label: 'Productos', valor: numero.format(i?.productos ?? 0) },
      { label: 'Productos agotados', valor: numero.format(i?.agotados ?? 0), detalle: `${numero.format(i?.bajoStock ?? 0)} con bajo stock` },
      { label: 'Productos vencidos', valor: numero.format(i?.vencidos ?? 0), detalle: `${numero.format(i?.proximosAVencer ?? 0)} próximos a vencer` },
    ] : []),
    ...(facturasVisibles ? [
      { label: 'Cartera pendiente', valor: pesos.format(Number(i?.carteraPendiente ?? 0)), detalle: `${numero.format(i?.facturasPendientes ?? 0)} facturas pendientes` },
    ] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight text-ink">Panel de operaciones</h2>
        <p className="mt-1 text-sm text-slate-600">{data?.empresa?.nombreEmpresa ?? usuario?.empresa?.nombreEmpresa ?? 'Resumen de la empresa'}</p>
        {usuario?.sede && !usuario.modoEmpresa && <p className="mt-1 text-xs text-slate-500">Sede asignada · {usuario.sede.nombre}</p>}
      </header>

      {!!accesos.length && (
        <nav aria-label="Acciones rápidas" className="flex flex-wrap gap-2">
          {accesos.map((accion) => (
            <Link key={accion.to} to={accion.to} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-900 hover:border-indigo-300 hover:bg-indigo-50">
              {accion.label}
            </Link>
          ))}
        </nav>
      )}

      {isPending && <p role="status" className="text-sm text-slate-600">Cargando resumen…</p>}
      {isError && <div className="rounded-xl border border-red-200 bg-white p-4 text-sm">
        <p role="alert">No se pudo cargar el resumen de la empresa.</p>
        <button type="button" onClick={() => void refetch()} className="mt-2 font-semibold text-indigo-800 underline">Reintentar</button>
      </div>}

      {data && <>
        {!!indicadores.length && <section aria-labelledby="resumen-titulo">
          <h3 id="resumen-titulo" className="mb-2 text-base font-semibold text-ink">Resumen de la empresa</h3>
          <dl className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white md:flex md:divide-y-0">
            {indicadores.map(({ label, valor, detalle }) => <div key={label} className="p-4 md:flex-1">
              <dt className="text-sm font-medium text-slate-600">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{valor}</dd>
              {detalle && <dd className="mt-1 text-xs text-slate-500">{detalle}</dd>}
            </div>)}
          </dl>
        </section>}

        {i && (inventarioVisible || facturasVisibles) && <section aria-labelledby="grafico-general" className="rounded-xl border border-slate-200 bg-white p-5">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="grafico-general" className="text-base font-semibold text-ink">Panorama de la operación</h3>
              <p className="mt-1 text-sm text-slate-600">Datos registrados en toda la empresa</p>
            </div>
            {tienePermiso(usuario, 'REPORTES_VER') && <Link to="/reportes" className="text-sm font-semibold text-indigo-800 hover:underline">Ver reportes</Link>}
          </header>
          <div className="grid gap-6 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {inventarioVisible && <GraficoBarras
              titulo="Disponibilidad de productos"
              formato={numero}
              vacio="Todavía no hay productos para graficar."
              filas={typeof i.productos === 'number' && typeof i.agotados === 'number' && typeof i.bajoStock === 'number' ? [
                { label: 'Con stock suficiente', valor: i.productos - i.agotados - i.bajoStock, color: 'bg-indigo-600' },
                { label: 'Bajo stock', valor: i.bajoStock, color: 'bg-amber-500' },
                { label: 'Agotados', valor: i.agotados, color: 'bg-rose-600' },
              ] : []}
            />}
            {facturasVisibles && <GraficoBarras
              titulo="Facturación y cartera"
              formato={pesos}
              vacio="Aún no hay montos registrados."
              filas={i.totalFacturado != null && i.carteraPendiente != null ? [
                { label: 'Total facturado', valor: Number(i.totalFacturado), color: 'bg-indigo-600' },
                { label: 'Cartera pendiente', valor: Number(i.carteraPendiente), color: 'bg-violet-500' },
              ] : []}
            />}
          </div>
        </section>}

        {(productosVisibles || facturasVisibles) && <section aria-labelledby="actividad-titulo">
          <h3 id="actividad-titulo" className="mb-2 text-base font-semibold text-ink">Actividad reciente</h3>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {productosVisibles && <Actividad titulo="Productos" enlace="/productos" vacio="Todavía no hay productos." filas={
              (data.productosRecientes ?? []).slice(0, 5).map((p, indice) => ({
                id: p.id ?? indice, titulo: p.nombre,
                detalle: [p.inventario, p.categoria].filter(Boolean).join(' · '),
                valor: numero.format(p.stock ?? 0) + ' und.',
              }))
            } />}
            {facturasVisibles && <Actividad titulo="Facturas" enlace="/facturas" vacio="Todavía no hay facturas." filas={
              (data.facturasRecientes ?? []).slice(0, 5).map((f) => ({
                id: f.id, titulo: f.numeroFactura ?? `Factura #${f.id}`,
                detalle: [f.clienteNombre, f.estado?.toLowerCase().replaceAll('_', ' ')].filter(Boolean).join(' · '),
                valor: pesos.format(Number(f.valorTotal ?? 0)),
              }))
            } />}
          </div>
        </section>}
      </>}
    </div>
  );
}

function GraficoBarras({ titulo, filas, formato, vacio }: {
  titulo: string;
  filas: { label: string; valor: number; color: string }[];
  formato: Intl.NumberFormat;
  vacio: string;
}) {
  const validas = filas.length > 0 && filas.every(({ valor }) => Number.isFinite(valor) && valor >= 0);
  const maximo = validas ? Math.max(...filas.map(({ valor }) => valor)) : 0;

  return <figure className="min-w-0">
    <figcaption className="mb-3 text-sm font-semibold text-ink">{titulo}</figcaption>
    {maximo > 0 ? <dl className="space-y-3">
      {filas.map(({ label, valor, color }) => <div key={label}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-slate-600">{label}</dt>
          <dd className="shrink-0 font-semibold tabular-nums text-ink">{formato.format(valor)}</dd>
        </div>
        <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${(valor / maximo) * 100}%` }} />
        </div>
      </div>)}
    </dl> : <p className="text-sm text-slate-600">{validas ? vacio : 'No hay datos disponibles para el gráfico.'}</p>}
  </figure>;
}

function Actividad({ titulo, enlace, vacio, filas }: {
  titulo: string; enlace: string; vacio: string;
  filas: { id: number; titulo: string; detalle: string; valor: string }[];
}) {
  return <section className="rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
      <Link to={enlace} className="text-xs font-semibold text-indigo-800 hover:underline">Ver todo</Link>
    </div>
    {!filas.length && <p className="px-4 py-5 text-sm text-slate-600">{vacio}</p>}
    <ul className="divide-y divide-slate-100">
      {filas.map((fila) => <li key={fila.id} className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{fila.titulo}</p>
          {fila.detalle && <p className="truncate text-xs text-slate-500">{fila.detalle}</p>}
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{fila.valor}</span>
      </li>)}
    </ul>
  </section>;
}
