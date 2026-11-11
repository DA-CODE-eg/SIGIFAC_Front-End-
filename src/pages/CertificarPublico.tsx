import VerificacionFacial from '../components/VerificacionFacial';
import FirmaGrafica from '../components/FirmaGrafica';
import { isAxiosError } from 'axios';
import Marca from '../components/Marca';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  useParams,
} from 'react-router-dom';
import { api } from '../api/client';

type Paso =
  | 'DOCUMENTO'
  | 'OTP'
  | 'FACIAL'
  | 'IDENTIDAD'
  | 'FINAL';

export default function CertificarPublico() {
  const { token = '' } =
    useParams();

  const [paso, setPaso] =
    useState<Paso>('DOCUMENTO');
  const [otp, setOtp] =
    useState('');
  const [
    firmaSession,
    setFirmaSession,
  ] = useState('');
  const [nombre, setNombre] =
    useState('');
  const [
    identificacion,
    setIdentificacion,
  ] = useState('');
  const [acepta, setAcepta] =
    useState(false);
  const [firmaGrafica, setFirmaGrafica] = useState('');
  const [resultado, setResultado] =
    useState<any>(null);

  const { data } = useQuery({
    queryKey: [
      'certificacion-publica',
      token,
    ],
    queryFn: async () =>
      (
        await api.get(
          `/certificacion/firma/publica/${token}`,
        )
      ).data,
  });

  useEffect(() => {
    if (!token) return;

    api.post(
      `/certificacion/firma/publica/${token}/visualizar`,
    ).catch(() => null);
  }, [token]);

  const items = useMemo(() => {
    const c =
      data?.contenido ?? {};

    return (
      c.items ??
      c.productos ??
      c.filas ??
      []
    );
  }, [data]);

  const soloFacial = data?.metodoFirma === 'FACIAL';
  const codigoFacial = data?.metodoFirma === 'CODIGO_FACIAL';
  const requiereGrafica = data?.metodoFirma === 'CODIGO_GRAFICA';

  const enviarOtp =
    useMutation({
      mutationFn: async () =>
        api.post(
          `/certificacion/firma/publica/${token}/otp`,
        ),
      onSuccess: () =>
        setPaso('OTP'),
    });

  const validarOtp =
    useMutation({
      mutationFn: async () =>
        (
          await api.post(
            `/certificacion/firma/publica/${token}/validar-otp`,
            { otp },
          )
        ).data,
      onSuccess: (r) => {
        setFirmaSession(
          r.firmaSession,
        );
        setPaso(
          codigoFacial ? 'FACIAL' : 'IDENTIDAD',
        );
      },
    });

  const firmar =
    useMutation({
      mutationFn: async () =>
        (
          await api.post(
            `/certificacion/firma/publica/${token}/firmar`,
            {
              firmaSession,
              nombreCompleto:
                nombre,
              identificacion,
              acepta,
              ...(requiereGrafica ? { firmaGrafica } : {}),
            },
          )
        ).data,

      onSuccess: (r) => {
        setResultado(r);
        setPaso('FINAL');
      },
    });

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] p-8 text-slate-500">
        Cargando documento...
      </div>
    );
  }

  if (
    data.estado ===
      'APROBADO' &&
    data.certificado &&
    paso !== 'FINAL'
  ) {
    return (
      <Finalizado
        empresa={
          data.empresa
        }
        resultado={{
          urlVerificacion:
            `/verificar-certificado/${data.certificado.codigoVerificacion}`,
          urlPdf:
            data.certificado
              .pdfUrl,
          codigoVerificacion:
            data.certificado
              .codigoVerificacion,
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-8 md:py-12">
      <main className="mx-auto max-w-5xl">
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-4"><Marca /></div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#254a7e]">
                Documento para firma
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[#10274d]">
                {data.empresa}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Solicitud {data.codigo} · {tipoBonito(data.tipoCertificacion)}
              </p>
            </div>

            <EstadoPaso paso={paso} />
          </div>
        </header>

        {paso ===
          'DOCUMENTO' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Revisión del contenido
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#10274d]">
                Documento enviado para tu revisión
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Revisa cuidadosamente los elementos relacionados a continuación. El certificado final solo se generará después de completar el proceso de firma.
              </p>
            </div>

            <TablaContenido
              items={items}
            />

            {data.contenido
              ?.totales && (
              <ResumenTotales
                totales={
                  data.contenido
                    .totales
                }
              />
            )}

            {data.contenido
              ?.observacion && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <strong>Observación:</strong>{' '}
                {
                  data.contenido
                    .observacion
                }
              </div>
            )}

            <label className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) =>
                  setAcepta(
                    e.target.checked,
                  )
                }
                className="mt-1"
              />
              <span>
                Declaro que he visualizado el documento y los elementos incluidos y deseo continuar con el proceso de firma electrónica.
              </span>
            </label>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={
                  !acepta ||
                  enviarOtp.isPending
                }
                onClick={() =>
                  soloFacial ? setPaso('FACIAL') : enviarOtp.mutate()
                }
                className="rounded-xl bg-[#254a7e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {soloFacial ? 'Continuar con verificación facial' : 'Enviar código de verificación'}
              </button>
            </div>
            {enviarOtp.isError && <p role="alert" className="mt-2 text-sm text-red-700">No se pudo enviar el código de verificación.</p>}
          </section>
        )}

        {paso === 'OTP' && (
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-[#254a7e]">
              Validación de correo
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-[#10274d]">
              Revisa tu correo
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Te enviamos un código de verificación de 6 dígitos a <strong>{data.destinatario}</strong>. Ingrésalo para continuar.
            </p>

            <input
              aria-label="Código de verificación"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value
                    .replace(
                      /\D/g,
                      '',
                    )
                    .slice(
                      0,
                      6,
                    ),
                )
              }
              placeholder="000000"
              className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-4 text-center text-2xl font-semibold tracking-[0.5em]"
            />

            <button
              type="button"
              disabled={
                otp.length !== 6 ||
                validarOtp.isPending
              }
              onClick={() =>
                validarOtp.mutate()
              }
              className="mt-4 w-full rounded-xl bg-[#254a7e] px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              Validar código
            </button>
            {validarOtp.isError && <p role="alert" className="mt-3 text-sm text-red-700">El código es incorrecto o venció.</p>}
            <button type="button" disabled={enviarOtp.isPending || validarOtp.isPending} onClick={() => enviarOtp.mutate()}
              className="mt-4 text-sm font-medium text-[#254a7e] underline disabled:opacity-50">
              Enviar un nuevo código
            </button>
            {enviarOtp.isError && <p role="alert" className="mt-2 text-sm text-red-700">No se pudo enviar el código.</p>}
          </section>
        )}

        {paso === 'FACIAL' && <VerificacionFacial capturaSinReferencia={data?.capturaSinReferencia === true} token={token} sesionCorreo={codigoFacial ? firmaSession : undefined}
          onSuccess={sesion => { setFirmaSession(sesion); setPaso('IDENTIDAD'); }} />}

        {paso ===
          'IDENTIDAD' && (
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="mb-5 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {(soloFacial || codigoFacial) && data?.capturaSinReferencia ? 'Captura facial aprobada' : soloFacial ? 'Rostro verificado' : codigoFacial ? 'Correo y rostro verificados' : 'Correo validado'}
            </div>

            <h2 className="text-2xl font-semibold text-[#10274d]">
              Completa tu identificación
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sertiva comparará estos datos con la identificación esperada registrada para el destinatario del documento.
            </p>

            <div className="mt-6 space-y-4">
              <Input
                label="Nombre completo *"
                value={nombre}
                onChange={setNombre}
              />

              <Input
                label="Número de cédula / identificación *"
                value={
                  identificacion
                }
                onChange={
                  setIdentificacion
                }
              />
            </div>

            {requiereGrafica && <FirmaGrafica value={firmaGrafica} onChange={setFirmaGrafica} />}

            <label className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) =>
                  setAcepta(
                    e.target.checked,
                  )
                }
                className="mt-1"
              />
              <span>
                Confirmo que los datos suministrados me identifican y acepto firmar electrónicamente el contenido visualizado.
              </span>
            </label>

            <button
              type="button"
              disabled={
                !nombre.trim() ||
                !identificacion.trim() ||
                !acepta ||
                (requiereGrafica && !firmaGrafica) ||
                firmar.isPending
              }
              onClick={() =>
                firmar.mutate()
              }
              className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              Confirmar firma y sellar certificado
            </button>

            {firmar.isError && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {isAxiosError(firmar.error) && typeof firmar.error.response?.data?.message === 'string'
                  ? firmar.error.response.data.message : 'No fue posible completar la firma.'}
              </p>
            )}
          </section>
        )}

        {paso ===
          'FINAL' &&
          resultado && (
            <Finalizado
              empresa={
                data.empresa
              }
              resultado={
                resultado
              }
            />
          )}
      </main>
    </div>
  );
}

function TablaContenido({
  items,
}: {
  items: any[];
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        El documento no contiene una tabla de productos.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[850px] text-sm">
        <thead>
          <tr className="bg-[#173f67] text-left text-xs uppercase text-white">
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3">Referencia</th>
            <th className="px-4 py-3">Inventario</th>
            <th className="px-4 py-3 text-right">Cantidad</th>
            <th className="px-4 py-3 text-right">Precio</th>
            <th className="px-4 py-3 text-right">Impuestos</th>
            <th className="px-4 py-3 text-right">Valor</th>
          </tr>
        </thead>

        <tbody>
          {items.map(
            (item, index) => (
              <tr
                key={
                  item.id ??
                  item.registroId ??
                  index
                }
                className="border-t border-slate-100"
              >
                <td className="px-4 py-3 font-semibold text-[#10274d]">
                  {item.nombreProducto ??
                    item.nombre ??
                    item.producto ??
                    'Producto'}
                </td>

                <td className="px-4 py-3">
                  {item.referencia ??
                    '—'}
                </td>

                <td className="px-4 py-3">
                  {item.inventario ??
                    item.inventarioNombre ??
                    '—'}
                </td>

                <td className="px-4 py-3 text-right">
                  {Number(
                    item.cantidad ??
                      item.stock ??
                      0,
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  {moneda(
                    Number(
                      item.precioUnitario ??
                        item.precio ??
                        0,
                    ),
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  {moneda(
                    Number(
                      item.impuesto ??
                        item.impuestos ??
                        0,
                    ),
                  )}
                </td>

                <td className="px-4 py-3 text-right font-semibold">
                  {moneda(
                    Number(
                      item.subtotal ??
                        item.total ??
                        Number(
                          item.cantidad ??
                            0,
                        ) *
                          Number(
                            item.precioUnitario ??
                              item.precio ??
                              0,
                          ),
                    ),
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function ResumenTotales({
  totales,
}: {
  totales: any;
}) {
  return (
    <div className="mt-5 ml-auto max-w-sm rounded-xl bg-slate-50 p-4">
      <Fila
        label="Subtotal"
        value={moneda(
          Number(
            totales.subtotal ??
              0,
          ),
        )}
      />
      <Fila
        label="Descuentos"
        value={moneda(
          Number(
            totales.descuentos ??
              0,
          ),
        )}
      />
      <Fila
        label="Impuestos"
        value={moneda(
          Number(
            totales.impuestos ??
              0,
          ),
        )}
      />
      <div className="mt-3 border-t border-slate-200 pt-3">
        <Fila
          label="Valor facturado"
          value={moneda(
            Number(
              totales.valorFacturado ??
                totales.total ??
                0,
            ),
          )}
          strong
        />
      </div>
    </div>
  );
}

function Finalizado({
  empresa,
  resultado,
}: {
  empresa: string;
  resultado: any;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">
        ✓
      </div>

      <h2 className="mt-4 text-2xl font-semibold text-[#10274d]">
        Documento firmado y sellado
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        El proceso solicitado por {empresa} fue completado. También recibirás un correo con el certificado final y su enlace de verificación.
      </p>

      <p className="mt-4 text-sm font-semibold text-[#254a7e]">
        {resultado.codigoVerificacion}
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href={
            resultado.urlVerificacion
          }
          className="rounded-xl bg-[#254a7e] px-5 py-3 text-sm font-semibold text-white"
        >
          Ver certificado
        </a>

        <a
          href={
            resultado.urlPdf
          }
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-[#254a7e]"
        >
          Abrir PDF firmado
        </a>
      </div>
    </section>
  );
}

function EstadoPaso({
  paso,
}: {
  paso: Paso;
}) {
  const label =
    paso === 'DOCUMENTO'
      ? 'Revisión'
      : paso === 'OTP'
        ? 'Código de verificación'
        : paso === 'FACIAL'
          ? 'Verificación facial'
        : paso === 'IDENTIDAD'
          ? 'Identificación'
          : 'Firmado';

  return (
    <span className="rounded-full bg-[#edf3fa] px-3 py-1.5 text-xs font-semibold text-[#254a7e]">
      {label}
    </span>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#10274d]">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value,
          )
        }
        className="w-full rounded-xl border border-slate-200 px-4 py-3"
      />
    </div>
  );
}

function Fila({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 py-1 text-sm ${
        strong
          ? 'font-semibold text-[#10274d]'
          : 'text-slate-600'
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function tipoBonito(
  tipo: string,
) {
  return (
    {
      PRODUCTO:
        'Producto',
      INVENTARIO:
        'Inventario',
      CATEGORIA:
        'Categoría',
      MOVIMIENTO:
        'Movimiento',
      VENTA:
        'Venta / Factura',
    } as any
  )[tipo] ?? tipo;
}

function moneda(
  value: number,
) {
  return new Intl.NumberFormat(
    'es-CO',
    {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value ?? 0),
  );
}
