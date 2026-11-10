import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';

interface DashboardData {
  empresa?: {
    id: number;
    nombreEmpresa: string;
    estado: string;
    diasAvisoVencimiento: number;
  };
  indicadores?: {
    inventarios?: number;
    productos?: number;
    unidades?: number;
    bajoStock?: number;
    agotados?: number;
    vencidos?: number;
    proximosAVencer?: number;
    clientes?: number;
    proveedores?: number;
    facturas?: number;
    facturasPendientes?: number;
    totalFacturado?: number;
    carteraPendiente?: number;
    notificacionesNoLeidas?: number;
    certificaciones?: number;
  };
  productosRecientes?: any[];
  facturasRecientes?: any[];
  movimientosRecientes?: any[];
}

const COLORES = {
  verde: '#16a36a',
  amarillo: '#d2a200',
  rojo: '#d8545f',
  azul: '#284bc2',
  gris: '#dbe4ee',
  morado: '#6548b6',
};

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard-resumen-fase3'],
    queryFn: async () =>
      (await api.get('/dashboard/resumen')).data,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="font-semibold text-[#202a47]">
          No se pudo cargar la información
        </h2>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-xl bg-[#284bc2] px-4 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const raw = data.indicadores ?? {};
  const i = {
    inventarios: raw.inventarios ?? 0,
    productos: raw.productos ?? 0,
    unidades: raw.unidades ?? 0,
    bajoStock: raw.bajoStock ?? 0,
    agotados: raw.agotados ?? 0,
    vencidos: raw.vencidos ?? 0,
    proximosAVencer: raw.proximosAVencer ?? 0,
    clientes: raw.clientes ?? 0,
    proveedores: raw.proveedores ?? 0,
    facturas: raw.facturas ?? 0,
    facturasPendientes: raw.facturasPendientes ?? 0,
    totalFacturado: Number(raw.totalFacturado ?? 0),
    carteraPendiente: Number(raw.carteraPendiente ?? 0),
    notificacionesNoLeidas: raw.notificacionesNoLeidas ?? 0,
    certificaciones: raw.certificaciones ?? 0,
  };

  const disponibles = Math.max(
    0,
    i.productos - i.bajoStock - i.agotados,
  );

  const vigentes = Math.max(
    0,
    i.productos - i.vencidos - i.proximosAVencer,
  );

  const stockData = [
    { name: 'Disponible', value: disponibles, color: COLORES.verde },
    { name: 'Bajo stock', value: i.bajoStock, color: COLORES.amarillo },
    { name: 'Agotado', value: i.agotados, color: COLORES.rojo },
  ];

  const vencimientosData = [
    { name: 'Vigente', value: vigentes, color: COLORES.verde },
    {
      name: 'Próximo',
      value: i.proximosAVencer,
      color: COLORES.amarillo,
    },
    { name: 'Vencido', value: i.vencidos, color: COLORES.rojo },
  ];

  const financieroData = [
    {
      name: 'Facturación',
      valor: i.totalFacturado,
    },
    {
      name: 'Cartera',
      valor: i.carteraPendiente,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#202a47]">
            Dashboard
          </h1>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Productos"
          value={String(i.productos)}
          note={`${i.unidades} unidades`}
          estado="NORMAL"
          to="/productos"
        />
        <Kpi
          label="Bajo stock"
          value={String(i.bajoStock)}
          note={`${i.agotados} agotado(s)`}
          estado={
            i.agotados > 0
              ? 'CRÍTICO'
              : i.bajoStock > 0
                ? 'ATENCIÓN'
                : 'NORMAL'
          }
          to="/productos"
        />
        <Kpi
          label="Vencimientos"
          value={String(i.vencidos)}
          note={`${i.proximosAVencer} próximos`}
          estado={
            i.vencidos > 0
              ? 'CRÍTICO'
              : i.proximosAVencer > 0
                ? 'ATENCIÓN'
                : 'NORMAL'
          }
          to="/inventario"
        />
        <Kpi
          label="Cartera pendiente"
          value={money(i.carteraPendiente)}
          note={`${i.facturasPendientes} factura(s)`}
          estado={
            i.carteraPendiente > 0
              ? 'ATENCIÓN'
              : 'NORMAL'
          }
          to="/facturas"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ChartPanel title="Salud del stock" subtitle="Distribución de productos por disponibilidad">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stockData}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={3}
              >
                {stockData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Semáforo de vencimientos" subtitle="Vigentes, próximos y vencidos">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={vencimientosData}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={3}
              >
                {vencimientosData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Facturación vs cartera" subtitle="Valor facturado y saldo pendiente">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={financieroData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="name" />
              <YAxis
                tickFormatter={(value) =>
                  compactMoney(Number(value))
                }
              />
              <Tooltip
                formatter={(value) =>
                  money(Number(value))
                }
              />
              <Bar
                dataKey="valor"
                fill={COLORES.azul}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Mini label="Inventarios" value={i.inventarios} />
        <Mini label="Clientes" value={i.clientes} />
        <Mini label="Proveedores" value={i.proveedores} />
        <Mini label="Facturas" value={i.facturas} />
        <Mini label="Certificaciones" value={i.certificaciones} />
        <Mini
          label="Notificaciones"
          value={i.notificacionesNoLeidas}
        />
        <Mini label="Bajo stock" value={i.bajoStock} />
        <Mini label="Agotados" value={i.agotados} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Listado
          title="Productos recientes"
          items={(data.productosRecientes ?? []).slice(0, 5).map(
            (p: any) => ({
              title: p.nombre,
              subtitle: `${p.inventario ?? ''} · ${p.categoria ?? ''}`,
              right: `${p.stock ?? 0} und.`,
            }),
          )}
          empty="Todavía no hay productos."
          to="/productos"
        />

        <Listado
          title="Facturas recientes"
          items={(data.facturasRecientes ?? []).slice(0, 5).map(
            (f: any) => ({
              title:
                f.numeroFactura ?? `Factura #${f.id}`,
              subtitle: `${f.clienteNombre ?? ''} · ${f.estado ?? ''}`,
              right: money(Number(f.valorTotal ?? 0)),
            }),
          )}
          empty="Todavía no hay facturas."
          to="/facturas"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Quick to="/inventario" label="Inventario" />
        <Quick to="/carga-masiva" label="Carga masiva" />
        <Quick to="/facturas" label="Facturación" />
        <Quick to="/certificacion" label="Certificación" />
        <Quick to="/reportes" label="Reportes" />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  estado,
  to,
}: {
  label: string;
  value: string;
  note: string;
  estado: 'NORMAL' | 'ATENCIÓN' | 'CRÍTICO';
  to: string;
}) {
  const classes =
    estado === 'CRÍTICO'
      ? 'border-red-200'
      : estado === 'ATENCIÓN'
        ? 'border-amber-200'
        : 'border-slate-200';

  const dot =
    estado === 'CRÍTICO'
      ? 'bg-red-500'
      : estado === 'ATENCIÓN'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <Link
      to={to}
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 ${classes}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#202a47]">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </Link>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-[#202a47]">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#202a47]">
        {value}
      </p>
    </div>
  );
}

function Listado({
  title,
  items,
  empty,
  to,
}: {
  title: string;
  items: Array<{
    title: string;
    subtitle: string;
    right: string;
  }>;
  empty: string;
  to: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-[#202a47]">{title}</h2>
        <Link
          to={to}
          className="text-sm font-semibold text-[#284bc2]"
        >
          Ver todo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#202a47]">
                  {item.title}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {item.subtitle}
                </p>
              </div>
              <span className="flex-none text-sm font-semibold">
                {item.right}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Quick({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-[#284bc2] hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function compactMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
