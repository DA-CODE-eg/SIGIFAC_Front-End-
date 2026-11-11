import {
  useMemo,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { API_BASE_URL, api } from '../api/client';
import { feedback } from '../lib/feedback';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

type Tipo =
  | 'INVENTARIO'
  | 'CATEGORIA'
  | 'PRODUCTO'
  | 'MOVIMIENTO'
  | 'VENTA';

type Uso =
  | 'INTERNO'
  | 'CLIENTE'
  | 'PROVEEDOR'
  | 'OTRO';

type Producto = {
  registroId: number;
  inventarioId: number;
  inventario: string;
  categoriaId: number;
  categoria: string;
  nombre: string;
  referencia: string;
  stock: number;
  precio: number;
};

export default function Certificacion() {
  const usuario = useAuthStore((state) => state.usuario);
  const qc =
    useQueryClient();

  const [tipo, setTipo] =
    useState<Tipo>(
      'INVENTARIO',
    );

  const descargarPdfInterno = async (codigo: string) => {
    try {
      const { data } = await api.get<Blob>(`/certificacion/certificado/${encodeURIComponent(codigo)}/pdf-interno`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'sertiva-certificado-interno.pdf';
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      await feedback.error('No se pudo descargar la copia interna', 'Confirma que el firmante autorizó conservar su captura facial.');
    }
  };

  const [metodoFirma, setMetodoFirma] = useState('CODIGO');
  const { data: metodosFirma } = useQuery({
    queryKey: ['metodos-firma', usuario?.id],
    enabled: !!usuario?.id,
    refetchInterval: 15000,
    queryFn: async () => (await api.get<{ facial: boolean; motivo?: string }>('/certificacion/firma/metodos')).data,
  });
  const [uso, setUso] =
    useState<Uso>(
      'CLIENTE',
    );

  const [
    inventarioId,
    setInventarioId,
  ] = useState('');

  const [
    categoriaId,
    setCategoriaId,
  ] = useState('');

  const [
    facturaId,
    setFacturaId,
  ] = useState('');

  const [
    movimientoId,
    setMovimientoId,
  ] = useState('');

  const [
    seleccionados,
    setSeleccionados,
  ] = useState<
    Record<number, number>
  >({});

  const [
    contactoId,
    setContactoId,
  ] = useState('');

  const [
    correoOtro,
    setCorreoOtro,
  ] = useState('');

  const [
    nombreOtro,
    setNombreOtro,
  ] = useState('');

  const [
    documentoOtro,
    setDocumentoOtro,
  ] = useState('');

  const [
    observacion,
    setObservacion,
  ] = useState('');

  const {
    data: solicitudes = [],
  } = useQuery<any[]>({
    queryKey: [
      'certificacion-solicitudes',
    ],
    queryFn: async () =>
      (
        await api.get(
          '/certificacion/solicitudes',
        )
      ).data,
  });

  const {
    data: inventarios = [],
  } = useQuery<any[]>({
    queryKey: [
      'inventarios-certificacion',
    ],
    queryFn: async () =>
      (
        await api.get(
          '/inventarios',
        )
      ).data,
  });

  const {
    data: catalogo = [],
  } = useQuery<any[]>({
    queryKey: [
      'catalogo-certificacion',
    ],
    queryFn: async () =>
      (
        await api.get(
          '/inventarios/catalogo/productos',
        )
      ).data,
  });

  const productos =
    useMemo<Producto[]>(() => {
      return catalogo
        .filter(
          (x: any) =>
            x.source ===
            'REGISTRO_ENTIDAD',
        )
        .map(
          (x: any) => ({
            registroId:
              Number(
                x.registroId ??
                  x.id,
              ),
            inventarioId:
              Number(
                x.inventarioId,
              ),
            inventario:
              String(
                x.inventario ??
                  '',
              ),
            categoriaId:
              Number(
                x.entidadId ??
                  x.categoriaId,
              ),
            categoria:
              String(
                x.categoria ??
                  '',
              ),
            nombre:
              String(
                x.nombre ??
                  '',
              ),
            referencia:
              String(
                x.referencia ??
                  '',
              ),
            stock:
              Number(
                x.cantidad ??
                  0,
              ),
            precio:
              Number(
                x.precio ??
                  0,
              ),
          }),
        );
    }, [catalogo]);

  const {
    data: facturas = [],
  } = useQuery<any[]>({
    queryKey: [
      'facturas-certificacion',
    ],
    queryFn: async () =>
      (
        await api.get(
          '/facturas-integradas',
        )
      ).data,
  });

  const {
    data: movimientos = [],
  } = useQuery<any[]>({
    queryKey: [
      'movimientos-certificacion',
      inventarioId,
    ],
    queryFn: async () =>
      inventarioId
        ? (
            await api.get(
              `/inventarios/${inventarioId}/movimientos`,
            )
          ).data
        : [],
    enabled:
      tipo ===
        'MOVIMIENTO' &&
      Boolean(
        inventarioId,
      ),
  });

  const {
    data: contactos = [],
  } = useQuery<any[]>({
    queryKey: [
      'contactos-certificacion',
      uso,
    ],
    queryFn: async () =>
      (
        await api.get(
          '/contactos',
          {
            params: {
              tipo:
                uso ===
                'CLIENTE'
                  ? 'CLIENTE'
                  : 'PROVEEDOR',
            },
          },
        )
      ).data,
    enabled:
      uso === 'CLIENTE' ||
      uso === 'PROVEEDOR',
  });

  const categorias =
    useMemo(() => {
      const map =
        new Map<
          number,
          {
            id: number;
            nombre: string;
            inventarioId: number;
          }
        >();

      productos.forEach(
        (p) =>
          map.set(
            p.categoriaId,
            {
              id:
                p.categoriaId,
              nombre:
                p.categoria,
              inventarioId:
                p.inventarioId,
            },
          ),
      );

      return [
        ...map.values(),
      ].filter(
        (c) =>
          !inventarioId ||
          c.inventarioId ===
            Number(
              inventarioId,
            ),
      );
    }, [
      productos,
      inventarioId,
    ]);

  const productosFiltrados =
    productos.filter(
      (p) => {
        if (
          inventarioId &&
          p.inventarioId !==
            Number(
              inventarioId,
            )
        )
          return false;

        if (
          categoriaId &&
          p.categoriaId !==
            Number(
              categoriaId,
            )
        )
          return false;

        return true;
      },
    );

  const crear =
    useMutation({
      mutationFn:
        async () => {
          const contenido =
            await construirContenido();

          const payload: any =
            {
              tipoCertificacion:
                tipo,
              uso,
              metodoFirma,
              observacion:
                observacion ||
                undefined,
              contenido,
            };

          if (
            uso ===
              'CLIENTE' ||
            uso ===
              'PROVEEDOR'
          ) {
            payload.contactoId =
              Number(
                contactoId,
              );
          }

          if (
            uso ===
            'OTRO'
          ) {
            payload.destinatarioCorreo =
              correoOtro;
            payload.destinatarioNombre =
              nombreOtro;
            payload.destinatarioIdentificacion =
              documentoOtro;
          }

          return api.post<{ correoEnviado: boolean }>(
            '/certificacion/firma/solicitudes',
            payload,
          );
        },

      onSuccess:
        async ({ data }) => {
          void qc.invalidateQueries(
            {
              queryKey: [
                'certificacion-solicitudes',
              ],
            },
          );

          setSeleccionados(
            {},
          );
          setFacturaId('');
          setMovimientoId('');
          setObservacion('');

          if (data.correoEnviado === false) {
            await feedback.error('Solicitud guardada', 'El proveedor no confirmó el envío. Usa Reenviar solicitud en el historial.');
          } else {
            await feedback.exito('Solicitud enviada', 'El proveedor de correo aceptó la invitación.');
          }
        },
    });

  const reenviar = useMutation({
    mutationFn: (id: number) => api.post(`/certificacion/firma/solicitudes/${id}/reenviar`),
    onSuccess: () => feedback.exito('Solicitud reenviada', 'El proveedor aceptó el correo y se restablecieron los intentos de la solicitud.'),
    onError: (error) => feedback.error('No se pudo reenviar', isAxiosError(error) ? error.response?.data?.message ?? 'Intenta nuevamente.' : 'Intenta nuevamente.'),
  });

  const construirContenido =
    async () => {
      if (
        tipo ===
        'VENTA'
      ) {
        const {
          data: f,
        } =
          await api.get(
            `/facturas-integradas/${facturaId}`,
          );

        return {
          titulo:
            f.numeroFactura ??
            `Factura #${f.id}`,
          tipo:
            'VENTA',
          factura: {
            id: f.id,
            numeroFactura:
              f.numeroFactura,
            cliente:
              f.clienteNombre,
            identificacion:
              f.clienteIdentificador,
            fechaEmision:
              f.fechaEmision,
          },
          items: (
            f.items ??
            []
          ).map(
            (i: any) => ({
              id: i.id,
              nombreProducto:
                i.nombreProducto,
              bodegaNombre: i.bodegaNombre,
              loteCodigo: i.loteCodigo,
              referencia:
                i.referencia,
              inventario:
                i.registroEntidad
                  ?.entidad
                  ?.inventario
                  ?.nombre ??
                '',
              cantidad:
                Number(
                  i.cantidad,
                ),
              precioUnitario:
                Number(
                  i.precioUnitario,
                ),
              descuento:
                Number(
                  i.descuento,
                ),
              impuesto:
                Number(
                  i.impuesto,
                ),
              subtotal:
                Number(
                  i.subtotal,
                ),
            }),
          ),
          totales: {
            subtotal:
              Number(
                f.valorTotal,
              ) -
              (
                f.items ??
                []
              ).reduce(
                (
                  sum: number,
                  i: any,
                ) =>
                  sum +
                  Number(
                    i.impuesto,
                  ),
                0,
              ),
            descuentos:
              (
                f.items ??
                []
              ).reduce(
                (
                  sum: number,
                  i: any,
                ) =>
                  sum +
                  Number(
                    i.descuento,
                  ),
                0,
              ),
            impuestos:
              (
                f.items ??
                []
              ).reduce(
                (
                  sum: number,
                  i: any,
                ) =>
                  sum +
                  Number(
                    i.impuesto,
                  ),
                0,
              ),
            valorFacturado:
              Number(
                f.valorTotal,
              ),
          },
        };
      }

      if (
        tipo ===
        'MOVIMIENTO'
      ) {
        const mov =
          movimientos.find(
            (m: any) =>
              String(m.id) ===
              String(
                movimientoId,
              ),
          );

        return {
          titulo:
            'Movimiento de inventario',
          tipo:
            'MOVIMIENTO',
          movimiento:
            mov,
          items: mov
            ? [
                {
                  nombreProducto:
                    mov.producto ??
                    `Producto #${mov.registroEntidadId}`,
                  referencia:
                    mov.referenciaOrigen ??
                    '',
                  inventario:
                    mov.inventario?.nombre ??
                    '',
                  cantidad:
                    Number(
                      mov.cantidad ??
                        0,
                    ),
                  precioUnitario:
                    0,
                  impuesto:
                    0,
                  subtotal:
                    0,
                },
              ]
            : [],
        };
      }

      const elegidos =
        tipo ===
        'PRODUCTO'
          ? productos.filter(
              (p) =>
                seleccionados[
                  p.registroId
                ] !==
                undefined,
            )
          : tipo ===
            'CATEGORIA'
            ? productos.filter(
                (p) =>
                  p.categoriaId ===
                  Number(
                    categoriaId,
                  ),
              )
            : productos.filter(
                (p) =>
                  p.inventarioId ===
                  Number(
                    inventarioId,
                  ),
              );

      return {
        titulo:
          tipo ===
          'INVENTARIO'
            ? `Inventario ${
                inventarios.find(
                  (i: any) =>
                    String(
                      i.id,
                    ) ===
                    String(
                      inventarioId,
                    ),
                )?.nombre ??
                ''
              }`
            : tipo ===
              'CATEGORIA'
              ? `Categoría ${
                  categorias.find(
                    (c) =>
                      String(
                        c.id,
                      ) ===
                      String(
                        categoriaId,
                      ),
                  )?.nombre ??
                  ''
                }`
              : 'Productos certificados',

        tipo,

        items:
          elegidos.map(
            (p) => ({
              registroId:
                p.registroId,
              nombreProducto:
                p.nombre,
              referencia:
                p.referencia,
              inventario:
                p.inventario,
              categoria:
                p.categoria,
              cantidad:
                tipo ===
                'PRODUCTO'
                  ? Number(
                      seleccionados[
                        p
                          .registroId
                      ],
                    )
                  : p.stock,
              precioUnitario:
                p.precio,
              impuesto: 0,
              subtotal:
                (tipo ===
                'PRODUCTO'
                  ? Number(
                      seleccionados[
                        p
                          .registroId
                      ],
                    )
                  : p.stock) *
                p.precio,
            }),
          ),
      };
    };

  const toggle = (
    p: Producto,
  ) => {
    setSeleccionados(
      (actual) => {
        const next = {
          ...actual,
        };

        if (
          next[
            p.registroId
          ] !== undefined
        ) {
          delete next[
            p.registroId
          ];
        } else {
          next[
            p.registroId
          ] =
            Math.min(
              1,
              p.stock ||
                1,
            );
        }

        return next;
      },
    );
  };

  const origenValido =
    tipo ===
    'INVENTARIO'
      ? Boolean(
          inventarioId,
        )
      : tipo ===
        'CATEGORIA'
        ? Boolean(
            categoriaId,
          )
        : tipo ===
          'PRODUCTO'
          ? Object.keys(
              seleccionados,
            ).length > 0
          : tipo ===
            'MOVIMIENTO'
            ? Boolean(
                movimientoId,
              )
            : Boolean(
                facturaId,
              );

  const destinoValido =
    uso ===
    'INTERNO'
      ? true
      : uso ===
          'OTRO'
        ? Boolean(
            correoOtro &&
              nombreOtro &&
              documentoOtro,
          )
        : Boolean(
            contactoId,
          );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>

        <h1 className="text-3xl font-semibold text-[#10274d]">
          Certificación
        </h1>

      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-[#10274d]">
            1. ¿Qué deseas certificar?
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {(
              [
                'INVENTARIO',
                'CATEGORIA',
                'PRODUCTO',
                'MOVIMIENTO',
                'VENTA',
              ] as Tipo[]
            ).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipo(t);
                    setSeleccionados(
                      {},
                    );
                  }}
                  className={`rounded-xl border p-3 text-sm font-semibold ${
                    tipo === t
                      ? 'border-[#254a7e] bg-[#edf3fa] text-[#254a7e]'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {etiquetaTipo(
                    t,
                  )}
                </button>
              ),
            )}
          </div>

          {[
            'INVENTARIO',
            'CATEGORIA',
            'PRODUCTO',
            'MOVIMIENTO',
          ].includes(
            tipo,
          ) && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <select
                value={
                  inventarioId
                }
                onChange={(e) => {
                  setInventarioId(
                    e.target.value,
                  );
                  setCategoriaId(
                    '',
                  );
                }}
                className="rounded-xl border border-slate-200 px-4 py-3"
              >
                <option value="">
                  Selecciona inventario
                </option>

                {inventarios.map(
                  (i: any) => (
                    <option
                      key={i.id}
                      value={i.id}
                    >
                      {i.nombre}
                    </option>
                  ),
                )}
              </select>

              {[
                'CATEGORIA',
                'PRODUCTO',
              ].includes(
                tipo,
              ) && (
                <select
                  value={
                    categoriaId
                  }
                  onChange={(e) =>
                    setCategoriaId(
                      e.target.value,
                    )
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                >
                  <option value="">
                    {tipo ===
                    'PRODUCTO'
                      ? 'Todas las categorías'
                      : 'Selecciona categoría'}
                  </option>

                  {categorias.map(
                    (c) => (
                      <option
                        key={c.id}
                        value={c.id}
                      >
                        {c.nombre}
                      </option>
                    ),
                  )}
                </select>
              )}
            </div>
          )}

          {tipo ===
            'PRODUCTO' && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-[330px] overflow-y-auto">
                {productosFiltrados.map(
                  (p) => {
                    const checked =
                      seleccionados[
                        p
                          .registroId
                      ] !==
                      undefined;

                    return (
                      <div
                        key={
                          p.registroId
                        }
                        className="grid grid-cols-[32px_1fr_120px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={
                            checked
                          }
                          onChange={() =>
                            toggle(p)
                          }
                        />

                        <div>
                          <p className="font-semibold text-[#10274d]">
                            {
                              p.nombre
                            }
                          </p>

                          <p className="text-xs text-slate-500">
                            {
                              p.inventario
                            }{' '}
                            ·{' '}
                            {
                              p.categoria
                            }{' '}
                            · Stock{' '}
                            {
                              p.stock
                            }
                          </p>
                        </div>

                        <input
                          type="number"
                          min="0.001"
                          max={
                            p.stock
                          }
                          step="0.001"
                          disabled={
                            !checked
                          }
                          value={
                            checked
                              ? seleccionados[
                                  p
                                    .registroId
                                ]
                              : ''
                          }
                          onChange={(e) =>
                            setSeleccionados(
                              (
                                s,
                              ) => ({
                                ...s,
                                [p.registroId]:
                                  Number(
                                    e
                                      .target
                                      .value,
                                  ),
                              }),
                            )
                          }
                          className="rounded-lg border border-slate-200 px-2 py-2"
                        />
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {tipo ===
            'MOVIMIENTO' && (
            <select
              value={
                movimientoId
              }
              onChange={(e) =>
                setMovimientoId(
                  e.target.value,
                )
              }
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              <option value="">
                Selecciona movimiento
              </option>

              {movimientos.map(
                (m: any) => (
                  <option
                    key={m.id}
                    value={m.id}
                  >
                    {m.tipo} · Producto #
                    {
                      m.registroEntidadId
                    }{' '}
                    ·{' '}
                    {Number(
                      m.cantidad,
                    )}
                  </option>
                ),
              )}
            </select>
          )}

          {tipo ===
            'VENTA' && (
            <div className="mt-5">
              <select
                value={
                  facturaId
                }
                onChange={(e) =>
                  setFacturaId(
                    e.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
              >
                <option value="">
                  Selecciona factura / venta
                </option>

                {facturas.map(
                  (f: any) => (
                    <option
                      key={f.id}
                      value={f.id}
                    >
                      {f.numeroFactura ??
                        `Factura #${f.id}`}{' '}
                      ·{' '}
                      {
                        f.clienteNombre
                      }{' '}
                      ·{' '}
                      {f.estado}
                    </option>
                  ),
                )}
              </select>

            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-[#10274d]">
            2. Destinatario y firma
          </h2>

          <fieldset className="mt-4 min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-medium text-slate-700">Método de firma</legend>
            {[
              ['CODIGO', 'Código de verificación de 6 dígitos'],
              ['CODIGO_GRAFICA', 'Código + firma dibujada o subida'],
              ['CODIGO_FACIAL', 'Código + captura facial'],
              ['FACIAL', 'Solo captura facial'],
            ].map(([valor, nombre]) => (
              <label key={valor} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm has-[:disabled]:text-slate-500">
                <input type="radio" name="metodoFirma" value={valor} checked={metodoFirma === valor}
                  disabled={valor.includes('FACIAL') && !metodosFirma?.facial}
                  onChange={() => setMetodoFirma(valor)} />
                {nombre}
              </label>
            ))}
          </fieldset>
          {!metodosFirma && <p role="status" className="mt-2 text-xs text-slate-600">Comprobando disponibilidad de la cámara para firma…</p>}
          {metodosFirma?.motivo && <p className="mt-2 text-xs text-slate-600">
            {metodosFirma.motivo === 'ROL' ? 'Solo los administradores pueden iniciar una firma facial.' :
              metodosFirma.motivo === 'VERIFICADOR_NO_DISPONIBLE' ? 'El verificador facial no responde. Revisa el servicio y su conexión con el backend.' :
                'La firma facial todavía no está configurada en el backend.'}
          </p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(
              [
                'INTERNO',
                'CLIENTE',
                'PROVEEDOR',
                'OTRO',
              ] as Uso[]
            ).map(
              (u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setUso(u);
                    setContactoId(
                      '',
                    );
                  }}
                  className={`rounded-xl border p-3 text-sm font-semibold ${
                    uso === u
                      ? 'border-[#254a7e] bg-[#fbf8ff] text-[#254a7e]'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {u}
                </button>
              ),
            )}
          </div>

          {(
            uso ===
              'CLIENTE' ||
            uso ===
              'PROVEEDOR'
          ) && (
            <select
              value={
                contactoId
              }
              onChange={(e) => {
                setContactoId(e.target.value);
              }}
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              <option value="">
                Selecciona{' '}
                {uso ===
                'CLIENTE'
                  ? 'cliente'
                  : 'proveedor'}
              </option>

              {contactos.map(
                (c: any) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {
                      c.nombreRazonSocial
                    }{' '}
                    ·{' '}
                    {
                      c.numeroIdentificacion
                    }{' '}
                    ·{' '}
                    {c.correo ??
                      'sin correo'}
                  </option>
                ),
              )}
            </select>
          )}

          {uso ===
            'OTRO' && (
            <div className="mt-4 grid gap-3">
              <input
                type="email"
                value={
                  correoOtro
                }
                onChange={(e) =>
                  setCorreoOtro(
                    e.target.value,
                  )
                }
                placeholder="Correo destinatario"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={
                  nombreOtro
                }
                onChange={(e) =>
                  setNombreOtro(
                    e.target.value,
                  )
                }
                placeholder="Nombre completo esperado"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />

              <input
                value={
                  documentoOtro
                }
                onChange={(e) =>
                  setDocumentoOtro(
                    e.target.value,
                  )
                }
                placeholder="Cédula / identificación esperada"
                className="rounded-xl border border-slate-200 px-4 py-3"
              />
            </div>
          )}

          <textarea
            rows={4}
            value={
              observacion
            }
            onChange={(e) =>
              setObservacion(
                e.target.value,
              )
            }
            placeholder="Mensaje u observación para el destinatario"
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
          />


          <button
            type="button"
            onClick={() =>
              crear.mutate()
            }
            disabled={
              !origenValido ||
              !destinoValido ||
              crear.isPending
            }
            className="mt-5 w-full rounded-xl bg-[#254a7e] px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {crear.isPending
              ? 'Enviando...'
              : 'Enviar documento para firma'}
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-[#10274d]">
          Historial
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="pb-3">
                  Solicitud
                </th>
                <th className="pb-3">
                  Tipo
                </th>
                <th className="pb-3">
                  Destinatario
                </th>
                <th className="pb-3">
                  Fecha
                </th>
                <th className="pb-3">
                  Estado
                </th>
                <th className="pb-3">
                  Certificado
                </th>
              </tr>
            </thead>

            <tbody>
              {solicitudes.map(
                (s: any) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100"
                  >
                    <td className="py-3 font-semibold">
                      #{s.id}
                      {s.estado === 'PENDIENTE' && s.tokenPublico && new Date(s.fechaVencimiento).getTime() > Date.now() && (
                        <button type="button" disabled={reenviar.isPending} onClick={() => reenviar.mutate(s.id)}
                          className="mt-1 block rounded-lg border border-slate-200 px-2 py-2 text-left text-xs text-[#254a7e] disabled:opacity-50">
                          {reenviar.isPending && reenviar.variables === s.id ? 'Reenviando…' : 'Reenviar solicitud'}
                        </button>
                      )}
                    </td>

                    <td className="py-3">
                      {s.tipoCertificacion ??
                        s.contenido
                          ?.tipo ??
                        'LEGADO'}
                    </td>

                    <td className="py-3">
                      {
                        s.identificadorDestinatario
                      }
                    </td>

                    <td className="py-3">
                      {new Date(
                        s.fechaCreacion,
                      ).toLocaleDateString(
                        'es-CO',
                      )}
                    </td>

                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.estado ===
                          'APROBADO'
                            ? 'bg-emerald-50 text-emerald-700'
                            : s.estado ===
                                'VENCIDO'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {s.estado}
                      </span>
                    </td>

                    <td className="py-3">
                      {s.documentoCertificado ? (
                        <div className="flex gap-2">
                          <a
                            href={`${API_BASE_URL}/certificacion/certificado/${s.documentoCertificado.codigoVerificacion ?? s.documentoCertificado.codigoQr}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e]"
                          >
                            Ver PDF
                          </a>

                          <a
                            href={`${API_BASE_URL}/certificacion/certificado/${s.documentoCertificado.codigoVerificacion ?? s.documentoCertificado.codigoQr}/descargar`}
                            className="rounded-lg bg-[#254a7e] px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Descargar
                          </a>

                          {(usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPER_ADMIN') &&
                            ['FACIAL', 'CODIGO_FACIAL'].includes(s.contenido?.metodoFirma) && (
                              <button type="button" onClick={() => { void descargarPdfInterno(s.documentoCertificado.codigoVerificacion ?? s.documentoCertificado.codigoQr); }}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e]">
                                PDF interno con foto
                              </button>
                            )}
                          <a
                            href={`${window.location.origin}/verificar-certificado/${s.documentoCertificado.codigoVerificacion ?? s.documentoCertificado.codigoQr}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[#254a7e] px-3 py-1.5 text-xs font-semibold text-[#254a7e]"
                          >
                            Verificar
                          </a>
                          <a
                            href={`${API_BASE_URL}/certificacion/certificado/${s.documentoCertificado.codigoVerificacion ?? s.documentoCertificado.codigoQr}/qr.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e]"
                          >
                            Ver QR
                          </a>
                          {s.estado === 'APROBADO' && tienePermiso(usuario, 'NOTIFICACIONES_VER') &&
                            tienePermiso(usuario, 'NOTIFICACIONES_ENVIAR') && (
                              <Link
                                to={`/notificaciones?certificado=${encodeURIComponent(s.documentoCertificado.codigoVerificacion ?? s.documentoCertificado.codigoQr)}`}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e]"
                              >
                                Enviar por correo
                              </Link>
                            )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Pendiente de firma
                        </span>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function etiquetaTipo(
  tipo: Tipo,
) {
  return tipo ===
    'INVENTARIO'
    ? 'Inventario completo'
    : tipo ===
        'CATEGORIA'
      ? 'Categoría'
      : tipo ===
          'PRODUCTO'
        ? 'Productos'
        : tipo ===
            'MOVIMIENTO'
          ? 'Movimiento'
          : 'Venta / Factura';
}
