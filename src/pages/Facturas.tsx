import {
  useMemo,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';
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
  cantidadPrincipal: number;
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
  stockPrincipal: number;
  bodegaId?: number;
  loteId?: number;
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
    refetchInterval: 5_000,
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
          cantidadPrincipal: Number(producto.cantidadPrincipal ?? producto.cantidad ?? 0),
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
    refetchInterval: 5_000,
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

  const usuario = useAuthStore(s => s.usuario);
  const anularPagoWompi = useMutation({
    mutationFn: async ({ facturaId, pagoId }: { facturaId: number; pagoId: number }) =>
      (await api.post<{ anulado: boolean }>(`/pagos/wompi/facturas/${facturaId}/pagos/${pagoId}/anular`)).data,
    onSuccess: async ({ anulado }) => {
      void queryClient.invalidateQueries();
      if (anulado) await feedback.exito('Pago de prueba anulado', 'Ya puedes anular la factura si no tiene otros pagos aprobados.');
      else await feedback.toast('info', 'Wompi aún no confirma la anulación. Revisa el estado del pago antes de repetir.');
    },
    onError: async error => {
      const mensaje = isAxiosError(error) ? error.response?.data?.message : undefined;
      await feedback.error('No se pudo anular el pago', typeof mensaje === 'string' ? mensaje : 'Revisa el estado en Wompi Sandbox.');
    },
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
                bodegaId: item.bodegaId,
                loteId: item.loteId,
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

      setFacturaLinkPago({ ...detalle, saldoPendiente: String(checkout.saldoCobrado ?? detalle.saldoPendiente) });
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

  const construirMensajePago = (factura: Factura) => {
    const numero = factura.numeroFactura ?? `#${factura.id}`;
    return `Sertiva · ${numero} · Saldo: ${moneda(Number(factura.saldoPendiente))}. Paga aquí: ${checkoutUrlPago}`;
  };

  const descargarFacturaPdf = (factura: Factura) =>
    descargarPdf(`/pagos/factura/${factura.id}/pdf`, `factura-${factura.id}.pdf`);

  const descargarPdf = async (ruta: string, nombre: string) => {
    try {
      const { data } = await api.get<Blob>(ruta, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      await feedback.error('No se pudo descargar el PDF');
    }
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

        if (canalPago === 'CORREO') {
          await api.post(`/pagos/checkout/${facturaLinkPago.id}/correo`, { correo: destinatario });
        } else {
          await api.post('/notificaciones/enviar-canal', {
            canal: canalPago,
            destinatario,
            nombreDestinatario: facturaLinkPago.clienteNombre,
            mensaje: construirMensajePago(facturaLinkPago),
          });
        }

        await feedback.exito('Solicitud de pago enviada', `El enlace se envió a ${destinatario}.`);
        cerrarLinkPago();
        await queryClient.invalidateQueries({ queryKey: ['notificaciones-historial'] });
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
        stockDisponible: producto.cantidadPrincipal,
        stockPrincipal: producto.cantidadPrincipal,
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
          <h1 className="text-3xl font-semibold text-[#10274d]">
            Facturación
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            setMostrarNueva(true)
          }
          className="rounded-xl bg-[#254a7e] px-5 py-3 text-sm font-semibold text-white shadow-sm"
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
          <h2 className="font-semibold text-[#10274d]">
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
                      <td className="px-4 py-3 font-semibold text-[#10274d]">
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
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#254a7e] disabled:opacity-50"
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
                              <p className="text-sm font-semibold text-[#10274d]">
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
                              <p className="text-sm font-semibold text-[#10274d]">
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
                                Disponible total:{' '}
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
                              <p className="font-semibold text-[#10274d]">
                                {
                                  item.nombre
                                }
                              </p>
                              <OrigenVenta item={item} onChange={(cambios) => actualizarItem(item.registroId, cambios)} />
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={0.001}
                                step={0.001}
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
                  <p className="mt-2 text-3xl font-semibold text-[#10274d]">
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
                  className="rounded-xl bg-[#254a7e] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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

            <button type="button" onClick={() => { void descargarFacturaPdf(detalleFactura); }}
              className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-ink">
              Descargar PDF
            </button>

            <h3 className="mt-6 font-semibold text-[#10274d]">
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
                          {item.bodegaNombre && <p className="text-xs text-slate-500">{item.bodegaNombre} · {item.loteCodigo ?? 'Sin lote'}</p>}
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

            <h3 className="mt-6 font-semibold text-[#10274d]">
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
                      <div className="text-right">
                      <p className="font-semibold">
                        {moneda(
                          Number(
                            pago.monto,
                          ),
                        )}
                      </p>
                      {pago.medioPago === 'WOMPI_SANDBOX' && ['APROBADO', 'ANULADO'].includes(pago.estadoTransaccion) && (
                        <button type="button"
                          className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-blue-800"
                          onClick={() => descargarPdf(
                            `/pagos/factura/${detalleFactura.id}/pagos/${pago.id}/comprobante`,
                            `comprobante-pago-${pago.id}.pdf`,
                          )}>
                          Descargar comprobante
                        </button>
                      )}
                      {pago.medioPago === 'WOMPI_SANDBOX' && pago.estadoTransaccion === 'APROBADO' &&
                        tienePermiso(usuario, 'FACTURAS_ANULAR') && (
                          <button type="button" disabled={anularPagoWompi.isPending}
                            className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                            onClick={async () => {
                              const confirmacion = await feedback.confirmar('¿Anular el pago de prueba?', 'Wompi debe confirmar la anulación de la transacción de tarjeta.', 'Anular pago');
                              if (confirmacion.isConfirmed) {
                                anularPagoWompi.mutate({ facturaId: detalleFactura.id, pagoId: pago.id });
                              }
                            }}>
                            Anular pago de prueba
                          </button>
                      )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </Modal>
        )}

      {facturaLinkPago && (
        <Modal title="Enviar enlace de pago" onClose={cerrarLinkPago}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#edf3fa] p-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">{facturaLinkPago.numeroFactura ?? `Factura #${facturaLinkPago.id}`}</h3>
                <p className="break-words text-sm text-slate-600">{facturaLinkPago.clienteNombre}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Saldo a pagar</p>
                <p className="text-xl font-bold text-ink">{moneda(Number(facturaLinkPago.saldoPendiente))}</p>
              </div>
            </div>

            <label className="block text-sm font-semibold text-ink">
              {checkoutUrlPago.startsWith('https://checkout.wompi.co/') && <span className="mb-2 block text-sm text-indigo-800">Wompi Sandbox · pago sin dinero real</span>}
              Canal de envío
              <select value={canalPago} onChange={e => setCanalPago(e.target.value as typeof canalPago)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="CORREO">Correo</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
            </label>

            {canalPago === 'CORREO' ? (
              <label className="block text-sm font-semibold text-ink">
                Correo del destinatario
                <input type="email" autoComplete="email" placeholder="correo@dominio.com"
                  value={usarCorreoRegistrado ? facturaLinkPago.cliente?.correo ?? '' : correoAlternativoPago}
                  onChange={e => { setUsarCorreoRegistrado(false); setCorreoAlternativoPago(e.target.value); }}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
                <span className="mt-1 block text-xs font-normal text-slate-600">El PDF se enviará a este correo cuando se confirme el pago total.</span>
              </label>
            ) : (
              <p className="text-sm text-slate-600">Teléfono del cliente · {facturaLinkPago.cliente?.telefono || 'Sin teléfono registrado'}</p>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              {checkoutUrlPago && <a href={checkoutUrlPago} target="_blank" rel="noreferrer"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-ink">Abrir enlace</a>}
              <button type="button" onClick={enviarSolicitudPago} disabled={enviandoSolicitudPago || !checkoutUrlPago}
                className="rounded-xl bg-[#254a7e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {enviandoSolicitudPago ? 'Enviando…' : 'Enviar enlace'}
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
              className="rounded-xl bg-[#254a7e] px-5 py-2.5 font-semibold text-white"
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
      <p className="mt-2 text-2xl font-semibold text-[#10274d]">
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
        role="dialog" aria-modal="true" aria-label={title}
        className={`max-h-[92dvh] w-full ${size} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-[#10274d]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
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
      <p className="mt-1 font-semibold text-[#10274d]">
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
        <p className="font-semibold text-[#10274d]">
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
        className="text-xs font-semibold text-[#254a7e]"
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value || 0),
  );
}

function OrigenVenta({ item, onChange }: { item: ItemBorrador; onChange: (cambios: Partial<ItemBorrador>) => void }) {
  type Origen = { bodegaId: number; loteId: number; bodegaNombre: string; loteCodigo: string | null; cantidad: string };
  const opciones = useQuery({
    queryKey: ['origenes-factura', item.registroId],
    queryFn: async () => (await api.get<Origen[]>(`/facturas-integradas/origenes/${item.registroId}`)).data,
  });
  const clave = (origen: Origen) => `${origen.bodegaId}:${origen.loteId}`;
  return <label className="mt-1 block min-w-52 text-xs text-slate-600">
    Bodega y lote
    <select
      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5"
      value={item.bodegaId ? `${item.bodegaId}:${item.loteId ?? 0}` : ''}
      onChange={(evento) => {
        const origen = opciones.data?.find((opcion) => clave(opcion) === evento.target.value);
        onChange({ bodegaId: origen?.bodegaId, loteId: origen?.loteId, stockDisponible: origen ? Number(origen.cantidad) : item.stockPrincipal });
      }}
    >
      <option value="">Principal sin lote · {item.stockPrincipal} disp.</option>
      {item.bodegaId && !opciones.data?.some((origen) => clave(origen) === `${item.bodegaId}:${item.loteId ?? 0}`) &&
        <option value={`${item.bodegaId}:${item.loteId ?? 0}`}>Origen seleccionado</option>}
      {opciones.data?.map((origen) => <option key={clave(origen)} value={clave(origen)}>
        {origen.bodegaNombre} · {origen.loteCodigo ?? 'Sin lote'} · {origen.cantidad} disp.
      </option>)}
    </select>
    {opciones.isPending && <span className="mt-1 block">Consultando existencias…</span>}
    {opciones.isError && <span className="mt-1 block text-red-700">No se pudieron consultar las bodegas. <button type="button" onClick={() => void opciones.refetch()} className="underline">Reintentar</button></span>}
  </label>;
}
