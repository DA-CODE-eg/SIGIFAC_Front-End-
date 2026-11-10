import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../api/client';
import { useSearchParams } from 'react-router-dom';
import { feedback } from '../lib/feedback';

type RolContacto =
  | 'CLIENTE'
  | 'PROVEEDOR';

interface Contacto {
  id: number;
  nombreRazonSocial: string;
  correo: string | null;
  telefono?: string | null;
  tipo:
    | 'CLIENTE'
    | 'PROVEEDOR'
    | 'AMBOS';
  activo: boolean;
}

interface CertificadoDisponible {
  id: number;
  solicitudId: number;
  codigo: string;
  tipo: string;
  fechaCertificacion: string;
  destinatarioOriginal: string;
  contacto?: {
    id: number;
    nombre: string;
    correo?: string | null;
    identificacion?: string | null;
  } | null;
  firmante?: {
    nombre: string;
    identificacion: string;
  } | null;
  titulo: string;
  elementos: number;
  valor: number;
}

export default function Notificaciones() {
  const [parametros] = useSearchParams();
  const certificadoInicial = parametros.get('certificado') ?? '';
  const queryClient =
    useQueryClient();

  const [tab, setTab] =
    useState<
      | 'MENSAJE'
      | 'ENVIAR'
      | 'ALERTAS'
    >(certificadoInicial ? 'ENVIAR' : 'MENSAJE');

  const [
    tipoContacto,
    setTipoContacto,
  ] =
    useState<RolContacto>(
      'CLIENTE',
    );

  const [
    modoDestinatario,
    setModoDestinatario,
  ] = useState<
    'BUSCAR' | 'MANUAL'
  >('BUSCAR');

  const [
    busquedaContacto,
    setBusquedaContacto,
  ] = useState('');

  const [
    contactoSeleccionado,
    setContactoSeleccionado,
  ] =
    useState<Contacto | null>(
      null,
    );

  const [
    mostrarSugerencias,
    setMostrarSugerencias,
  ] = useState(false);

  const [
    destinatarioManual,
    setDestinatarioManual,
  ] = useState('');

  const [
    nombreManual,
    setNombreManual,
  ] = useState('');

  const [
    certificadoCodigo,
    setCertificadoCodigo,
  ] = useState(certificadoInicial);

  const [
    canalCertificado,
    setCanalCertificado,
  ] = useState<
    'CORREO' | 'WHATSAPP' | 'SMS'
  >('CORREO');

  const [asunto, setAsunto] =
    useState('');

  const [mensaje, setMensaje] =
    useState(
      'Te enviamos nuevamente el certificado firmado correspondiente al proceso que completaste. Puedes visualizarlo, descargarlo y verificar su autenticidad mediante el código QR o el enlace de verificación incluidos en este mensaje.',
    );

  const [
    asuntoMensaje,
    setAsuntoMensaje,
  ] = useState('');

  const [
    cuerpoMensaje,
    setCuerpoMensaje,
  ] = useState('');

  const [
    canalMensaje,
    setCanalMensaje,
  ] = useState<
    'CORREO' | 'WHATSAPP' | 'SMS'
  >('CORREO');

  const [
    destinatarioMensajeManual,
    setDestinatarioMensajeManual,
  ] = useState('');

  const [
    nombreMensajeManual,
    setNombreMensajeManual,
  ] = useState('');


  const [
    terminoDebounced,
    setTerminoDebounced,
  ] = useState('');

  const cajaBusquedaRef =
    useRef<HTMLDivElement>(
      null,
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          setTerminoDebounced(
            busquedaContacto,
          ),
        250,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [busquedaContacto]);

  useEffect(() => {
    const fuera = (
      event: MouseEvent,
    ) => {
      if (
        cajaBusquedaRef.current &&
        !cajaBusquedaRef.current.contains(
          event.target as Node,
        )
      ) {
        setMostrarSugerencias(
          false,
        );
      }
    };

    document.addEventListener(
      'mousedown',
      fuera,
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        fuera,
      );
  }, []);

  const {
    data: certificados = [],
    isLoading:
      cargandoCertificados,
  } =
    useQuery<
      CertificadoDisponible[]
    >({
      queryKey: [
        'certificados-disponibles-notificaciones',
      ],
      queryFn:
        async () =>
          (
            await api.get(
              '/notificaciones/certificados-disponibles',
            )
          ).data,
    });

  const {
    data: contactos = [],
    isFetching:
      buscandoContactos,
  } =
    useQuery<Contacto[]>({
      queryKey: [
        'contactos-notificaciones',
        tipoContacto,
        terminoDebounced,
      ],
      queryFn:
        async () =>
          (
            await api.get(
              '/contactos',
              {
                params: {
                  tipo:
                    tipoContacto,
                  ...(terminoDebounced
                    ? {
                        buscar:
                          terminoDebounced,
                      }
                    : {}),
                },
              },
            )
          ).data,
      enabled:
        modoDestinatario ===
        'BUSCAR',
    });

  const {
    data: historial = [],
  } = useQuery<any[]>({
    queryKey: [
      'notificaciones-historial',
    ],
    queryFn:
      async () =>
        (
          await api.get(
            '/notificaciones',
          )
        ).data,
  });

  const certificado =
    useMemo(
      () =>
        certificados.find(
          (item) =>
            item.codigo ===
            certificadoCodigo,
        ) ?? null,
      [
        certificados,
        certificadoCodigo,
      ],
    );

  const destinatario =
    modoDestinatario ===
    'BUSCAR'
      ? canalCertificado ===
        'CORREO'
        ? contactoSeleccionado
            ?.correo ?? ''
        : contactoSeleccionado
            ?.telefono ?? ''
      : destinatarioManual;

  const nombreDestinatario =
    modoDestinatario ===
    'BUSCAR'
      ? contactoSeleccionado
          ?.nombreRazonSocial ??
        ''
      : nombreManual;

  const enviar =
    useMutation({
      mutationFn:
        async () =>
          (
            await api.post(
              '/notificaciones/reenviar-certificado',
              {
                codigoCertificado:
                  certificadoCodigo,
                canal:
                  canalCertificado,
                destinatario,
                nombreDestinatario:
                  nombreDestinatario ||
                  undefined,
                asunto:
                  asunto ||
                  undefined,
                mensaje,
              },
            )
          ).data,

      onSuccess:
        async (resultado) => {
          await Promise.all([
            queryClient.invalidateQueries(
              {
                queryKey: [
                  'notificaciones-historial',
                ],
              },
            ),
            queryClient.invalidateQueries(
              {
                queryKey: [
                  'dashboard-resumen-fase3',
                ],
              },
            ),
          ]);

          await feedback.exito(
            'Certificado enviado',
            `El certificado ${resultado.codigo} fue enviado por ${resultado.canal} a ${resultado.destinatario}.`,
          );

          setCertificadoCodigo(
            '',
          );
          setContactoSeleccionado(
            null,
          );
          setBusquedaContacto('');
          setDestinatarioManual(
            '',
          );
          setNombreManual('');
          setAsunto('');
        },
    });


  const destinatarioMensaje = () => {
    if (modoDestinatario === 'MANUAL') {
      return destinatarioMensajeManual.trim();
    }

    if (!contactoSeleccionado) {
      return '';
    }

    return canalMensaje === 'CORREO'
      ? contactoSeleccionado.correo ?? ''
      : contactoSeleccionado.telefono ?? '';
  };

  const enviarMensaje =
    useMutation({
      mutationFn:
        async () => {
          const destino =
            destinatarioMensaje();

          const nombre =
            modoDestinatario ===
            'BUSCAR'
              ? contactoSeleccionado
                  ?.nombreRazonSocial ??
                ''
              : nombreMensajeManual;

          return (
            await api.post(
              '/notificaciones/enviar-canal',
              {
                canal:
                  canalMensaje,
                destinatario:
                  destino,
                nombreDestinatario:
                  nombre ||
                  undefined,
                asunto:
                  canalMensaje ===
                  'CORREO'
                    ? asuntoMensaje
                    : undefined,
                mensaje:
                  cuerpoMensaje,
              },
            )
          ).data;
        },

      onSuccess:
        async (resultado) => {
          await queryClient.invalidateQueries(
            {
              queryKey: [
                'notificaciones-historial',
              ],
            },
          );

          await feedback.exito(
            'Mensaje enviado',
            `Canal: ${resultado.canal}. Destino: ${resultado.destinatario}.`,
          );

          setAsuntoMensaje('');
          setCuerpoMensaje('');
          setContactoSeleccionado(
            null,
          );
          setBusquedaContacto('');
          setDestinatarioMensajeManual(
            '',
          );
          setNombreMensajeManual('');
        },
    });

  const confirmarMensaje =
    async () => {
      const destino =
        destinatarioMensaje();

      if (
        !destino ||
        !cuerpoMensaje.trim() ||
        (canalMensaje ===
          'CORREO' &&
          !asuntoMensaje.trim())
      ) {
        await feedback.info(
          'Completa el mensaje',
          canalMensaje === 'CORREO'
            ? 'Selecciona un destinatario y escribe el asunto y el mensaje.'
            : 'Selecciona un destinatario con teléfono y escribe el mensaje.',
        );
        return;
      }

      const respuesta =
        await feedback.confirmar(
          `¿Enviar por ${
            canalMensaje === 'CORREO'
              ? 'correo'
              : canalMensaje ===
                  'WHATSAPP'
                ? 'WhatsApp'
                : 'SMS'
          }?`,
          `El mensaje se enviará a ${destino}.`,
          'Enviar mensaje',
        );

      if (
        respuesta.isConfirmed
      ) {
        enviarMensaje.mutate();
      }
    };

  const marcarLeida =
    useMutation({
      mutationFn:
        async (id: number) =>
          api.patch(
            `/notificaciones/${id}/leida`,
          ),
      onSuccess:
        async () => {
          await queryClient.invalidateQueries(
            {
              queryKey: [
                'notificaciones-historial',
              ],
            },
          );
        },
    });

  const seleccionarContacto = (
    contacto: Contacto,
  ) => {
    setContactoSeleccionado(
      contacto,
    );
    setBusquedaContacto(
      `${contacto.nombreRazonSocial} <${contacto.correo ?? ''}>`,
    );
    setMostrarSugerencias(
      false,
    );
  };

  const usarDestinatarioOriginal =
    () => {
      if (!certificado)
        return;

      setModoDestinatario(
        'MANUAL',
      );
      setDestinatarioManual(
        certificado.destinatarioOriginal,
      );
      setNombreManual(
        certificado.firmante
          ?.nombre ??
          certificado.contacto
            ?.nombre ??
          '',
      );
    };

  const confirmarEnvio =
    async () => {
      if (
        !certificadoCodigo ||
        !destinatario ||
        !mensaje.trim()
      ) {
        await feedback.info(
          'Completa el envío',
          'Selecciona el certificado, un destinatario y escribe el mensaje.',
        );
        return;
      }

      const detalleCanal =
        canalCertificado === 'CORREO'
          ? 'con PDF adjunto, QR y enlaces de verificación'
          : canalCertificado === 'WHATSAPP'
            ? 'con código y enlaces para verificar, ver y descargar el certificado'
            : 'con código y enlace de verificación';

      const respuesta =
        await feedback.confirmar(
          '¿Enviar certificado?',
          `Se enviará el certificado ${certificadoCodigo} por ${canalCertificado} a ${destinatario}, ${detalleCanal}.`,
          'Enviar certificado',
        );

      if (
        !respuesta.isConfirmed
      )
        return;

      enviar.mutate();
    };

  const noLeidas =
    historial.filter(
      (item: any) =>
        !item.leida,
    ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>

        <h1 className="text-3xl font-semibold text-[#202a47]">
          Notificaciones
        </h1>

      </header>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <button
          type="button"
          onClick={() =>
            setTab('MENSAJE')
          }
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
            tab === 'MENSAJE'
              ? 'bg-[#284bc2] text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Enviar mensaje
        </button>

        <button
          type="button"
          onClick={() =>
            setTab('ENVIAR')
          }
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
            tab === 'ENVIAR'
              ? 'bg-[#284bc2] text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Enviar certificado
        </button>

        <button
          type="button"
          onClick={() =>
            setTab('ALERTAS')
          }
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
            tab === 'ALERTAS'
              ? 'bg-[#284bc2] text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Historial y alertas
          {noLeidas > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              {noLeidas}
            </span>
          )}
        </button>
      </div>


      {tab === 'MENSAJE' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[#202a47]">
              1. Destinatario
            </h2>


            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Canal
              </p>
              <div className="grid grid-cols-3 gap-2">
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
                    onClick={() => {
                      setCanalMensaje(canal);
                      setContactoSeleccionado(null);
                      setBusquedaContacto('');
                      setDestinatarioMensajeManual('');
                    }}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold ${
                      canalMensaje === canal
                        ? 'border-[#284bc2] bg-[#edf1ff] text-[#284bc2]'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
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
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setModoDestinatario(
                    'BUSCAR',
                  )
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  modoDestinatario ===
                  'BUSCAR'
                    ? 'bg-[#edf1ff] text-[#284bc2]'
                    : 'bg-slate-50 text-slate-500'
                }`}
              >
                Cliente / proveedor
              </button>

              <button
                type="button"
                onClick={() =>
                  setModoDestinatario(
                    'MANUAL',
                  )
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  modoDestinatario ===
                  'MANUAL'
                    ? 'bg-[#edf1ff] text-[#284bc2]'
                    : 'bg-slate-50 text-slate-500'
                }`}
              >
                {canalMensaje === 'CORREO'
                  ? 'Otro correo'
                  : 'Otro teléfono'}
              </button>
            </div>

            {modoDestinatario ===
            'BUSCAR' ? (
              <div
                ref={
                  cajaBusquedaRef
                }
                className="relative mt-3"
              >
                <div className="mb-2 flex gap-2">
                  {(
                    [
                      'CLIENTE',
                      'PROVEEDOR',
                    ] as const
                  ).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => {
                        setTipoContacto(
                          tipo,
                        );
                        setContactoSeleccionado(
                          null,
                        );
                        setBusquedaContacto(
                          '',
                        );
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        tipoContacto ===
                        tipo
                          ? 'border-[#284bc2] text-[#284bc2]'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {tipo ===
                      'CLIENTE'
                        ? 'Clientes'
                        : 'Proveedores'}
                    </button>
                  ))}
                </div>

                {contactoSeleccionado ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div>
                      <p className="font-semibold text-[#202a47]">
                        {
                          contactoSeleccionado.nombreRazonSocial
                        }
                      </p>
                      <p className="text-sm text-slate-500">
                        {canalMensaje === 'CORREO'
                          ? contactoSeleccionado.correo ||
                            'Sin correo registrado'
                          : contactoSeleccionado.telefono ||
                            'Sin teléfono registrado'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setContactoSeleccionado(
                          null,
                        );
                        setBusquedaContacto(
                          '',
                        );
                      }}
                      className="text-sm font-semibold text-[#284bc2]"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={
                        busquedaContacto
                      }
                      onChange={(e) => {
                        setBusquedaContacto(
                          e.target.value,
                        );
                        setMostrarSugerencias(
                          true,
                        );
                      }}
                      onFocus={() =>
                        setMostrarSugerencias(
                          true,
                        )
                      }
                      placeholder="Buscar por nombre, identificación o correo..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    />

                    {mostrarSugerencias && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {buscandoContactos && (
                          <p className="p-4 text-sm text-slate-500">
                            Buscando...
                          </p>
                        )}

                        {contactos
                          .filter(
                            (item) =>
                              item.activo &&
                              (canalMensaje === 'CORREO'
                                ? Boolean(item.correo)
                                : Boolean(item.telefono)),
                          )
                          .slice(0, 30)
                          .map(
                            (item) => (
                              <button
                                key={
                                  item.id
                                }
                                type="button"
                                onClick={() =>
                                  seleccionarContacto(
                                    item,
                                  )
                                }
                                className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                              >
                                <p className="text-sm font-semibold text-[#202a47]">
                                  {
                                    item.nombreRazonSocial
                                  }
                                </p>
                                <p className="text-xs text-slate-500">
                                  {canalMensaje === 'CORREO'
                                    ? item.correo
                                    : item.telefono}
                                </p>
                              </button>
                            ),
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <input
                  type={
                    canalMensaje === 'CORREO'
                      ? 'email'
                      : 'tel'
                  }
                  value={
                    destinatarioMensajeManual
                  }
                  onChange={(e) =>
                    setDestinatarioMensajeManual(
                      e.target.value,
                    )
                  }
                  placeholder={
                    canalMensaje === 'CORREO'
                      ? 'Correo del destinatario'
                      : 'Teléfono, ej. +573001234567'
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  value={
                    nombreMensajeManual
                  }
                  onChange={(e) =>
                    setNombreMensajeManual(
                      e.target.value,
                    )
                  }
                  placeholder="Nombre del destinatario"
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[#202a47]">
              2. Escribe el mensaje
            </h2>

            {canalMensaje === 'CORREO' && (
              <input
                value={
                  asuntoMensaje
                }
                onChange={(e) =>
                  setAsuntoMensaje(
                    e.target.value,
                  )
                }
                placeholder="Asunto del correo"
                className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            )}

            <textarea
              rows={10}
              value={
                cuerpoMensaje
              }
              onChange={(e) =>
                setCuerpoMensaje(
                  e.target.value,
                )
              }
              placeholder="Escribe aquí el mensaje que deseas enviar..."
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 leading-6"
            />

            <button
              type="button"
              onClick={
                confirmarMensaje
              }
              disabled={
                enviarMensaje.isPending
              }
              className="mt-5 w-full rounded-xl bg-[#284bc2] px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {enviarMensaje.isPending
                ? 'Enviando...'
                : `Enviar por ${
                    canalMensaje === 'CORREO'
                      ? 'correo'
                      : canalMensaje === 'WHATSAPP'
                        ? 'WhatsApp'
                        : 'SMS'
                  }`}
            </button>
          </section>
        </div>
      )}

      {tab === 'ENVIAR' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[#202a47]">
              1. Selecciona el certificado
            </h2>


            <select
              value={
                certificadoCodigo
              }
              onChange={(e) => {
                setCertificadoCodigo(
                  e.target.value,
                );
                setAsunto('');
              }}
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              <option value="">
                {cargandoCertificados
                  ? 'Cargando certificados...'
                  : 'Selecciona un certificado'}
              </option>

              {certificados.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.codigo}
                  >
                    {item.codigo} ·{' '}
                    {item.tipo} ·{' '}
                    {item.titulo}
                  </option>
                ),
              )}
            </select>

            {certificado && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Dato
                    label="Código"
                    value={
                      certificado.codigo
                    }
                  />
                  <Dato
                    label="Tipo"
                    value={
                      certificado.tipo
                    }
                  />
                  <Dato
                    label="Firmante"
                    value={
                      certificado.firmante
                        ?.nombre ??
                      '—'
                    }
                  />
                  <Dato
                    label="Elementos"
                    value={String(
                      certificado.elementos,
                    )}
                  />
                  <Dato
                    label="Destinatario original"
                    value={
                      certificado.destinatarioOriginal
                    }
                  />
                  <Dato
                    label="Fecha"
                    value={new Date(
                      certificado.fechaCertificacion,
                    ).toLocaleString(
                      'es-CO',
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={
                    usarDestinatarioOriginal
                  }
                  className="mt-4 text-sm font-semibold text-[#284bc2]"
                >
                  Usar destinatario original
                </button>
              </div>
            )}

            <h2 className="mt-6 font-semibold text-[#202a47]">
              2. Canal y destinatario
            </h2>

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
                  onClick={() => {
                    setCanalCertificado(
                      canal,
                    );
                    setContactoSeleccionado(
                      null,
                    );
                    setBusquedaContacto('');
                    setDestinatarioManual('');
                  }}
                  className={`rounded-xl border px-3 py-3 text-xs font-semibold ${
                    canalCertificado === canal
                      ? 'border-[#284bc2] bg-[#edf1ff] text-[#284bc2]'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
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

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setModoDestinatario(
                    'BUSCAR',
                  )
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  modoDestinatario ===
                  'BUSCAR'
                    ? 'bg-[#edf1ff] text-[#284bc2]'
                    : 'bg-slate-50 text-slate-500'
                }`}
              >
                Cliente / proveedor
              </button>

              <button
                type="button"
                onClick={() =>
                  setModoDestinatario(
                    'MANUAL',
                  )
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  modoDestinatario ===
                  'MANUAL'
                    ? 'bg-[#edf1ff] text-[#284bc2]'
                    : 'bg-slate-50 text-slate-500'
                }`}
              >
                {canalCertificado === 'CORREO'
                  ? 'Otro correo'
                  : 'Otro teléfono'}
              </button>
            </div>

            {modoDestinatario ===
            'BUSCAR' ? (
              <div
                ref={
                  cajaBusquedaRef
                }
                className="relative mt-3"
              >
                <div className="mb-2 flex gap-2">
                  {(
                    [
                      'CLIENTE',
                      'PROVEEDOR',
                    ] as const
                  ).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => {
                        setTipoContacto(
                          tipo,
                        );
                        setContactoSeleccionado(
                          null,
                        );
                        setBusquedaContacto(
                          '',
                        );
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        tipoContacto ===
                        tipo
                          ? 'border-[#284bc2] text-[#284bc2]'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {tipo ===
                      'CLIENTE'
                        ? 'Clientes'
                        : 'Proveedores'}
                    </button>
                  ))}
                </div>

                {contactoSeleccionado ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div>
                      <p className="font-semibold text-[#202a47]">
                        {
                          contactoSeleccionado.nombreRazonSocial
                        }
                      </p>
                      <p className="text-sm text-slate-500">
                        {
                          canalCertificado === 'CORREO'
                            ? contactoSeleccionado.correo
                            : contactoSeleccionado.telefono
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setContactoSeleccionado(
                          null,
                        );
                        setBusquedaContacto(
                          '',
                        );
                      }}
                      className="text-sm font-semibold text-[#284bc2]"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={
                        busquedaContacto
                      }
                      onChange={(e) => {
                        setBusquedaContacto(
                          e.target.value,
                        );
                        setMostrarSugerencias(
                          true,
                        );
                      }}
                      onFocus={() =>
                        setMostrarSugerencias(
                          true,
                        )
                      }
                      placeholder="Buscar por nombre, identificación o correo..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    />

                    {mostrarSugerencias && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {buscandoContactos && (
                          <p className="p-4 text-sm text-slate-500">
                            Buscando...
                          </p>
                        )}

                        {!buscandoContactos &&
                          contactos.length ===
                            0 && (
                            <p className="p-4 text-sm text-slate-500">
                              Sin resultados.
                            </p>
                          )}

                        {contactos
                          .filter(
                            (item) =>
                              item.activo &&
                              (canalCertificado === 'CORREO'
                                ? Boolean(item.correo)
                                : Boolean(item.telefono)),
                          )
                          .slice(0, 30)
                          .map(
                            (item) => (
                              <button
                                key={
                                  item.id
                                }
                                type="button"
                                onClick={() =>
                                  seleccionarContacto(
                                    item,
                                  )
                                }
                                className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                              >
                                <p className="text-sm font-semibold text-[#202a47]">
                                  {
                                    item.nombreRazonSocial
                                  }
                                </p>
                                <p className="text-xs text-slate-500">
                                  {
                                    canalCertificado === 'CORREO'
                                      ? item.correo
                                      : item.telefono
                                  }
                                </p>
                              </button>
                            ),
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <input
                  type={
                    canalCertificado ===
                    'CORREO'
                      ? 'email'
                      : 'tel'
                  }
                  value={
                    destinatarioManual
                  }
                  onChange={(e) =>
                    setDestinatarioManual(
                      e.target.value,
                    )
                  }
                  placeholder={
                    canalCertificado ===
                    'CORREO'
                      ? 'Correo del destinatario'
                      : 'Teléfono, ej. +573001234567'
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  value={
                    nombreManual
                  }
                  onChange={(e) =>
                    setNombreManual(
                      e.target.value,
                    )
                  }
                  placeholder="Nombre del destinatario"
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[#202a47]">
              3. Mensaje
            </h2>

            {canalCertificado === 'CORREO' && (
              <input
                value={asunto}
                onChange={(e) =>
                  setAsunto(
                    e.target.value,
                  )
                }
                placeholder={
                  certificado
                    ? `Certificado firmado ${certificado.codigo}`
                    : 'Asunto del correo'
                }
                className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            )}

            <textarea
              rows={8}
              value={mensaje}
              onChange={(e) =>
                setMensaje(
                  e.target.value,
                )
              }
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 leading-6"
            />

            <div className="mt-4 rounded-xl bg-[#f7f9fc] p-4 text-sm leading-6 text-slate-500">
              {canalCertificado === 'CORREO' ? (
                <>
                  El correo incluirá automáticamente:
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <span>✓ PDF adjunto</span>
                    <span>✓ QR de verificación</span>
                    <span>✓ URL pública</span>
                    <span>✓ Ver certificado</span>
                    <span>✓ Ver PDF</span>
                    <span>✓ Descargar PDF</span>
                  </div>
                </>
              ) : canalCertificado === 'WHATSAPP' ? (
                <>
                  WhatsApp incluirá:
                  <div className="mt-2 grid gap-2 text-xs">
                    <span>✓ Código de verificación</span>
                    <span>✓ Enlace público de verificación</span>
                    <span>✓ Enlace para ver PDF</span>
                    <span>✓ Enlace para descargar PDF</span>
                  </div>
                </>
              ) : (
                <>
                  SMS incluirá una versión corta:
                  <div className="mt-2 grid gap-2 text-xs">
                    <span>✓ Código del certificado</span>
                    <span>✓ Enlace público de verificación</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={
                confirmarEnvio
              }
              disabled={
                enviar.isPending
              }
              className="mt-5 w-full rounded-xl bg-[#284bc2] px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {enviar.isPending
                ? 'Enviando...'
                : `Enviar certificado por ${
                    canalCertificado === 'CORREO'
                      ? 'correo'
                      : canalCertificado === 'WHATSAPP'
                        ? 'WhatsApp'
                        : 'SMS'
                  }`}
            </button>
          </section>
        </div>
      )}

      {tab === 'ALERTAS' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[#202a47]">
                Historial y alertas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Incluye alertas automáticas y reenvíos realizados desde este módulo.
              </p>
            </div>

            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {noLeidas} sin leer
            </span>
          </div>

          {historial.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              Todavía no hay notificaciones.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {historial
                .slice(0, 50)
                .map(
                  (item: any) => (
                    <div
                      key={
                        item.id
                      }
                      className={`rounded-xl border p-4 ${
                        item.leida
                          ? 'border-slate-200 bg-white'
                          : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[#202a47]">
                              {
                                item.tipo
                              }
                            </span>

                            {item.tipo ===
                              'REENVIO_CERTIFICADO' && (
                              <span className="rounded-full bg-[#edf1ff] px-2 py-0.5 text-[10px] font-semibold text-[#284bc2]">
                                CERTIFICADO
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {
                              item.mensaje
                            }
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(
                              item.fechaCreacion,
                            ).toLocaleString(
                              'es-CO',
                            )}
                          </p>
                        </div>

                        {!item.leida && (
                          <button
                            type="button"
                            onClick={() =>
                              marcarLeida.mutate(
                                item.id,
                              )
                            }
                            className="whitespace-nowrap text-xs font-semibold text-[#284bc2]"
                          >
                            Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  ),
                )}
            </div>
          )}
        </section>
      )}
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
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-[#202a47]">
        {value}
      </p>
    </div>
  );
}
