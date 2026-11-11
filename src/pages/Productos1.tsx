import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';

interface ProductoGlobal {
  registroId: number;
  inventarioId: number;
  inventario: string;
  categoriaId: number;
  categoria: string;
  fichaEstandar: boolean;
  nombre: string;
  referencia: string;
  cantidad: number;
  precio: number;
  proveedor: string;
  fechaVencimiento?: string | null;
  activo: boolean;
  datos: Record<string, any>;
}

export default function Productos() {
  const queryClient = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [estadoAdmin, setEstadoAdmin] = useState<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
  const [estadoStock, setEstadoStock] = useState<'TODOS' | 'DISPONIBLE' | 'BAJO' | 'AGOTADO'>('TODOS');
  const [inventarioFiltro, setInventarioFiltro] = useState('');
  const [productoEditando, setProductoEditando] = useState<ProductoGlobal | null>(null);
  const [datosEditando, setDatosEditando] = useState<Record<string, any>>({});

  const { data: productos = [], isLoading } = useQuery<ProductoGlobal[]>({
    queryKey: ['productos-globales'],
    queryFn: async () => {
      const inventarios = (await api.get('/inventarios')).data as any[];
      const resultado: ProductoGlobal[] = [];

      for (const inventario of inventarios) {
        const categorias = (await api.get(`/inventarios/${inventario.id}/categorias`)).data as any[];

        for (const categoria of categorias) {
          const detalle = (await api.get(`/inventarios/categorias/${categoria.id}`)).data as any;

          for (const registro of detalle?.registros ?? []) {
            const datos = registro.datos ?? {};
            const proveedor =
              typeof datos.proveedor === 'string'
                ? datos.proveedor
                : datos.proveedor?.nombreRazonSocial ??
                  registro.proveedor?.nombreRazonSocial ??
                  '';

            resultado.push({
              registroId: registro.id,
              inventarioId: inventario.id,
              inventario: inventario.nombre,
              categoriaId: categoria.id,
              categoria: categoria.nombre,
              fichaEstandar: detalle.modoCampos === 'PLANTILLA',
              nombre: String(datos.nombre ?? `Producto #${registro.id}`),
              referencia: String(datos.referencia ?? ''),
              cantidad: numero(datos.cantidad),
              precio: numero(datos.precio ?? datos.precioUnitario),
              proveedor: String(proveedor ?? ''),
              fechaVencimiento:
                datos.fechaVencimiento ??
                datos.fecha_vencimiento ??
                datos.vencimiento ??
                null,
              activo: datos.activo !== false,
              datos,
            });
          }
        }
      }

      return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });

  const actualizar = useMutation({
    mutationFn: async () =>
      api.patch(`/inventarios/registros/${productoEditando!.registroId}`, datosEditando),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['productos-globales'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-resumen-fase3'] }),
      ]);
      setProductoEditando(null);
      setDatosEditando({});
      await feedback.exito('Producto actualizado', 'Los cambios se guardaron correctamente.');
    },
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ producto, activo }: { producto: ProductoGlobal; activo: boolean }) =>
      api.patch(`/inventarios/registros/${producto.registroId}`, { activo }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['productos-globales'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-resumen-fase3'] }),
      ]);
      await feedback.exito(
        variables.activo ? 'Producto activado' : 'Producto desactivado',
        variables.activo
          ? 'El producto vuelve a estar disponible para la operación.'
          : 'El producto se conserva en el historial, pero queda bloqueado para nuevas operaciones.',
      );
    },
  });

  const inventarios = useMemo(
    () =>
      Array.from(
        new Map(productos.map((p) => [p.inventarioId, p.inventario])).entries(),
      ).map(([id, nombre]) => ({ id, nombre })),
    [productos],
  );

  const filtrados = useMemo(() => {
    const termino = buscar.trim().toLowerCase();

    return productos.filter((p) => {
      const coincideBusqueda =
        !termino ||
        `${p.nombre} PRD-${p.registroId} ${p.referencia} ${p.proveedor} ${p.categoria} ${p.inventario}`
          .toLowerCase()
          .includes(termino);

      const coincideAdmin =
        estadoAdmin === 'TODOS' ||
        (estadoAdmin === 'ACTIVO' ? p.activo : !p.activo);

      const stock = estadoStockProducto(p.cantidad, p.datos.stockMinimo);
      const coincideStock = estadoStock === 'TODOS' || stock === estadoStock;

      const coincideInventario =
        !inventarioFiltro || String(p.inventarioId) === inventarioFiltro;

      return coincideBusqueda && coincideAdmin && coincideStock && coincideInventario;
    });
  }, [productos, buscar, estadoAdmin, estadoStock, inventarioFiltro]);

  const confirmarCambioActivo = async (producto: ProductoGlobal) => {
    const activar = !producto.activo;

    const respuesta = await feedback.confirmar(
      activar ? '¿Activar producto?' : '¿Desactivar producto?',
      activar
        ? `${producto.nombre} volverá a estar disponible para facturación y certificación.`
        : `${producto.nombre} seguirá en el historial, pero no podrá facturarse ni certificarse mientras esté inactivo.`,
      activar ? 'Activar' : 'Desactivar',
    );

    if (!respuesta.isConfirmed) return;

    cambiarActivo.mutate({
      producto,
      activo: activar,
    });
  };

  const activos = productos.filter((p) => p.activo).length;
  const inactivos = productos.length - activos;
  const agotados = productos.filter((p) => p.cantidad <= 0).length;
  const bajo = productos.filter((p) => estadoStockProducto(p.cantidad, p.datos.stockMinimo) === 'BAJO').length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#10274d]">Productos</h1>
        </div>

        <button
          type="button"
          onClick={() => window.location.assign('/inventario')}
          className="rounded-xl bg-[#254a7e] px-5 py-3 text-sm font-semibold text-white"
        >
          + Crear desde Inventario
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi label="Productos" value={productos.length} />
        <Kpi label="Activos" value={activos} />
        <Kpi label="Inactivos" value={inactivos} />
        <Kpi label="Bajo stock" value={bajo} />
        <Kpi label="Agotados" value={agotados} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_190px_190px_210px]">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar producto, código, referencia o categoría..."
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#254a7e]"
        />

        <select
          value={estadoAdmin}
          onChange={(e) => setEstadoAdmin(e.target.value as any)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="TODOS">Activo / Inactivo</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>

        <select
          value={estadoStock}
          onChange={(e) => setEstadoStock(e.target.value as any)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="TODOS">Todo el stock</option>
          <option value="DISPONIBLE">Disponible</option>
          <option value="BAJO">Bajo stock</option>
          <option value="AGOTADO">Agotado</option>
        </select>

        <select
          value={inventarioFiltro}
          onChange={(e) => setInventarioFiltro(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="">Todos los inventarios</option>
          {inventarios.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-[#10274d]">Catálogo de productos</h2>
          <p className="mt-1 text-xs text-slate-500">{filtrados.length} resultado(s)</p>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Cargando productos...</p>
        ) : filtrados.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            No hay productos con los filtros seleccionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Inventario</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.registroId} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-[#10274d]">
                      {p.nombre}<span className="block font-mono text-xs font-normal text-slate-500">PRD-{p.registroId}</span>
                    </td>
                    <td className="px-4 py-3">{p.referencia || '—'}</td>
                    <td className="px-4 py-3">{p.inventario}</td>
                    <td className="px-4 py-3">{p.categoria}</td>
                    <td className="px-4 py-3 font-semibold">{p.cantidad}</td>
                    <td className="px-4 py-3">{moneda(p.precio)}</td>
                    <td className="px-4 py-3">{p.proveedor || '—'}</td>
                    <td className="px-4 py-3"><StockBadge cantidad={p.cantidad} minimo={p.datos.stockMinimo} /></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.activo
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProductoEditando(p);
                            const { foto, camposImportados, ...campos } = p.datos;
                            if (p.fichaEstandar) delete campos.cantidad;
                            setDatosEditando(campos);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarCambioActivo(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          disabled={!p.activo}
                          onClick={() => window.location.assign(`/facturas?registroId=${p.registroId}`)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e] disabled:opacity-40"
                        >
                          Facturar
                        </button>
                        <button
                          type="button"
                          disabled={!p.activo}
                          onClick={() => window.location.assign(`/certificacion?registroId=${p.registroId}`)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e] disabled:opacity-40"
                        >
                          Certificar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {productoEditando && (
        <Modal title={`Editar ${productoEditando.nombre}`} onClose={() => setProductoEditando(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actualizar.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.entries(datosEditando)
                .filter(
                  ([key]) =>
                    ![
                      'activo',
                      'productoOrigenRegistroId',
                      'productoOrigen',
                    ].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-sm font-medium text-[#10274d]">
                      {etiquetaCampo(key)}
                    </label>
                    <input
                      value={valorInput(value)}
                      onChange={(e) =>
                        setDatosEditando((actual) => ({
                          ...actual,
                          [key]:
                            typeof value === 'number'
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    />
                  </div>
                ))}
            </div>

            <label className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm">
              <input
                type="checkbox"
                checked={datosEditando.activo !== false}
                onChange={(e) =>
                  setDatosEditando((actual) => ({
                    ...actual,
                    activo: e.target.checked,
                  }))
                }
              />
              Producto activo
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProductoEditando(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5"
              >
                Cancelar
              </button>
              <button
                disabled={actualizar.isPending}
                className="rounded-xl bg-[#254a7e] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#10274d]">{value}</p>
    </div>
  );
}

function StockBadge({ cantidad, minimo }: { cantidad: number; minimo?: number }) {
  const estado = estadoStockProducto(cantidad, minimo);
  const classes =
    estado === 'AGOTADO'
      ? 'bg-red-50 text-red-700'
      : estado === 'BAJO'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700';

  const label =
    estado === 'AGOTADO'
      ? 'AGOTADO'
      : estado === 'BAJO'
        ? 'BAJO STOCK'
        : 'DISPONIBLE';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-[#10274d]">{title}</h2>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function estadoStockProducto(cantidad: number, minimo = 5) {
  if (cantidad <= 0) return 'AGOTADO';
  if (cantidad <= minimo) return 'BAJO';
  return 'DISPONIBLE';
}
function numero(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function moneda(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}
function etiquetaCampo(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
function valorInput(value: any) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
