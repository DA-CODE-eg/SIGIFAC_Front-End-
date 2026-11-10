import {
  useMemo,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';

interface Cliente {
  id: number;
  nombreRazonSocial: string;
  numeroIdentificacion: string;
  correo?: string | null;
  telefono?: string | null;
  activo: boolean;
  tipo: string;
}

interface ProductoInventario {
  id: number;
  registroId: number;
  nombre: string;
  referencia: string;
  cantidad: number;
  precio: number;
  inventario: string;
  categoria: string;
  activo: boolean;
  source: string;
}

interface ItemBorrador {
  registroId: number;
  nombre: string;
  referencia: string;
  inventario: string;
  categoria: string;
  stockDisponible: number;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  impuestoPorcentaje: number;
}

interface Factura {
  id: number;
  numeroFactura?: string | null;
  clienteNombre: string;
  clienteIdentificador: string;
  valorTotal: string;
  saldoPendiente: string;
  estado: string;
  fechaEmision: string;
  fechaVencimiento?: string | null;
  observaciones?: string | null;
  cliente?: Cliente | null;
  items?: any[];
  pagos?: any[];
}

export default function Facturas() {
  const queryClient = useQueryClient();

  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] =
    useState('TODOS');

  const [mostrarNueva, setMostrarNueva] =
    useState(false);

  const [clienteId, setClienteId] =
    useState('');
  const [
    buscarCliente,
    setBuscarCliente,
  ] = useState('');

  const [
    buscarProducto,
    setBuscarProducto,
  ] = useState('');

  const [
    fechaVencimiento,
    setFechaVencimiento,
  ] = useState('');

  const [
    observaciones,
    setObservaciones,
  ] = useState('');

  const [items, setItems] = useState<
    ItemBorrador[]
  >([]);

  const [
    facturaDetalleId,
    setFacturaDetalleId,
  ] = useState<number | null>(null);

  const [facturaPago, setFacturaPago] =
    useState<Factura | null>(null);

  const [
    facturaLinkPago,
    setFacturaLinkPago,
  ] = useState<Factura | null>(null);

  const [
    checkoutUrlPago,
    setCheckoutUrlPago,
  ] = useState('');

  const [
    canalPago,
    setCanalPago,
  ] = useState<'CORREO' | 'WHATSAPP' | 'SMS'>(
    'CORREO',
  );

  const [
    usarCorreoRegistrado,
    setUsarCorreoRegistrado,
  ] = useState(true);

  const [
    correoAlternativoPago,
    setCorreoAlternativoPago,
  ] = useState('');

  const [
    cargandoLinkPago,
    setCargandoLinkPago,
  ] = useState(false);

  const [
    enviandoSolicitudPago,
    setEnviandoSolicitudPago,
  ] = useState(false);

  const [montoPago, setMontoPago] =
    useState('');
  const [medioPago, setMedioPago] =
    useState('TRANSFERENCIA');
  const [referenciaPago, setReferenciaPago] =
    useState('');
  const [
    observacionPago,
    setObservacionPago,
  ] = useState('');

  const [facturaAnular, setFacturaAnular] =
    useState<Factura | null>(null);
  const [
    motivoAnulacion,
    setMotivoAnulacion,
  ] = useState('');

  const {
    data: facturas = [],
    isLoading: cargandoFacturas,
  } = useQuery<Factura[]>({
    queryKey: ['facturas-integradas'],
    queryFn: async () =>
      (
        await api.get(
          '/facturas-integradas',
        )
      ).data,
  });

  const { data: clientes = [] } =
    useQuery<Cliente[]>({
      queryKey: [
        'clientes-facturacion',
        buscarCliente,
      ],
      queryFn: async () =>
        (
          await api.get('/contactos', {
            params: {
              tipo: 'CLIENTE',
              ...(buscarCliente.trim()
                ? {
                    buscar:
                      buscarCliente.trim(),
                  }
                : {}),
            },
          })
        ).data,
      enabled: mostrarNueva,
    });

  const {
    data: productosCatalogo = [],
  } = useQuery<any[]>({
    queryKey: [
      'productos-facturacion',
      buscarProducto,
    ],
    queryFn: async () =>
      (
        await api.get(
          '/inventarios/catalogo/productos',
          {
            params:
              buscarProducto.trim()
                ? {
                    buscar:
                      buscarProducto.trim(),
                  }
                : {},
          },
        )
      ).data,
    enabled: mostrarNueva,
  });

  const productosDisponibles =
    useMemo<ProductoInventario[]>(() => {
      return (
        Array.isArray(productosCatalogo)
          ? productosCatalogo
          : []
      )
        .filter(
          (producto: any) =>
            producto.source ===
              'REGISTRO_ENTIDAD' &&
            producto.activo !== false &&
            Number(
              producto.cantidad ?? 0,
            ) > 0,
        )
        .map((producto: any) => ({
          id: Number(producto.id),
          registroId: Number(
            producto.registroId ??
              producto.id,
          ),
          nombre: String(
            producto.nombre ??
              `Producto #${producto.id}`,
          ),
          referencia: String(
            producto.referencia ?? '',
          ),
          cantidad: Number(
            producto.cantidad ?? 0,
          ),
          precio: Number(
            producto.precio ?? 0,
          ),
          inventario: String(
            producto.inventario ?? '',
          ),
          categoria: String(
            producto.categoria ?? '',
          ),
          activo:
            producto.activo !== false,
          source: String(
            producto.source,
          ),
        }));
    }, [productosCatalogo]);

  const {
    data: detalleFactura,
  } = useQuery<any>({
    queryKey: [
      'factura-detalle',
      facturaDetalleId,
    ],
    queryFn: async () =>
      (
        await api.get(
          `/facturas-integradas/${facturaDetalleId}`,
        )
      ).data,
    enabled:
      facturaDetalleId !== null,
  });

  const crearFactura = useMutation({
    mutationFn: async () =>
      (
        await api.post(
          '/facturas-integradas',
          {
            contactoId: Number(clienteId),
            fechaVencimiento:
              fechaVencimiento ||
              undefined,
            observaciones:
              observaciones ||
              undefined,
            items: items.map(
              (item) => ({
                registroId:
                  item.registroId,
                cantidad:
                  item.cantidad,
                precioUnitario:
                  item.precioUnitario,
                descuento:
                  item.descuento,
                impuestoPorcentaje:
                  item.impuestoPorcentaje,
              }),
            ),
          },
        )
      ).data,

    onSuccess: async (factura) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'facturas-integradas',
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'productos-globales',
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'productos-facturacion',
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            'dashboard-resumen-fase3',
          ],
        }),
      ]);

      limpiarFactura();
      setMostrarNueva(false);

      await feedback.exito(
        'Factura creada',
        `${
          factura.numeroFactura ??
          `Factura #${factura.id}`
        } fue creada y el inventario se descontó automáticamente.`,
      );
    },
  });

  const registrarPago =
    useMutation({
      mutationFn: async () =>
        (
          await api.post(
            `/pagos/manual/${facturaPago!.id}`,
            {
              monto: Number(montoPago),
              medioPago,
              referencia:
                referenciaPago ||
                undefined,
              observacion:
                observacionPago ||
                undefined,
            },
          )
        ).data,

      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              'facturas-integradas',
            ],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'dashboard-resumen-fase3',
            ],
          }),
        ]);

        setFacturaPago(null);
        setMontoPago('');
        setReferenciaPago('');
        setObservacionPago('');

        await feedback.exito(
          'Pago registrado',
          'El saldo y el estado de la factura fueron actualizados.',
        );
      },
    });

  const anularFactura =
    useMutation({
      mutationFn: async () =>
        (
          await api.patch(
            `/facturas-integradas/${facturaAnular!.id}/anular`,
            {
              motivo:
                motivoAnulacion ||
                undefined,
            },
          )
        ).data,

      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              'facturas-integradas',
            ],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'productos-globales',
            ],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              'dashboard-resumen-fase3',
            ],
          }),
        ]);

        setFacturaAnular(null);
        setMotivoAnulacion('');

        await feedback.exito(
          'Factura anulada',
          'Las unidades fueron reintegradas al inventario.',
        );
      },
    });

  const generarLinkPago = async (
    factura: Factura,
  ) => {
    try {
      setCargandoLinkPago(true);

      const [{ data: detalle }, { data: checkout }] =
        await Promise.all([
          api.get(
            `/facturas-integradas/${factura.id}`,
          ),
          api.post(
            `/pagos/checkout/${factura.id}`,
          ),
        ]);

      setFacturaLinkPago(detalle);
      setCheckoutUrlPago(
        checkout.checkoutUrl ?? '',
      );

      setCanalPago('CORREO');
      setUsarCorreoRegistrado(true);
      setCorreoAlternativoPago('');
    } catch (error) {
      await feedback.error(
        'No se pudo generar el link',
        'Verifica la factura e intenta nuevamente.',
      );
    } finally {
      setCargandoLinkPago(false);
    }
  };

  const cerrarLinkPago = () => {
    setFacturaLinkPago(null);
    setCheckoutUrlPago('');
    setCanalPago('CORREO');
    setUsarCorreoRegistrado(true);
    setCorreoAlternativoPago('');
  };

  const resumenPago = (
    factura: Factura | null,
  ) => {
    const lineas =
      factura?.items ?? [];

    const bruto = lineas.reduce(
      (suma: number, item: any) =>
        suma +
        Number(item.cantidad ?? 0) *
          Number(item.precioUnitario ?? 0),
      0,
    );

    const descuentos = lineas.reduce(
      (suma: number, item: any) =>
        suma +
        Number(item.descuento ?? 0),
      0,
    );

    const impuestos = lineas.reduce(
      (suma: number, item: any) =>
        suma +
        Number(item.impuesto ?? 0),
      0,
    );

    return {
      bruto,
      descuentos,
      impuestos,
      total: Number(
        factura?.valorTotal ?? 0,
      ),
      saldo: Number(
        factura?.saldoPendiente ?? 0,
      ),
    };
  };

  const construirMensajePago = (
    factura: Factura,
    canal:
      | 'CORREO'
      | 'WHATSAPP'
      | 'SMS',
  ) => {
    const numero =
      factura.numeroFactura ??
      `Factura #${factura.id}`;

    const resumen =
      resumenPago(factura);

    const productos = (
      factura.items ?? []
    ).map((item: any) => {
      const cantidad = Number(
        item.cantidad ?? 0,
      );

      const precio = Number(
        item.precioUnitario ?? 0,
      );

      const descuento = Number(
        item.descuento ?? 0,
      );

      const impuesto = Number(
        item.impuesto ?? 0,
      );

      const subtotal = Number(
        item.subtotal ?? 0,
      );

      if (canal === 'SMS') {
        return `${item.nombreProducto} x${cantidad}: ${moneda(
          subtotal,
        )}`;
      }

      return [
        `• ${item.nombreProducto}`,
        `  Cantidad: ${cantidad}`,
        `  Precio base: ${moneda(
          precio,
        )}`,
        descuento > 0
          ? `  Descuento: -${moneda(
              descuento,
            )}`
          : null,
        `  IVA / impuesto: ${moneda(
          impuesto,
        )}`,
        `  Total línea: ${moneda(
          subtotal,
        )}`,
      ]
        .filter(Boolean)
        .join('\n');
    });

    if (canal === 'SMS') {
      const saldoPlano =
        Math.round(
          Number(resumen.saldo || 0),
        ).toString();

      return [
        `Sertiva ${numero}.`,
        `Saldo ${saldoPlano} COP.`,
        `Pagar: ${checkoutUrlPago}`,
      ].join(' ');
    }

    if (canal === 'WHATSAPP') {
      return [
        `Hola ${factura.clienteNombre}.`,
        '',
        `Te compartimos la solicitud de pago de *${numero}*.`,
        '',
        '*DETALLE DE LA COMPRA*',
        '',
        ...productos,
        '',
        `Subtotal antes de descuentos e impuestos: ${moneda(
          resumen.bruto,
        )}`,
        resumen.descuentos > 0
          ? `Descuentos: -${moneda(
              resumen.descuentos,
            )}`
          : null,
        `IVA / impuestos: ${moneda(
          resumen.impuestos,
        )}`,
        `Total factura: ${moneda(
          resumen.total,
        )}`,
        `*Saldo a pagar: ${moneda(
          resumen.saldo,
        )}*`,
        '',
        'Puedes realizar el pago de forma segura aquí:',
        checkoutUrlPago,
        '',
        'Sertiva',
      ]
        .filter(
          (linea) =>
            linea !== null &&
            linea !== undefined,
        )
        .join('\n');
    }

    return [
      `Hola ${factura.clienteNombre},`,
      '',
      `Te enviamos la solicitud de pago correspondiente a ${numero}.`,
      '',
      'DETALLE DE LA COMPRA',
      '',
      ...productos,
      '',
      `Subtotal antes de descuentos e impuestos: ${moneda(
        resumen.bruto,
      )}`,
      resumen.descuentos > 0
        ? `Descuentos: -${moneda(
            resumen.descuentos,
          )}`
        : null,
      `IVA / impuestos: ${moneda(
        resumen.impuestos,
      )}`,
      `Total factura: ${moneda(
        resumen.total,
      )}`,
      `Saldo pendiente: ${moneda(
        resumen.saldo,
      )}`,
      '',
      'PAGAR AHORA:',
      checkoutUrlPago,
      '',
      'Este enlace te llevará directamente al checkout seguro de Mercado Pago.',
      '',
      'Sertiva',
    ]
      .filter(
        (linea) =>
          linea !== null &&
          linea !== undefined,
      )
      .join('\n');
  };

  const normalizarTelefono = (
    telefono?: string | null,
  ) => {
    const limpio = String(
      telefono ?? '',
    ).replace(/\D/g, '');

    if (!limpio) return '';

    if (
      limpio.length === 10 &&
      limpio.startsWith('3')
    ) {
      return `57${limpio}`;
    }

    return limpio;
  };

  const enviarSolicitudPago =
    async () => {
      if (
        !facturaLinkPago ||
        !checkoutUrlPago
      ) {
        return;
      }

      const cliente =
        facturaLinkPago.cliente;

      const telefono =
        normalizarTelefono(
          cliente?.telefono,
        );

      const correoRegistrado =
        cliente?.correo?.trim() ?? '';

      const correo =
        usarCorreoRegistrado
          ? correoRegistrado
          : correoAlternativoPago.trim();

      const mensaje =
        construirMensajePago(
          facturaLinkPago,
          canalPago,
        );

      try {
        setEnviandoSolicitudPago(true);

        let destinatario = '';

        if (canalPago === 'CORREO') {
          if (!correo) {
            await feedback.error(
              'Correo requerido',
              usarCorreoRegistrado
                ? 'El cliente no tiene un correo registrado. Escribe otro correo para continuar.'
                : 'Escribe el correo al que deseas enviar la solicitud de pago.',
            );
            return;
          }

          const correoValido =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              correo,
            );

          if (!correoValido) {
            await feedback.error(
              'Correo inválido',
              'Escribe un correo válido antes de enviar.',
            );
            return;
          }

          destinatario = correo;
        } else {
          if (!telefono) {
            await feedback.error(
              'Cliente sin teléfono',
              canalPago === 'WHATSAPP'
                ? 'Agrega un teléfono al cliente para enviar la solicitud por WhatsApp.'
                : 'Agrega un teléfono al cliente para enviar la solicitud por SMS.',
            );
            return;
          }

          destinatario =
            telefono.startsWith('+')
              ? telefono
              : `+${telefono}`;
        }

        const asunto =
          `Solicitud de pago ${
            facturaLinkPago.numeroFactura ??
            `Factura #${facturaLinkPago.id}`
          }`;

        const { data: resultado } =
          await api.post(
            '/notificaciones/enviar-canal',
            {
              canal: canalPago,
              destinatario,
              nombreDestinatario:
                facturaLinkPago.clienteNombre,
              asunto:
                canalPago === 'CORREO'
                  ? asunto
                  : undefined,
              mensaje,
            },
          );

        await feedback.exito(
          'Solicitud de pago enviada',
          canalPago === 'CORREO'
            ? `El detalle, IVA y link de pago se enviaron por correo a ${destinatario}.`
            : canalPago === 'WHATSAPP'
              ? `El detalle, IVA y link de pago se enviaron por WhatsApp a ${destinatario}.`
              : `El resumen y link de pago se enviaron por SMS a ${destinatario}.`,
        );

        if (
          resultado?.proveedorId ||
          resultado?.estado
        ) {
          await queryClient.invalidateQueries({
            queryKey: [
              'notificaciones-historial',
            ],
          });
        }
      } catch (error: any) {
        // El interceptor conserva el detalle técnico en consola.
        // Aquí mostramos únicamente un mensaje comprensible para el usuario.
        const canalTexto =
          canalPago === 'CORREO'
            ? 'correo'
            : canalPago === 'WHATSAPP'
              ? 'WhatsApp'
              : 'SMS';

        await feedback.error(
          'No se pudo enviar',
          `No se pudo enviar la solicitud de pago por ${canalTexto}. Intenta nuevamente.`,
        );
      } finally {
        setEnviandoSolicitudPago(false);
      }
    };

  const agregarProducto = (
    producto: ProductoInventario,
  ) => {
    const existente = items.find(
      (item) =>
        item.registroId ===
        producto.registroId,
    );

    if (existente) {
      feedback.toast(
        'info',
        'El producto ya está agregado a la factura',
      );
      return;
    }

    setItems((actual) => [
      ...actual,
      {
        registroId:
          producto.registroId,
        nombre: producto.nombre,
        referencia:
          producto.referencia,
        inventario:
          producto.inventario,
        categoria:
          producto.categoria,
        stockDisponible:
          producto.cantidad,
        cantidad: 1,
        precioUnitario:
          producto.precio,
        descuento: 0,
        impuestoPorcentaje: 0,
      },
    ]);
  };

  const actualizarItem = (
    registroId: number,
    cambios: Partial<ItemBorrador>,
  ) => {
    setItems((actual) =>
      actual.map((item) =>
        item.registroId ===
        registroId
          ? {
              ...item,
              ...cambios,
            }
          : item,
      ),
    );
  };

  const eliminarItem = (
    registroId: number,
  ) => {
    setItems((actual) =>
      actual.filter(
        (item) =>
          item.registroId !==
          registroId,
      ),
    );
  };

  const totalFactura = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
          totalLinea(item),
        0,
      ),
    [items],
  );

  const filtradas = useMemo(
    () =>
      facturas.filter(
        (factura) =>
          (estado === 'TODOS' ||
            factura.estado ===
              estado) &&
          `${factura.numeroFactura ?? ''} ${
            factura.clienteNombre
          } ${
            factura.clienteIdentificador
          }`
            .toLowerCase()
            .includes(
              buscar.toLowerCase(),
            ),
      ),
    [
      facturas,
      estado,
      buscar,
    ],
  );

  const cartera = facturas.reduce(
    (suma, factura) =>
      suma +
      Number(
        factura.saldoPendiente ?? 0,
      ),
    0,
  );

  const totalFacturado =
    facturas
      .filter(
        (factura) =>
          factura.estado !== 'ANULADA',
      )
      .reduce(
        (suma, factura) =>
          suma +
          Number(
            factura.valorTotal ?? 0,
          ),
        0,
      );

  const confirmarCrearFactura =
    async () => {
      if (!clienteId) {
        await feedback.info(
          'Selecciona un cliente',
          'La factura debe estar asociada a un cliente activo.',
        );
        return;
      }

      if (items.length === 0) {
        await feedback.info(
          'Agrega productos',
          'Debes incluir al menos un producto del inventario.',
        );
        return;
      }

      const invalido = items.find(
        (item) =>
          item.cantidad <= 0 ||
          item.cantidad >
            item.stockDisponible,
      );

      if (invalido) {
        await feedback.error(
          'Cantidad inválida',
          `${invalido.nombre}: disponible ${invalido.stockDisponible}.`,
        );
        return;
      }

      const respuesta =
        await feedback.confirmar(
          '¿Confirmar factura?',
          `Total: ${moneda(
            totalFactura,
          )}. Al confirmar se descontará el stock de ${items.length} producto(s).`,
          'Crear factura',
        );

      if (!respuesta.isConfirmed)
        return;

      crearFactura.mutate();
    };

  const confirmarPago =
    async () => {
      if (!facturaPago) return;

      const monto = Number(
        montoPago,
      );

      if (
        !Number.isFinite(monto) ||
        monto <= 0
      ) {
        await feedback.error(
          'Monto inválido',
          'Ingresa un valor mayor que cero.',
        );
        return;
      }

      if (
        monto >
        Number(
          facturaPago.saldoPendiente,
        )
      ) {
        await feedback.error(
          'El pago supera el saldo',
          `Saldo pendiente: ${moneda(
            Number(
              facturaPago.saldoPendiente,
            ),
          )}.`,
        );
        return;
      }

      const respuesta =
        await feedback.confirmar(
          '¿Registrar pago?',
          `${moneda(
            monto,
          )} por ${medioPago}.`,
          'Registrar pago',
        );

      if (!respuesta.isConfirmed)
        return;

      registrarPago.mutate();
    };

  const confirmarAnulacion =
    async () => {
      if (!facturaAnular)
        return;

      const respuesta =
        await feedback.confirmar(
          '¿Anular factura?',
          'Sertiva devolverá las unidades al inventario. No se puede anular una factura con pagos aprobados.',
          'Anular factura',
        );

      if (!respuesta.isConfirmed)
        return;

      anularFactura.mutate();
    };

  const limpiarFactura = () => {
    setClienteId('');
    setBuscarCliente('');
    setBuscarProducto('');
    setFechaVencimiento('');
    setObservaciones('');
    setItems([]);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#202a47]">
            Facturación
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            setMostrarNueva(true)
          }
          className="rounded-xl bg-[#284bc2] px-5 py-3 text-sm font-semibold text-white shadow-sm"
        >
          + Crear factura
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi
          label="Facturas"
          value={String(
            facturas.length,
          )}
        />
        <Kpi
          label="Pendientes"
          value={String(
            facturas.filter(
              (f) =>
                f.estado ===
                'PENDIENTE',
            ).length,
          )}
        />
        <Kpi
          label="Parciales"
          value={String(
            facturas.filter(
              (f) =>
                f.estado ===
                'PARCIAL',
            ).length,
          )}
        />
        <Kpi
          label="Facturado"
          value={moneda(
            totalFacturado,
          )}
        />
        <Kpi
          label="Cartera"
          value={moneda(cartera)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px]">
        <input
          value={buscar}
          onChange={(e) =>
            setBuscar(
              e.target.value,
            )
          }
          placeholder="Buscar factura, cliente o identificación..."
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        />

        <select
          value={estado}
          onChange={(e) =>
            setEstado(
              e.target.value,
            )
          }
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="TODOS">
            Todos los estados
          </option>
          <option value="PENDIENTE">
            Pendiente
          </option>
          <option value="PARCIAL">
            Parcial
          </option>
          <option value="PAGADA">
            Pagada
          </option>
          <option value="VENCIDA">
            Vencida
          </option>
          <option value="ANULADA">
            Anulada
          </option>
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-[#202a47]">
            Facturas
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {filtradas.length} resultado(s)
          </p>
        </div>

        {cargandoFacturas ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Cargando facturas...
          </p>
        ) : filtradas.length ===
          0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            Todavía no hay facturas con estos filtros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">
                    Factura
                  </th>
                  <th className="px-4 py-3">
                    Cliente
                  </th>
                  <th className="px-4 py-3">
                    Emisión
                  </th>
                  <th className="px-4 py-3">
                    Total
                  </th>
                  <th className="px-4 py-3">
                    Saldo
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
                {filtradas.map(
                  (factura) => (
                    <tr
                      key={factura.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3 font-semibold text-[#202a47]">
                        {factura.numeroFactura ??
                          `#${factura.id}`}
                      </td>

                      <td className="px-4 py-3">
                        <p>
                          {
                            factura.clienteNombre
                          }
                        </p>
                        <p className="text-xs text-slate-500">
                          {
                            factura.clienteIdentificador
                          }
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {new Date(
                          factura.fechaEmision,
                        ).toLocaleDateString(
                          'es-CO',
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {moneda(
                          Number(
                            factura.valorTotal,
                          ),
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {moneda(
                          Number(
                            factura.saldoPendiente ??
                              0,
                          ),
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <EstadoFactura
                          estado={
                            factura.estado
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setFacturaDetalleId(
                                factura.id,
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                          >
                            Ver detalle
                          </button>

                          {![
                            'PAGADA',
                            'ANULADA',
                          ].includes(
                            factura.estado,
                          ) && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setFacturaPago(
                                    factura,
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                              >
                                Registrar pago
                              </button>

                              <button
                                type="button"
                                disabled={cargandoLinkPago}
                                onClick={() =>
                                  generarLinkPago(
                                    factura,
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#284bc2] disabled:opacity-50"
                              >
                                {cargandoLinkPago
                                  ? 'Generando...'
                                  : 'Link de pago'}
                              </button>
                            </>
                          )}

                          {![
                            'PAGADA',
                            'ANULADA',
                          ].includes(
                            factura.estado,
                          ) && (
                            <button
                              type="button"
                              onClick={() =>
                                setFacturaAnular(
                                  factura,
                                )
                              }
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarNueva && (
        <Modal
          title="Crear factura"
          size="max-w-6xl"
          onClose={() => {
            setMostrarNueva(false);
            limpiarFactura();
          }}
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  1. Cliente
                </p>

                {clienteId ? (
                  <ClienteSeleccionado
                    cliente={
                      clientes.find(
                        (c) =>
                          String(c.id) ===
                          String(
                            clienteId,
                          ),
                      ) ?? null
                    }
                    onClear={() =>
                      setClienteId('')
                    }
                  />
                ) : (
                  <>
                    <input
                      value={
                        buscarCliente
                      }
                      onChange={(e) =>
                        setBuscarCliente(
                          e.target.value,
                        )
                      }
                      placeholder="Buscar cliente por nombre o identificación"
                      className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />

                    <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                      {clientes
                        .filter(
                          (cliente) =>
                            cliente.activo,
                        )
                        .slice(0, 20)
                        .map(
                          (cliente) => (
                            <button
                              key={
                                cliente.id
                              }
                              type="button"
                              onClick={() =>
                                setClienteId(
                                  String(
                                    cliente.id,
                                  ),
                                )
                              }
                              className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                            >
                              <p className="text-sm font-semibold text-[#202a47]">
                                {
                                  cliente.nombreRazonSocial
                                }
                              </p>
                              <p className="text-xs text-slate-500">
                                {
                                  cliente.numeroIdentificacion
                                }
                              </p>
                            </button>
                          ),
                        )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  2. Agregar productos
                </p>

                <input
                  value={
                    buscarProducto
                  }
                  onChange={(e) =>
                    setBuscarProducto(
                      e.target.value,
                    )
                  }
                  placeholder="Buscar producto, referencia, inventario..."
                  className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />

                <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                  {productosDisponibles
                    .slice(0, 40)
                    .map(
                      (producto) => (
                        <button
                          key={
                            producto.registroId
                          }
                          type="button"
                          onClick={() =>
                            agregarProducto(
                              producto,
                            )
                          }
                          className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#202a47]">
                                {
                                  producto.nombre
                                }
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {producto.inventario}{' '}
                                ·{' '}
                                {
                                  producto.categoria
                                }
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {moneda(
                                  producto.precio,
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                Stock{' '}
                                {
                                  producto.cantidad
                                }
                              </p>
                            </div>
                          </div>
                        </button>
                      ),
                    )}

                  {productosDisponibles.length ===
                    0 && (
                    <p className="p-4 text-sm text-slate-500">
                      No hay productos activos con stock disponible.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                3. Detalle de venta
              </p>

              {items.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                  Selecciona productos del inventario para construir la factura.
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-3">
                          Producto
                        </th>
                        <th className="px-3 py-3">
                          Cant.
                        </th>
                        <th className="px-3 py-3">
                          Precio
                        </th>
                        <th className="px-3 py-3">
                          Descuento
                        </th>
                        <th className="px-3 py-3">
                          Imp. %
                        </th>
                        <th className="px-3 py-3 text-right">
                          Total
                        </th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>

                    <tbody>
                      {items.map(
                        (item) => (
                          <tr
                            key={
                              item.registroId
                            }
                            className="border-t border-slate-100"
                          >
                            <td className="px-3 py-3">
                              <p className="font-semibold text-[#202a47]">
                                {
                                  item.nombre
                                }
                              </p>
                              <p className="text-xs text-slate-500">
                                Stock:{' '}
                                {
                                  item.stockDisponible
                                }{' '}
                                ·{' '}
                                {
                                  item.inventario
                                }
                              </p>
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={1}
                                max={
                                  item.stockDisponible
                                }
                                value={
                                  item.cantidad
                                }
                                onChange={(e) =>
                                  actualizarItem(
                                    item.registroId,
                                    {
                                      cantidad:
                                        Number(
                                          e
                                            .target
                                            .value,
                                        ),
                                    },
                                  )
                                }
                                className="w-20 rounded-lg border px-2 py-2"
                              />
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={0}
                                value={
                                  item.precioUnitario
                                }
                                onChange={(e) =>
                                  actualizarItem(
                                    item.registroId,
                                    {
                                      precioUnitario:
                                        Number(
                                          e
                                            .target
                                            .value,
                                        ),
                                    },
                                  )
                                }
                                className="w-28 rounded-lg border px-2 py-2"
                              />
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={0}
                                value={
                                  item.descuento
                                }
                                onChange={(e) =>
                                  actualizarItem(
                                    item.registroId,
                                    {
                                      descuento:
                                        Number(
                                          e
                                            .target
                                            .value,
                                        ),
                                    },
                                  )
                                }
                                className="w-24 rounded-lg border px-2 py-2"
                              />
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={
                                  item.impuestoPorcentaje
                                }
                                onChange={(e) =>
                                  actualizarItem(
                                    item.registroId,
                                    {
                                      impuestoPorcentaje:
                                        Number(
                                          e
                                            .target
                                            .value,
                                        ),
                                    },
                                  )
                                }
                                className="w-20 rounded-lg border px-2 py-2"
                              />
                            </td>

                            <td className="px-3 py-3 text-right font-semibold">
                              {moneda(
                                totalLinea(
                                  item,
                                ),
                              )}
                            </td>

                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  eliminarItem(
                                    item.registroId,
                                  )
                                }
                                className="text-xs font-semibold text-red-600"
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Fecha de vencimiento
                  </label>
                  <input
                    type="date"
                    value={
                      fechaVencimiento
                    }
                    onChange={(e) =>
                      setFechaVencimiento(
                        e.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                  />
                </div>

                <div className="md:row-span-2 rounded-2xl bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Total factura
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-[#202a47]">
                    {moneda(
                      totalFactura,
                    )}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Observaciones
                  </label>
                  <textarea
                    value={
                      observaciones
                    }
                    onChange={(e) =>
                      setObservaciones(
                        e.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarNueva(
                      false,
                    );
                    limpiarFactura();
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={
                    crearFactura.isPending
                  }
                  onClick={
                    confirmarCrearFactura
                  }
                  className="rounded-xl bg-[#284bc2] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {crearFactura.isPending
                    ? 'Creando...'
                    : 'Confirmar factura'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {facturaDetalleId &&
        detalleFactura && (
          <Modal
            title={
              detalleFactura.numeroFactura ??
              `Factura #${detalleFactura.id}`
            }
            size="max-w-4xl"
            onClose={() =>
              setFacturaDetalleId(
                null,
              )
            }
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Dato
                label="Cliente"
                value={
                  detalleFactura.clienteNombre
                }
              />
              <Dato
                label="Estado"
                value={
                  detalleFactura.estado
                }
              />
              <Dato
                label="Total"
                value={moneda(
                  Number(
                    detalleFactura.valorTotal,
                  ),
                )}
              />
              <Dato
                label="Saldo"
                value={moneda(
                  Number(
                    detalleFactura.saldoPendiente,
                  ),
                )}
              />
            </div>

            <h3 className="mt-6 font-semibold text-[#202a47]">
              Productos facturados
            </h3>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[750px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-3">
                      Producto
                    </th>
                    <th className="px-3 py-3">
                      Cant.
                    </th>
                    <th className="px-3 py-3">
                      Precio
                    </th>
                    <th className="px-3 py-3">
                      Descuento
                    </th>
                    <th className="px-3 py-3">
                      Impuesto
                    </th>
                    <th className="px-3 py-3">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    detalleFactura.items ??
                    []
                  ).map(
                    (item: any) => (
                      <tr
                        key={item.id}
                        className="border-t"
                      >
                        <td className="px-3 py-3">
                          {
                            item.nombreProducto
                          }
                        </td>
                        <td className="px-3 py-3">
                          {Number(
                            item.cantidad,
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {moneda(
                            Number(
                              item.precioUnitario,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {moneda(
                            Number(
                              item.descuento,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {moneda(
                            Number(
                              item.impuesto,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-3 font-semibold">
                          {moneda(
                            Number(
                              item.subtotal,
                            ),
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="mt-6 font-semibold text-[#202a47]">
              Pagos
            </h3>

            {(detalleFactura.pagos ??
              []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No hay pagos registrados.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {detalleFactura.pagos.map(
                  (pago: any) => (
                    <div
                      key={pago.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold">
                          {pago.medioPago}
                        </p>
                        <p className="text-xs text-slate-500">
                          {
                            pago.estadoTransaccion
                          }
                          {pago.referencia
                            ? ` · ${pago.referencia}`
                            : ''}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {moneda(
                          Number(
                            pago.monto,
                          ),
                        )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
          </Modal>
        )}

      {facturaLinkPago && (
        <Modal
          title="Enviar solicitud de pago"
          size="max-w-5xl"
          onClose={cerrarLinkPago}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_.75fr]">
            <div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#284bc2]">
                  Solicitud de pago
                </p>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-[#202a47]">
                      {facturaLinkPago.numeroFactura ??
                        `Factura #${facturaLinkPago.id}`}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {facturaLinkPago.clienteNombre}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500">
                      Saldo a pagar
                    </p>
                    <p className="text-2xl font-bold text-[#284bc2]">
                      {moneda(
                        Number(
                          facturaLinkPago.saldoPendiente ??
                            0,
                        ),
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="mt-6 font-semibold text-[#202a47]">
                Detalle que recibirá el cliente
              </h3>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-3">Producto</th>
                      <th className="px-3 py-3">Cant.</th>
                      <th className="px-3 py-3">Precio base</th>
                      <th className="px-3 py-3">Descuento</th>
                      <th className="px-3 py-3">IVA / impuesto</th>
                      <th className="px-3 py-3 text-right">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(facturaLinkPago.items ?? []).map(
                      (item: any) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-3">
                            <p className="font-semibold text-[#202a47]">
                              {item.nombreProducto}
                            </p>
                            {item.referencia && (
                              <p className="text-xs text-slate-500">
                                Ref. {item.referencia}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-3">
                            {Number(item.cantidad)}
                          </td>

                          <td className="px-3 py-3">
                            {moneda(
                              Number(
                                item.precioUnitario,
                              ),
                            )}
                          </td>

                          <td className="px-3 py-3">
                            {Number(
                              item.descuento ?? 0,
                            ) > 0
                              ? `-${moneda(
                                  Number(
                                    item.descuento,
                                  ),
                                )}`
                              : moneda(0)}
                          </td>

                          <td className="px-3 py-3 font-medium text-amber-700">
                            {moneda(
                              Number(
                                item.impuesto ?? 0,
                              ),
                            )}
                          </td>

                          <td className="px-3 py-3 text-right font-semibold">
                            {moneda(
                              Number(
                                item.subtotal ?? 0,
                              ),
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {(() => {
                const resumen =
                  resumenPago(
                    facturaLinkPago,
                  );

                return (
                  <div className="mt-4 ml-auto max-w-sm rounded-xl bg-slate-50 p-4">
                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-slate-500">Subtotal bruto</span>
                      <span>{moneda(resumen.bruto)}</span>
                    </div>

                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-slate-500">Descuentos</span>
                      <span>-{moneda(resumen.descuentos)}</span>
                    </div>

                    <div className="flex justify-between py-1 text-sm">
                      <span className="text-slate-500">IVA / impuestos</span>
                      <span className="font-semibold text-amber-700">
                        {moneda(resumen.impuestos)}
                      </span>
                    </div>

                    <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 font-semibold">
                      <span>Total factura</span>
                      <span>{moneda(resumen.total)}</span>
                    </div>

                    <div className="mt-2 flex justify-between rounded-lg bg-[#284bc2] px-3 py-2 font-semibold text-white">
                      <span>Saldo a pagar</span>
                      <span>{moneda(resumen.saldo)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Canal de envío
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    'CORREO',
                    'WHATSAPP',
                    'SMS',
                  ] as const
                ).map((canal) => (
                  <button
                    key={canal}
                    type="button"
                    onClick={() =>
                      setCanalPago(canal)
                    }
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold ${
                      canalPago === canal
                        ? 'border-[#284bc2] bg-blue-50 text-[#284bc2]'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {canal === 'CORREO'
                      ? 'Correo'
                      : canal === 'WHATSAPP'
                        ? 'WhatsApp'
                        : 'SMS'}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase text-slate-500">
                  Destinatario
                </p>

                <p className="mt-1 font-semibold text-[#202a47]">
                  {facturaLinkPago.clienteNombre}
                </p>

                {canalPago === 'CORREO' ? (
                  <div className="mt-2 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">
                        Correo registrado
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#202a47]">
                        {facturaLinkPago.cliente?.correo ||
                          'Sin correo registrado'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUsarCorreoRegistrado(true);
                          setCorreoAlternativoPago('');
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                          usarCorreoRegistrado
                            ? 'border-[#284bc2] bg-blue-50 text-[#284bc2]'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        Usar este correo
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setUsarCorreoRegistrado(false)
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                          !usarCorreoRegistrado
                            ? 'border-[#284bc2] bg-blue-50 text-[#284bc2]'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        Escribir otro
                      </button>
                    </div>

                    {!usarCorreoRegistrado && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">
                          Correo destinatario
                        </label>
                        <input
                          type="email"
                          value={correoAlternativoPago}
                          onChange={(e) =>
                            setCorreoAlternativoPago(
                              e.target.value,
                            )
                          }
                          placeholder="correo@dominio.com"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#284bc2]"
                        />
                        <p className="mt-1 text-[11px] leading-4 text-slate-400">
                          La solicitud se enviará únicamente a este correo.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    {facturaLinkPago.cliente?.telefono ||
                      'Sin teléfono registrado'}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase text-slate-500">
                  Vista previa del mensaje
                </p>

                <div className="mt-2 max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                  {construirMensajePago(
                    facturaLinkPago,
                    canalPago,
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                Sertiva enviará directamente el detalle de la factura, IVA, saldo y enlace seguro de Mercado Pago por el canal seleccionado.
              </div>

              <button
                type="button"
                disabled={enviandoSolicitudPago}
                onClick={enviarSolicitudPago}
                className="mt-5 w-full rounded-xl bg-[#284bc2] px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {enviandoSolicitudPago
                  ? 'Preparando envío...'
                  : canalPago === 'CORREO'
                    ? 'Enviar correo con link de pago'
                    : canalPago === 'WHATSAPP'
                      ? 'Enviar la notificación por WhatsApp'
                      : 'Enviar la notificación por SMS'}
              </button>

              <button
                type="button"
                onClick={() =>
                  window.open(
                    checkoutUrlPago,
                    '_blank',
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
              >
                Probar link de pago
              </button>
            </div>
          </div>
        </Modal>
      )}

      {facturaPago && (
        <Modal
          title="Registrar pago"
          onClose={() =>
            setFacturaPago(null)
          }
        >
          <p className="text-sm text-slate-500">
            {facturaPago.numeroFactura ??
              `Factura #${facturaPago.id}`}{' '}
            · Saldo{' '}
            {moneda(
              Number(
                facturaPago.saldoPendiente,
              ),
            )}
          </p>

          <div className="mt-5 grid gap-4">
            <Input
              label="Monto *"
              type="number"
              value={montoPago}
              onChange={setMontoPago}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Medio de pago
              </label>
              <select
                value={medioPago}
                onChange={(e) =>
                  setMedioPago(
                    e.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
              >
                <option value="TRANSFERENCIA">
                  Transferencia
                </option>
                <option value="EFECTIVO">
                  Efectivo
                </option>
                <option value="TARJETA">
                  Tarjeta
                </option>
                <option value="PSE">
                  PSE
                </option>
                <option value="OTRO">
                  Otro
                </option>
              </select>
            </div>

            <Input
              label="Referencia"
              value={referenciaPago}
              onChange={
                setReferenciaPago
              }
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Observación
              </label>
              <textarea
                value={observacionPago}
                onChange={(e) =>
                  setObservacionPago(
                    e.target.value,
                  )
                }
                className="min-h-20 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setFacturaPago(null)
              }
              className="rounded-xl border px-4 py-2.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarPago}
              disabled={
                registrarPago.isPending
              }
              className="rounded-xl bg-[#284bc2] px-5 py-2.5 font-semibold text-white"
            >
              Registrar pago
            </button>
          </div>
        </Modal>
      )}

      {facturaAnular && (
        <Modal
          title="Anular factura"
          onClose={() =>
            setFacturaAnular(null)
          }
        >
          <p className="text-sm text-slate-500">
            Al anular, las cantidades vendidas se reintegrarán al inventario.
          </p>

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium">
              Motivo de anulación
            </label>
            <textarea
              value={
                motivoAnulacion
              }
              onChange={(e) =>
                setMotivoAnulacion(
                  e.target.value,
                )
              }
              className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setFacturaAnular(null)
              }
              className="rounded-xl border px-4 py-2.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={
                confirmarAnulacion
              }
              disabled={
                anularFactura.isPending
              }
              className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white"
            >
              Anular factura
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function totalLinea(
  item: ItemBorrador,
) {
  const bruto =
    item.cantidad *
    item.precioUnitario;
  const base = Math.max(
    0,
    bruto - item.descuento,
  );
  return (
    base +
    (base *
      item.impuestoPorcentaje) /
      100
  );
}

function Kpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[#202a47]">
        {value}
      </p>
    </div>
  );
}

function EstadoFactura({
  estado,
}: {
  estado: string;
}) {
  const clases =
    estado === 'PAGADA'
      ? 'bg-emerald-50 text-emerald-700'
      : estado === 'PARCIAL'
        ? 'bg-blue-50 text-blue-700'
        : estado === 'VENCIDA'
          ? 'bg-red-50 text-red-700'
          : estado === 'ANULADA'
            ? 'bg-slate-100 text-slate-500'
            : 'bg-amber-50 text-amber-700';

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${clases}`}
    >
      {estado}
    </span>
  );
}

function Modal({
  title,
  size = 'max-w-2xl',
  children,
  onClose,
}: {
  title: string;
  size?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={`max-h-[92vh] w-full ${size} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-[#202a47]">
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
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-slate-200 px-4 py-3"
      />
    </div>
  );
}

function Dato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-[#202a47]">
        {value}
      </p>
    </div>
  );
}

function ClienteSeleccionado({
  cliente,
  onClear,
}: {
  cliente: Cliente | null;
  onClear: () => void;
}) {
  if (!cliente) return null;

  return (
    <div className="mt-3 flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div>
        <p className="font-semibold text-[#202a47]">
          {
            cliente.nombreRazonSocial
          }
        </p>
        <p className="text-xs text-slate-500">
          {
            cliente.numeroIdentificacion
          }
        </p>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="text-xs font-semibold text-[#284bc2]"
      >
        Cambiar
      </button>
    </div>
  );
}

function moneda(value: number) {
  return new Intl.NumberFormat(
    'es-CO',
    {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value || 0),
  );
}
