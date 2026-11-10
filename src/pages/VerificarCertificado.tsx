import {
  useQuery,
} from '@tanstack/react-query';
import {
  useParams,
} from 'react-router-dom';
import { isAxiosError } from 'axios';
import { API_BASE_URL, api } from '../api/client';

export default function VerificarCertificado() {
  const {
    codigo = '',
  } = useParams();

  const { data, error, isError } =
    useQuery({
      queryKey: [
        'verificar-certificado',
        codigo,
      ],
      retry: false,
      queryFn:
        async () =>
          (
            await api.get(
              `/certificacion/verificar/${encodeURIComponent(codigo)}`,
            )
          ).data,
    });

  if (isError) {
    const inexistente = isAxiosError(error) && error.response?.status === 404;
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-700">
        <h1 className="text-xl font-semibold">{inexistente ? 'Certificado no encontrado' : 'No se pudo consultar el certificado'}</h1>
        <p className="mt-2">{inexistente ? 'Comprueba el enlace o escanea nuevamente el código QR.' : 'Intenta abrir nuevamente el enlace.'}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-500">
        Verificando certificado...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fc] px-4 py-10">
      <main className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div
          className={`rounded-2xl p-5 ${
            data.valido
              ? 'bg-emerald-50'
              : 'bg-red-50'
          }`}
        >
          <p
            className={`text-xl font-semibold ${
              data.valido
                ? 'text-emerald-700'
                : 'text-red-700'
            }`}
          >
            {data.valido
              ? 'Certificado válido'
              : 'Certificado no válido'}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Código de verificación: {data.codigoVerificacion}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Dato
            label="Empresa emisora"
            value={data.empresa}
          />
          <Dato
            label="Tipo"
            value={
              data.tipoCertificacion ??
              'Certificación'
            }
          />
          <Dato
            label="Firmante"
            value={
              data.firmante
                ?.nombre ??
              '—'
            }
          />
          <Dato
            label="Identificación"
            value={
              data.firmante
                ?.identificacion ??
              '—'
            }
          />
        </div>

        {data.valido && <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`${API_BASE_URL}/certificacion/certificado/${encodeURIComponent(codigo)}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-[#284bc2] px-5 py-3 text-sm font-semibold text-white"
          >
            Abrir PDF firmado
          </a>
        </div>}

        <h2 className="mt-8 font-semibold text-[#202a47]">
          Trazabilidad
        </h2>

        <div className="mt-3 space-y-2">
          {(data.eventos ??
            []).map(
            (evento: any) => (
              <div
                key={`${evento.tipo}-${evento.fecha}`}
                className="rounded-xl border border-slate-100 px-4 py-3"
              >
                <p className="text-sm font-semibold text-[#202a47]">
                  {evento.tipo}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(
                    evento.fecha,
                  ).toLocaleString(
                    'es-CO',
                  )}
                </p>
              </div>
            ),
          )}
        </div>
      </main>
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
      <p className="text-xs uppercase text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-[#202a47]">
        {value}
      </p>
    </div>
  );
}
