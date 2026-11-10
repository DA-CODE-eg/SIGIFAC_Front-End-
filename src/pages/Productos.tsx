import { useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';

type SourceProducto =
  | 'REGISTRO_ENTIDAD'
  | 'PRODUCTO_LEGACY';

interface ProductoCatalogo {
  source: SourceProducto;
  id: string | number;

  registroId?: number | null;
  productoLegacyId?: number | null;

  inventarioId?: number | null;
  inventario: string;

  categoriaId?: number | null;
  categoria: string;

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
  const [estadoAdmin, setEstadoAdmin] = useState<
    'TODOS' | 'ACTIVO' | 'INACTIVO'
  >('TODOS');
  const [estadoStock, setEstadoStock] = useState<
    'TODOS' | 'DISPONIBLE' | 'BAJO' | 'AGOTADO'
  >('TODOS');
  const [inventarioFiltro, setInventarioFiltro] =
    useState('');

  const [productoEditando, setProductoEditando] =
    useState<ProductoCatalogo | null>(null);

  const [formLegacy, setFormLegacy] = useState({
    nombre: '',
    descripcion: '',
    categoria: '',
    cantidad: 0,
    precioUnitario: 0,
    fechaVencimiento: '',
    estado: 'ACTIVO',
  });

  const [datosRegistro, setDatosRegistro] = useState<
    Record<string, any>
  >({});

  const {
    data: productos = [],
    isLoading,
    refetch,
  } = useQuery<ProductoCatalogo[]>({
    queryKey: ['productos-globales'],
    queryFn: async () => {
      const { data } = await api.get(
        '/inventarios/catalogo/productos',
      );

      return (Array.isArray(data) ? data : [])
        .map((item: any): ProductoCatalogo => {
          const datos = item.datos ?? {};

          const proveedor =
            typeof item.proveedor === 'string'
              ? item.proveedor
              : item.proveedor?.nombreRazonSocial ??
                (typeof datos.proveedor === 'string'
                  ? datos.proveedor
                  : datos.proveedor?.nombreRazonSocial) ??
                '';

          return {
            source:
              item.source === 'PRODUCTO_LEGACY'
                ? 'PRODUCTO_LEGACY'
                : 'REGISTRO_ENTIDAD',

            id: item.id,

            registroId:
              item.registroId ??
              (item.source === 'REGISTRO_ENTIDAD'
                ? Number(item.id)
                : null),

            productoLegacyId:
              item.productoLegacyId ?? null,

            inventarioId: item.inventarioId ?? null,
            inventario:
              item.inventario ?? 'Catálogo anterior',

            categoriaId: item.entidadId ?? null,
            categoria:
              item.categoria ?? 'Sin categoría',

            nombre: String(
              item.nombre ??
                datos.nombre ??
                `Producto #${item.id}`,
            ),

            referencia: String(
              item.referencia ??
                datos.referencia ??
                '',
            ),

            cantidad: numero(
              item.cantidad ?? datos.cantidad,
            ),

            precio: numero(
              item.precio ??
                datos.precio ??
                datos.precioUnitario,
            ),

            proveedor: String(proveedor ?? ''),

            fechaVencimiento:
              datos.fechaVencimiento ??
              datos.fecha_vencimiento ??
              datos.vencimiento ??
              null,

            activo:
              typeof item.activo === 'boolean'
                ? item.activo
                : datos.activo !== false,

            datos,
          };
        })
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        );
    },
  });

  const editarLegacy = useMutation({
    mutationFn: async () => {
      if (!productoEditando?.productoLegacyId) {
        throw new Error('Producto legacy inválido');
      }

      return api.patch(
        `/productos/${productoEditando.productoLegacyId}`,
        {
          nombre: formLegacy.nombre,
          descripcion:
            formLegacy.descripcion || undefined,
          categoria:
            formLegacy.categoria || undefined,
          cantidad: Number(formLegacy.cantidad),
          precioUnitario: Number(
            formLegacy.precioUnitario,
          ),
          fechaVencimiento:
            formLegacy.fechaVencimiento || undefined,
          estado: formLegacy.estado,
        },
      );
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['productos-globales'],
      });

      setProductoEditando(null);

      await feedback.exito(
        'Producto actualizado',
        'Los datos del catálogo anterior fueron guardados.',
      );
    },
  });

  const editarRegistro = useMutation({
    mutationFn: async () => {
      if (!productoEditando?.registroId) {
        throw new Error('Producto de inventario inválido');
      }

      return api.patch(
        `/inventarios/registros/${productoEditando.registroId}`,
        {
          datos: datosRegistro,
        },
      );
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['productos-globales'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dashboard-resumen-fase3'],
        }),
      ]);

      setProductoEditando(null);

      await feedback.exito(
        'Producto actualizado',
        'Los cambios fueron guardados.',
      );
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({
      producto,
      activo,
    }: {
      producto: ProductoCatalogo;
      activo: boolean;
    }) => {
      if (
        producto.source === 'PRODUCTO_LEGACY'
      ) {
        return api.patch(
          `/productos/${producto.productoLegacyId}`,
          {
            estado: activo
              ? 'ACTIVO'
              : 'INACTIVO',
          },
        );
      }

      return api.patch(
        `/inventarios/registros/${producto.registroId}`,
        {
          datos: {
            activo,
          },
        },
      );
    },

    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['productos-globales'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dashboard-resumen-fase3'],
        }),
      ]);

      await feedback.exito(
        variables.activo
          ? 'Producto activado'
          : 'Producto desactivado',
        variables.activo
          ? 'El producto vuelve a estar disponible.'
          : 'El producto se conserva en el historial.',
      );
    },
  });

  const inventarios = useMemo(() => {
    const mapa = new Map<number, string>();

    productos.forEach((producto) => {
      if (
        producto.inventarioId &&
        producto.source === 'REGISTRO_ENTIDAD'
      ) {
        mapa.set(
          producto.inventarioId,
          producto.inventario,
        );
      }
    });

    return Array.from(mapa.entries()).map(
      ([id, nombre]) => ({
        id,
        nombre,
      }),
    );
  }, [productos]);

  const filtrados = useMemo(() => {
    const termino = buscar
      .trim()
      .toLowerCase();

    return productos.filter((p) => {
      const coincideBusqueda =
        !termino ||
        `${p.nombre} ${p.referencia} ${p.proveedor} ${p.categoria} ${p.inventario}`
          .toLowerCase()
          .includes(termino);

      const coincideAdmin =
        estadoAdmin === 'TODOS' ||
        (estadoAdmin === 'ACTIVO'
          ? p.activo
          : !p.activo);

      const stock = estadoStockProducto(
        p.cantidad,
      );

      const coincideStock =
        estadoStock === 'TODOS' ||
        stock === estadoStock;

      const coincideInventario =
        !inventarioFiltro ||
        String(p.inventarioId) ===
          inventarioFiltro;

      return (
        coincideBusqueda &&
        coincideAdmin &&
        coincideStock &&
        coincideInventario
      );
    });
  }, [
    productos,
    buscar,
    estadoAdmin,
    estadoStock,
    inventarioFiltro,
  ]);

  const activos = productos.filter(
    (p) => p.activo,
  ).length;

  const inactivos =
    productos.length - activos;

  const agotados = productos.filter(
    (p) => p.cantidad <= 0,
  ).length;

  const bajo = productos.filter(
    (p) =>
      p.cantidad > 0 && p.cantidad <= 5,
  ).length;

  const abrirEditar = (
    producto: ProductoCatalogo,
  ) => {
    setProductoEditando(producto);

    if (
      producto.source === 'PRODUCTO_LEGACY'
    ) {
      setFormLegacy({
        nombre: producto.nombre,
        descripcion:
          String(
            producto.datos.descripcion ?? '',
          ),
        categoria:
          producto.categoria ===
          'Sin categoría'
            ? ''
            : producto.categoria,
        cantidad: producto.cantidad,
        precioUnitario: producto.precio,
        fechaVencimiento:
          producto.fechaVencimiento
            ? String(
                producto.fechaVencimiento,
              ).slice(0, 10)
            : '',
        estado: producto.activo
          ? 'ACTIVO'
          : 'INACTIVO',
      });
      return;
    }

    setDatosRegistro({
      ...producto.datos,
    });
  };

  const confirmarCambioEstado = async (
    producto: ProductoCatalogo,
  ) => {
    const activar = !producto.activo;

    const respuesta =
      await feedback.confirmar(
        activar
          ? '¿Activar producto?'
          : '¿Desactivar producto?',
        activar
          ? `${producto.nombre} volverá a estar disponible.`
          : `${producto.nombre} seguirá en el historial, pero quedará inactivo.`,
        activar ? 'Activar' : 'Desactivar',
      );

    if (!respuesta.isConfirmed) return;

    cambiarEstado.mutate({
      producto,
      activo: activar,
    });
  };

  const relacionarAInventario = (
    producto: ProductoCatalogo,
  ) => {
    if (
      producto.source !==
        'PRODUCTO_LEGACY' ||
      !producto.productoLegacyId
    ) {
      return;
    }

    window.location.assign(
      `/inventario?productoLegacyId=${producto.productoLegacyId}`,
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Catálogo global · productos
          </p>

          <h1 className="text-3xl font-semibold text-[#10274d]">
            Productos
          </h1>

          <p className="mt-2 max-w-3xl text-slate-500">
            Consulta productos de inventarios
            actuales y del catálogo anterior.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            window.location.assign(
              '/inventario',
            )
          }
          className="rounded-xl bg-[#254a7e] px-5 py-3 text-sm font-semibold text-white"
        >
          + Agregar a inventario
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi
          label="Productos"
          value={productos.length}
        />
        <Kpi
          label="Activos"
          value={activos}
        />
        <Kpi
          label="Inactivos"
          value={inactivos}
        />
        <Kpi
          label="Bajo stock"
          value={bajo}
        />
        <Kpi
          label="Agotados"
          value={agotados}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_190px_190px_220px]">
        <input
          value={buscar}
          onChange={(e) =>
            setBuscar(e.target.value)
          }
          placeholder="Buscar producto, referencia, proveedor, categoría..."
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#254a7e]"
        />

        <select
          value={estadoAdmin}
          onChange={(e) =>
            setEstadoAdmin(
              e.target.value as any,
            )
          }
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="TODOS">
            Activo / Inactivo
          </option>
          <option value="ACTIVO">
            Activos
          </option>
          <option value="INACTIVO">
            Inactivos
          </option>
        </select>

        <select
          value={estadoStock}
          onChange={(e) =>
            setEstadoStock(
              e.target.value as any,
            )
          }
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="TODOS">
            Todo el stock
          </option>
          <option value="DISPONIBLE">
            Disponible
          </option>
          <option value="BAJO">
            Bajo stock
          </option>
          <option value="AGOTADO">
            Agotado
          </option>
        </select>

        <select
          value={inventarioFiltro}
          onChange={(e) =>
            setInventarioFiltro(
              e.target.value,
            )
          }
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="">
            Todos los inventarios
          </option>

          {inventarios.map((inventario) => (
            <option
              key={inventario.id}
              value={inventario.id}
            >
              {inventario.nombre}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-[#10274d]">
              Catálogo de productos
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {filtrados.length} resultado(s)
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-[#254a7e]"
          >
            Actualizar
          </button>
        </div>

        {isLoading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Cargando productos...
          </p>
        ) : filtrados.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            No hay productos con los filtros
            seleccionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">
                    Producto
                  </th>
                  <th className="px-4 py-3">
                    Referencia
                  </th>
                  <th className="px-4 py-3">
                    Inventario
                  </th>
                  <th className="px-4 py-3">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-right">
                    Cant.
                  </th>
                  <th className="px-4 py-3 text-right">
                    Precio
                  </th>
                  <th className="px-4 py-3">
                    Proveedor
                  </th>
                  <th className="px-4 py-3">
                    Stock
                  </th>
                  <th className="px-4 py-3">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={`${p.source}-${p.id}`}
                    className="border-t border-slate-100 align-middle hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="max-w-[210px]">
                        <p className="truncate font-semibold text-[#10274d]">
                          {p.nombre}
                        </p>

                        {p.source ===
                          'PRODUCTO_LEGACY' && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            CATÁLOGO ANTERIOR
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {p.referencia || '—'}
                    </td>

                    <td className="px-4 py-3">
                      {p.inventario}
                    </td>

                    <td className="px-4 py-3">
                      {p.categoria}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {p.cantidad}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {moneda(p.precio)}
                    </td>

                    <td className="px-4 py-3">
                      {p.proveedor || '—'}
                    </td>

                    <td className="px-4 py-3">
                      <StockBadge
                        cantidad={p.cantidad}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <EstadoBadge
                        activo={p.activo}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            abrirEditar(p)
                          }
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            confirmarCambioEstado(
                              p,
                            )
                          }
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                            p.activo
                              ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {p.activo
                            ? 'Desactivar'
                            : 'Activar'}
                        </button>

                        {p.source ===
                        'PRODUCTO_LEGACY' ? (
                          <button
                            type="button"
                            onClick={() =>
                              relacionarAInventario(
                                p,
                              )
                            }
                            className="rounded-lg border border-[#b9cce2] bg-[#edf3fa] px-2.5 py-1.5 text-xs font-semibold text-[#254a7e]"
                          >
                            Relacionar
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={!p.activo}
                              onClick={() =>
                                window.location.assign(
                                  `/facturas?registroId=${p.registroId}`,
                                )
                              }
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-[#254a7e] disabled:opacity-40"
                            >
                              Facturar
                            </button>

                            <button
                              type="button"
                              disabled={!p.activo}
                              onClick={() =>
                                window.location.assign(
                                  `/certificacion?registroId=${p.registroId}`,
                                )
                              }
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-[#254a7e] disabled:opacity-40"
                            >
                              Certificar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {productoEditando && (
        <Modal
          title={`Editar ${productoEditando.nombre}`}
          onClose={() =>
            setProductoEditando(null)
          }
        >
          {productoEditando.source ===
          'PRODUCTO_LEGACY' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editarLegacy.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Nombre"
                  value={formLegacy.nombre}
                  onChange={(value) =>
                    setFormLegacy((actual) => ({
                      ...actual,
                      nombre: value,
                    }))
                  }
                  required
                />

                <Input
                  label="Categoría"
                  value={formLegacy.categoria}
                  onChange={(value) =>
                    setFormLegacy((actual) => ({
                      ...actual,
                      categoria: value,
                    }))
                  }
                />

                <Input
                  label="Cantidad"
                  type="number"
                  value={String(
                    formLegacy.cantidad,
                  )}
                  onChange={(value) =>
                    setFormLegacy((actual) => ({
                      ...actual,
                      cantidad:
                        Number(value),
                    }))
                  }
                  required
                />

                <Input
                  label="Precio unitario"
                  type="number"
                  value={String(
                    formLegacy.precioUnitario,
                  )}
                  onChange={(value) =>
                    setFormLegacy((actual) => ({
                      ...actual,
                      precioUnitario:
                        Number(value),
                    }))
                  }
                  required
                />

                <Input
                  label="Fecha vencimiento"
                  type="date"
                  value={
                    formLegacy.fechaVencimiento
                  }
                  onChange={(value) =>
                    setFormLegacy((actual) => ({
                      ...actual,
                      fechaVencimiento:
                        value,
                    }))
                  }
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#10274d]">
                    Estado
                  </label>

                  <select
                    value={formLegacy.estado}
                    onChange={(e) =>
                      setFormLegacy(
                        (actual) => ({
                          ...actual,
                          estado:
                            e.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <option value="ACTIVO">
                      ACTIVO
                    </option>
                    <option value="INACTIVO">
                      INACTIVO
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-[#10274d]">
                    Descripción
                  </label>

                  <textarea
                    value={
                      formLegacy.descripcion
                    }
                    onChange={(e) =>
                      setFormLegacy(
                        (actual) => ({
                          ...actual,
                          descripcion:
                            e.target.value,
                        }),
                      )
                    }
                    className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3"
                  />
                </div>
              </div>

              <ModalActions
                loading={
                  editarLegacy.isPending
                }
                onCancel={() =>
                  setProductoEditando(null)
                }
              />
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editarRegistro.mutate();
              }}
            >
              <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
                {Object.entries(datosRegistro)
                  .filter(
                    ([key]) =>
                      ![
                        'productoOrigen',
                        'productoOrigenRegistroId',
                        'productoLegacyId',
                      ].includes(key),
                  )
                  .map(([key, value]) => (
                    <Input
                      key={key}
                      label={etiquetaCampo(
                        key,
                      )}
                      value={valorInput(
                        value,
                      )}
                      onChange={(
                        nuevo,
                      ) =>
                        setDatosRegistro(
                          (actual) => ({
                            ...actual,
                            [key]:
                              typeof value ===
                              'number'
                                ? Number(
                                    nuevo,
                                  )
                                : nuevo,
                          }),
                        )
                      }
                    />
                  ))}
              </div>

              <ModalActions
                loading={
                  editarRegistro.isPending
                }
                onCancel={() =>
                  setProductoEditando(null)
                }
              />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-[#10274d]">
        {value}
      </p>
    </div>
  );
}

function StockBadge({
  cantidad,
}: {
  cantidad: number;
}) {
  const estado =
    estadoStockProducto(cantidad);

  const clase =
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

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${clase}`}
    >
      {label}
    </span>
  );
}

function EstadoBadge({
  activo,
}: {
  activo: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        activo
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {activo ? 'ACTIVO' : 'INACTIVO'}
    </span>
  );
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
          <h2 className="text-xl font-semibold text-[#10274d]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#10274d]">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        required={required}
        className="w-full rounded-xl border border-slate-200 px-4 py-3"
      />
    </div>
  );
}

function ModalActions({
  loading,
  onCancel,
}: {
  loading: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
      >
        Cancelar
      </button>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#254a7e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading
          ? 'Guardando...'
          : 'Guardar cambios'}
      </button>
    </div>
  );
}

function estadoStockProducto(
  cantidad: number,
) {
  if (cantidad <= 0) return 'AGOTADO';
  if (cantidad <= 5) return 'BAJO';
  return 'DISPONIBLE';
}

function numero(value: any) {
  const result = Number(value ?? 0);
  return Number.isFinite(result)
    ? result
    : 0;
}

function moneda(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function etiquetaCampo(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) =>
      c.toUpperCase(),
    );
}

function valorInput(value: any) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  if (typeof value === 'object') {
    return (
      value.nombreRazonSocial ??
      value.nombre ??
      value.numeroFactura ??
      JSON.stringify(value)
    );
  }

  return String(value);
}
