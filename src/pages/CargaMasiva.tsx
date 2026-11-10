import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';

type TipoCarga = 'PRODUCTOS' | 'CLIENTES' | 'PROVEEDORES';
type Estrategia = 'OMITIR' | 'ACTUALIZAR' | 'SUMAR_EXISTENCIAS';

interface Objetivo {
  campo: string;
  etiqueta: string;
  obligatorio: boolean;
  tipoDato: string;
}

interface Preview {
  token: string;
  tipo: TipoCarga;
  nombreArchivo: string;
  totalFilas: number;
  columnasOrigen: string[];
  objetivos: Objetivo[];
  mapeoSugerido: Record<string, string>;
  resumen: {
    validas: number;
    conError: number;
    advertencias: number;
  };
  errores: Array<{
    fila: number;
    campo?: string;
    error: string;
  }>;
  advertencias: Array<{
    fila: number;
    campo?: string;
    mensaje: string;
  }>;
  vistaPrevia: Array<{
    fila: number;
    original: Record<string, any>;
    interpretada: Record<string, any>;
  }>;
  notaPdf?: string | null;
}

export default function CargaMasiva() {
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<TipoCarga>('PRODUCTOS');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [entidadId, setEntidadId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [estrategia, setEstrategia] =
    useState<Estrategia>('OMITIR');
  const [resultado, setResultado] = useState<any>(null);

  const { data: inventarios = [] } = useQuery<any[]>({
    queryKey: ['inventarios-carga-masiva'],
    queryFn: async () => (await api.get('/inventarios')).data,
    enabled: tipo === 'PRODUCTOS',
  });

  const inventarioId = inventarios.find((inventario) => inventario.nombre === 'Inventario nacional')?.id;
  const { data: categorias = [] } = useQuery<any[]>({
    queryKey: ['categorias-carga-masiva', inventarioId],
    queryFn: async () => {
      const { data } = await api.get<any[]>(`/inventarios/${inventarioId}/categorias`);
      return data.filter((categoria) => categoria.modoCampos === 'PLANTILLA');
    },
    enabled: tipo === 'PRODUCTOS' && Boolean(inventarioId),
  });

  const { data: historial = [] } = useQuery<any[]>({
    queryKey: ['historial-carga-masiva'],
    queryFn: async () =>
      (await api.get('/carga-masiva/historial')).data,
  });

  const previsualizar = useMutation({
    mutationFn: async () => {
      if (!archivo) throw new Error('Selecciona un archivo');

      const form = new FormData();
      form.append('archivo', archivo);
      form.append('tipo', tipo);

      if (tipo === 'PRODUCTOS') {
        form.append('inventarioId', String(inventarioId));
        form.append('entidadId', entidadId);
      }

      return (
        await api.post('/carga-masiva/previsualizar', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      ).data as Preview;
    },
    onSuccess: async (data) => {
      setPreview(data);
      setMapeo(data.mapeoSugerido ?? {});
      setResultado(null);
      await feedback.toast(
        data.resumen.conError > 0 ? 'warning' : 'success',
        data.resumen.conError > 0
          ? `Archivo analizado con ${data.resumen.conError} fila(s) con error`
          : `${data.totalFilas} fila(s) analizadas correctamente`,
      );
    },
  });

  const confirmar = useMutation({
    mutationFn: async () =>
      (
        await api.post('/carga-masiva/confirmar', {
          token: preview!.token,
          mapeo,
          estrategiaDuplicado: estrategia,
        })
      ).data,
    onSuccess: async (data) => {
      setResultado(data);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['historial-carga-masiva'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventarios'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['clientes'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['proveedores'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dashboard-resumen-fase3'],
        }),
      ]);

      await feedback.exito(
        'Importación terminada',
        `Creadas: ${data.creadas} · Actualizadas: ${data.actualizadas} · Omitidas: ${data.omitidas} · Errores: ${data.errores?.length ?? 0}`,
      );
    },
  });

  const confirmarImportacion = async () => {
    if (!preview) return;

    const respuesta = await feedback.confirmar(
      '¿Confirmar importación?',
      `SIGIFAC procesará ${preview.totalFilas} fila(s). Estrategia de duplicados: ${estrategia.replaceAll('_', ' ')}.`,
      'Importar datos',
    );

    if (!respuesta.isConfirmed) return;

    confirmar.mutate();
  };

  const puedePrevisualizar =
    Boolean(archivo) &&
    (tipo !== 'PRODUCTOS' ||
      (Boolean(inventarioId) && Boolean(entidadId)));

  const erroresMapeo = useMemo(() => {
    if (!preview) return [];

    return preview.objetivos
      .filter(
        (objetivo) =>
          objetivo.obligatorio && !mapeo[objetivo.campo],
      )
      .map((objetivo) => objetivo.etiqueta);
  }, [preview, mapeo]);

  const cambiarTipo = (nuevo: TipoCarga) => {
    setTipo(nuevo);
    setArchivo(null);
    setPreview(null);
    setMapeo({});
    setResultado(null);
    setEntidadId('');
    setEstrategia('OMITIR');
  };

  const descargarPlantilla = async () => {
    const { data } = await api.get('/carga-masiva/plantilla-excel', {
      params: {
        tipo,
        ...(tipo === 'PRODUCTOS' && entidadId
          ? { entidadId }
          : {}),
      },
      responseType: 'blob',
    });

    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const categoriaSeleccionada = categorias.find(
      (categoria: any) => String(categoria.id) === String(entidadId),
    );

    const nombreBase =
      tipo === 'PRODUCTOS'
        ? `plantilla_productos_${String(
            categoriaSeleccionada?.nombre ?? 'categoria',
          )
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')}`
        : `plantilla_${tipo.toLowerCase()}`;

    a.download = `${nombreBase}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#253043]">
          Carga masiva
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Destino
          active={tipo === 'PRODUCTOS'}
          title="Productos / Inventario"
          text="Carga productos a un inventario y categoría específicos."
          onClick={() => cambiarTipo('PRODUCTOS')}
        />
        <Destino
          active={tipo === 'CLIENTES'}
          title="Clientes"
          text="Importa o actualiza el directorio comercial de clientes."
          onClick={() => cambiarTipo('CLIENTES')}
        />
        <Destino
          active={tipo === 'PROVEEDORES'}
          title="Proveedores"
          text="Importa o actualiza proveedores de la empresa."
          onClick={() => cambiarTipo('PROVEEDORES')}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-[#253043]">
              1. Archivo y destino
            </h2>
          </div>

          <button
            type="button"
            onClick={descargarPlantilla}
            disabled={tipo === 'PRODUCTOS' && !entidadId}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#1f4f82] disabled:opacity-40"
          >
            Descargar plantilla Excel
          </button>
        </div>

        {tipo === 'PRODUCTOS' && (
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium text-[#253043]">Inventario nacional</p>
              {!inventarioId && <p className="text-sm text-slate-600">Crea primero una categoría estándar desde Inventario.</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#253043]">
                Categoría *
              </label>
              <select
                value={entidadId}
                onChange={(e) => {
                  setEntidadId(e.target.value);
                  setPreview(null);
                }}
                disabled={!inventarioId}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-50"
              >
                <option value="">Selecciona categoría</option>
                {categorias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setPreview(null);
              setResultado(null);
            }}
            className="block w-full text-sm text-slate-600"
          />

          {archivo && (
            <div className="mt-3 rounded-lg bg-white px-4 py-3 text-sm">
              <p className="font-semibold text-[#253043]">
                {archivo.name}
              </p>
              <p className="text-xs text-slate-500">
                {(archivo.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => previsualizar.mutate()}
            disabled={
              !puedePrevisualizar || previsualizar.isPending
            }
            className="rounded-xl bg-[#1f4f82] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {previsualizar.isPending
              ? 'Analizando archivo...'
              : 'Previsualizar y validar'}
          </button>
        </div>

        {previsualizar.isError && (
          <ErrorBox text="No fue posible interpretar el archivo. Revisa el formato, los encabezados y el destino seleccionado." />
        )}
      </section>

      {preview && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="font-semibold text-[#253043]">
                2. Resultado de validación
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {preview.nombreArchivo} · {preview.totalFilas} fila(s) detectadas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi
                label="Total"
                value={preview.totalFilas}
              />
              <Kpi
                label="Válidas"
                value={preview.resumen.validas}
              />
              <Kpi
                label="Con error"
                value={preview.resumen.conError}
                alert={preview.resumen.conError > 0}
              />
              <Kpi
                label="Advertencias"
                value={preview.resumen.advertencias}
              />
            </div>

            {preview.notaPdf && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {preview.notaPdf}
              </div>
            )}

            {preview.errores.length > 0 && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="font-semibold text-red-800">
                  Errores encontrados
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto text-sm text-red-700">
                  {preview.errores.slice(0, 20).map((error, index) => (
                    <p key={index}>
                      Fila {error.fila}
                      {error.campo ? ` · ${error.campo}` : ''}: {error.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="font-semibold text-[#253043]">
                3. Mapeo de columnas
              </h2>
            </div>

            <div className="grid gap-3">
              {preview.objetivos.map((objetivo) => (
                <div
                  key={objetivo.campo}
                  className="grid grid-cols-1 items-center gap-3 rounded-xl border border-slate-100 p-3 md:grid-cols-[1fr_40px_1fr]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#253043]">
                      {objetivo.etiqueta}
                      {objetivo.obligatorio ? ' *' : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {objetivo.tipoDato}
                    </p>
                  </div>

                  <div className="hidden text-center text-slate-400 md:block">
                    ←
                  </div>

                  <select
                    value={mapeo[objetivo.campo] ?? ''}
                    onChange={(e) =>
                      setMapeo((actual) => ({
                        ...actual,
                        [objetivo.campo]: e.target.value,
                      }))
                    }
                    className={`rounded-xl border px-3 py-2.5 text-sm ${
                      objetivo.obligatorio &&
                      !mapeo[objetivo.campo]
                        ? 'border-red-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <option value="">No mapear</option>
                    {preview.columnasOrigen.map((columna) => (
                      <option key={columna} value={columna}>
                        {columna}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {erroresMapeo.length > 0 && (
              <p className="mt-4 text-sm text-red-600">
                Falta mapear: {erroresMapeo.join(', ')}.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-[#253043]">
                  4. Vista previa
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Primeras {preview.vistaPrevia.length} filas interpretadas.
                </p>
              </div>

              <select
                value={estrategia}
                onChange={(e) =>
                  setEstrategia(
                    e.target.value as Estrategia,
                  )
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="OMITIR">
                  Duplicados: omitir
                </option>
                <option value="ACTUALIZAR">
                  Duplicados: actualizar
                </option>
                {tipo === 'PRODUCTOS' && (
                  <option value="SUMAR_EXISTENCIAS">
                    Duplicados: sumar existencias
                  </option>
                )}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Fila</th>
                    {preview.objetivos
                      .filter((o) => mapeo[o.campo])
                      .slice(0, 8)
                      .map((objetivo) => (
                        <th
                          key={objetivo.campo}
                          className="px-3 py-3"
                        >
                          {objetivo.etiqueta}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.vistaPrevia.map((fila) => (
                    <tr
                      key={fila.fila}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-3 text-slate-500">
                        {fila.fila}
                      </td>
                      {preview.objetivos
                        .filter((o) => mapeo[o.campo])
                        .slice(0, 8)
                        .map((objetivo) => (
                          <td
                            key={objetivo.campo}
                            className="px-3 py-3"
                          >
                            {String(
                              fila.interpretada[
                                objetivo.campo
                              ] ?? '—',
                            )}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={confirmarImportacion}
                disabled={
                  erroresMapeo.length > 0 ||
                  preview.resumen.conError > 0 ||
                  confirmar.isPending ||
                  Boolean(resultado)
                }
                className="rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {confirmar.isPending
                  ? 'Importando...'
                  : 'Confirmar importación'}
              </button>
            </div>

            {confirmar.isError && (
              <ErrorBox text="No se pudo confirmar la importación. Revisa los errores y el mapeo." />
            )}

            {resultado && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">
                  Importación terminada
                </p>
                <p className="mt-1">
                  Procesadas: {resultado.procesadas} · Creadas:{' '}
                  {resultado.creadas} · Actualizadas:{' '}
                  {resultado.actualizadas} · Omitidas:{' '}
                  {resultado.omitidas} · Errores:{' '}
                  {resultado.errores?.length ?? 0}
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-[#253043]">
            Historial de cargas
          </h2>
        </div>

        {historial.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Todavía no hay cargas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Archivo</th>
                  <th className="px-4 py-3">Destino</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Procesadas</th>
                  <th className="px-4 py-3">Errores</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((trabajo) => (
                  <tr
                    key={trabajo.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3">
                      {new Date(
                        trabajo.fechaCreacion,
                      ).toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#253043]">
                      {trabajo.nombreArchivo}
                    </td>
                    <td className="px-4 py-3">
                      {trabajo.categoria ||
                        trabajo.tipoDestino}
                    </td>
                    <td className="px-4 py-3">
                      {trabajo.totalFilas}
                    </td>
                    <td className="px-4 py-3">
                      {trabajo.filasProcesadas}
                    </td>
                    <td className="px-4 py-3">
                      {trabajo.filasError}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {trabajo.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Destino({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? 'border-[#1f4f82] bg-[#edf4ff] shadow-sm'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <p className="font-semibold text-[#253043]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        {text}
      </p>
    </button>
  );
}

function Kpi({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        alert
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[#253043]">
        {value}
      </p>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {text}
    </div>
  );
}

