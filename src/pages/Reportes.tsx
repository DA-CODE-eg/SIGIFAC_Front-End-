import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { empresaEfectivaId } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';
import { feedback } from '../lib/feedback';

type Formato = 'XLSX' | 'CSV' | 'PDF';

interface Reporte {
  tipo: string;
  nombre: string;
  grupo: string;
  admiteSede?: boolean;
}

type Resumen = {
  total: number;
  gruposTotales: number;
  unidad?: string;
  etiqueta: string;
  comparativo: string | null;
  serie: { etiqueta: string; valor: number; comparativo: number }[];
  muestra: Record<string, string | number>[];
};

const filtro = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
const formatoNumero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

export default function Reportes() {
  const empresaId = useAuthStore((s) => empresaEfectivaId(s.usuario));
  const [tipo, setTipo] = useState('EXISTENCIAS_SEDES');
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [buscar, setBuscar] = useState('');
  const [formato, setFormato] =
    useState<Formato>('XLSX');
  const [descargando, setDescargando] =
    useState<string | null>(null);

  const { data: catalogo = [] } = useQuery<Reporte[]>({
    queryKey: ['reportes-catalogo', empresaId],
    queryFn: async () =>
      (await api.get('/reportes/catalogo')).data,
  });

  const seleccionado = catalogo.find((item) => item.tipo === tipo);
  const params = {
    tipo, sedeId: seleccionado?.admiteSede ? sedeId || undefined : undefined,
    desde: tipo === 'EXISTENCIAS_SEDES' ? undefined : desde || undefined,
    hasta: tipo === 'EXISTENCIAS_SEDES' ? undefined : hasta || undefined,
  };
  const fechasValidas = !params.desde || !params.hasta || params.desde <= params.hasta;
  const { data: sedes = [] } = useQuery({
    queryKey: ['reportes-sedes', empresaId],
    queryFn: async () => (await api.get<{ id: number; nombre: string }[]>('/reportes/sedes')).data,
    enabled: !!seleccionado?.admiteSede,
  });
  const resumen = useQuery({
    queryKey: ['reportes-resumen', empresaId, params],
    queryFn: async () => (await api.get<Resumen>('/reportes/resumen', { params })).data,
    enabled: !!seleccionado && fechasValidas,
  });
  const muestra = resumen.data?.muestra ?? [];
  const columnas = muestra[0] ? Object.keys(muestra[0]) : [];

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return catalogo;

    return catalogo.filter((r) =>
      `${r.nombre} ${r.grupo} ${r.tipo}`
        .toLowerCase()
        .includes(q),
    );
  }, [catalogo, buscar]);

  const grupos = useMemo(
    () =>
      Array.from(
        new Set(filtrados.map((r) => r.grupo)),
      ),
    [filtrados],
  );

  const descargar = async (reporte: Reporte, usarFiltros = false) => {
    try {
      setDescargando(reporte.tipo);

      const { data, headers } = await api.get(
        '/reportes/exportar',
        {
          params: {
            ...(usarFiltros ? params : {}),
            tipo: reporte.tipo,
            formato,
          },
          responseType: 'blob',
        },
      );

      const contentDisposition =
        headers['content-disposition'] ?? '';
      const match = /filename="?([^"]+)"?/i.exec(
        contentDisposition,
      );

      const extension = formato.toLowerCase();
      const filename =
        match?.[1] ??
        `sertiva_${reporte.tipo.toLowerCase()}.${extension}`;

      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = filename;
      a.click();

      URL.revokeObjectURL(url);

      await feedback.exito(
        'Reporte generado',
        `${reporte.nombre} se descargó correctamente.`,
      );
    } catch {
      // La API muestra el error de descarga.
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Información · exportación · control
          </p>
          <h1 className="text-3xl font-semibold text-[#10274d]">
            Reportes
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Descarga información operativa y comercial del sistema en Excel, CSV o PDF.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex gap-1">
            {(['XLSX', 'CSV', 'PDF'] as Formato[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormato(item)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    formato === item
                      ? 'bg-[#254a7e] text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item === 'XLSX'
                    ? 'Excel'
                    : item}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div><h2 className="text-lg font-semibold">Centro de reportes</h2><p className="mt-1 text-sm text-slate-600">El filtro por sede está disponible para existencias, traslados, conteos y kárdex. Los demás reportes abarcan toda la empresa.</p></div>
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Reporte<select className={filtro} value={tipo} onChange={(evento) => { setTipo(evento.target.value); setSedeId(''); }}>
            {catalogo.map((item) => <option key={item.tipo} value={item.tipo}>{item.nombre}</option>)}
          </select></label>
          {seleccionado?.admiteSede && <label className="text-sm">Sede<select className={filtro} value={sedeId} onChange={(evento) => setSedeId(evento.target.value)}>
            <option value="">Todas las sedes</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
          </select></label>}
          {tipo !== 'EXISTENCIAS_SEDES' && <>
            <label className="text-sm">Desde<input className={filtro} type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} /></label>
            <label className="text-sm">Hasta<input className={filtro} type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} /></label>
          </>}
        </div>
        {!fechasValidas && <p role="alert" className="text-sm text-red-700">La fecha inicial debe ser anterior o igual a la final.</p>}
        {seleccionado && fechasValidas && resumen.isPending && <p className="text-sm">Preparando gráfico…</p>}
        {resumen.isError && <p role="alert" className="text-sm text-red-700">No se pudo generar el reporte.</p>}
        {resumen.data && <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{formatoNumero.format(resumen.data.total)} registros {resumen.data.unidad ? '· COP' : ''}</p>
            {seleccionado && <button type="button" disabled={!!descargando} onClick={() => void descargar(seleccionado, true)} className="rounded-lg bg-[#254a7e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Exportar con filtros</button>}
          </div>
          {resumen.data.serie.length > 0 ? <>
            <div className="h-72 w-full" aria-label={`Gráfico de ${seleccionado?.nombre ?? tipo}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumen.data.serie} margin={{ top: 8, left: 16, bottom: 24 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(valor) => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(Number(valor))} />
                  <Tooltip formatter={(valor) => formatoNumero.format(Number(valor))} />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="valor" name={resumen.data.etiqueta} fill="#254a7e" radius={[4, 4, 0, 0]} />
                  {resumen.data.comparativo && <Bar dataKey="comparativo" name={resumen.data.comparativo} fill="#7955c7" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {resumen.data.gruposTotales > resumen.data.serie.length && <p className="text-xs text-slate-500">El gráfico muestra {resumen.data.serie.length} de {resumen.data.gruposTotales} grupos. La exportación incluye todos los registros filtrados.</p>}
          </> : <p className="text-sm text-slate-600">No hay datos para graficar con estos filtros.</p>}
          {!!muestra.length && <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer font-semibold text-indigo-800">Ver detalle · hasta 25 filas</summary>
            <div className="mt-2 overflow-x-auto"><table className="w-full min-w-max text-left text-sm">
              <thead className="bg-slate-50"><tr>{columnas.map((columna) => <th key={columna} scope="col" className="px-3 py-2">{columna}</th>)}</tr></thead>
              <tbody>{muestra.map((fila, indice) => <tr key={indice} className="border-t border-slate-100">{columnas.map((columna) => <td key={columna} className="max-w-64 break-words px-3 py-2">{String(fila[columna] ?? '—')}</td>)}</tr>)}</tbody>
            </table></div>
          </details>}
        </>}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar reporte..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#254a7e]"
        />
      </div>

      {grupos.map((grupo) => (
        <section key={grupo}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#10274d]">
              {grupo}
            </h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtrados
              .filter((r) => r.grupo === grupo)
              .map((reporte) => (
                <div
                  key={reporte.tipo}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {reporte.grupo}
                      </p>
                      <h3 className="mt-1 font-semibold text-[#10274d]">
                        {reporte.nombre}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {descripcion(reporte.tipo)}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#edf3fa] px-2.5 py-1 text-xs font-semibold text-[#254a7e]">
                      {formato === 'XLSX'
                        ? 'Excel'
                        : formato}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => descargar(reporte)}
                    disabled={
                      descargando === reporte.tipo
                    }
                    className="mt-5 w-full rounded-xl bg-[#254a7e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {descargando === reporte.tipo
                      ? 'Generando...'
                      : 'Descargar reporte'}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}

      {filtrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No encontramos reportes con ese criterio.
        </div>
      )}
    </div>
  );
}

function descripcion(tipo: string) {
  const descripciones: Record<string, string> = {
    EXISTENCIAS_SEDES: 'Saldo disponible por sede, bodega y lote.',
    TRASLADOS: 'Despachos, recepciones, mercancía en tránsito y diferencias.',
    CONTEOS: 'Cantidad esperada, conteo físico y conciliación.',
    KARDEX_SEDES: 'Entradas, salidas y ajustes con saldos anteriores y nuevos.',

    INVENTARIO:
      'Existencias, inventario, categorías, proveedores y estado de los productos.',
    PRODUCTOS:
      'Catálogo operativo de productos activos con stock y precio.',
    MOVIMIENTOS:
      'Entradas, salidas, ventas, ajustes y devoluciones con trazabilidad.',
    VENCIMIENTOS:
      'Productos con fecha de vencimiento, días restantes y semaforización.',
    CLIENTES:
      'Directorio de clientes con estado y datos de contacto.',
    PROVEEDORES:
      'Directorio de proveedores y datos comerciales.',
    FACTURAS:
      'Facturas emitidas, estado, totales, saldos y pagos.',
    CARTERA:
      'Facturas pendientes, parciales o vencidas y saldo pendiente.',
    CERTIFICACIONES:
      'Solicitudes, certificados, códigos QR y hashes de integridad.',
    NOTIFICACIONES:
      'Historial de alertas y notificaciones del sistema.',
    AUDITORIA:
      'Acciones de usuarios, módulos, resultados y cambios registrados.',
  };

  return (
    descripciones[tipo] ??
    'Información exportable de Sertiva.'
  );
}
