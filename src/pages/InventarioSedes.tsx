import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { fechaAuditoria, accionAuditoria } from '../lib/auditoria';
import { empresaEfectivaId, tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

type Bodega = { id: number; nombre: string; principal: boolean };
type Sede = { id: number; nombre: string; bodegas: Bodega[] };
type Producto = { registroId: number; source: string; nombre: string; codigo: string };
type Lote = { id: number; codigo: string; vence: string | null };
type Traslado = { id: number; origenId: number; destinoId: number; loteId: number; estado: string; cantidad: string; recibida: string | null; diferenciaMotivo: string | null };
type Conteo = { id: number; bodegaId: number; loteId: number; esperado: string; contado: string; estado: string; contadoPor: number; aprobadoPor: number | null; motivo: string };
type Detalle = {
  principalId: number | null; disponiblePrincipal: string;
  saldos: { bodegaId: number; loteId: number; cantidad: string }[];
  lotes: Lote[]; traslados: Traslado[]; conteos: Conteo[];
  kardex: { id: number; bodegaId: number; loteId: number; anterior: string; nuevo: string; accion: string; fecha: string; referencia: number | null; usuarioId: number; motivo: string | null }[];
  historico: { id: number; tipo: string; fechaCreacion: string; cantidadAnterior: string; cantidadNueva: string; usuarioId: number | null; observacion: string | null; facturaId: number | null }[];
};
type Operacion = 'ENTRADA' | 'SALIDA' | 'TRASLADO' | 'CONTEO' | 'ASIGNAR';

const card = 'rounded-2xl border border-slate-200 bg-white p-5';
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
const primary = 'rounded-lg bg-[#254a7e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 disabled:opacity-50';
const apiBase = '/inventario-sedes';

function Tabla({ titulos, children }: { titulos: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-max text-left text-sm">
    <thead className="bg-slate-50"><tr>{titulos.map((titulo) => <th key={titulo} scope="col" className="px-3 py-2">{titulo}</th>)}</tr></thead>
    <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-slate-100">{children}</tbody>
  </table></div>;
}

export default function InventarioSedes() {
  const usuario = useAuthStore((s) => s.usuario);
  const empresaId = empresaEfectivaId(usuario);
  const crear = tienePermiso(usuario, 'INVENTARIOS_CREAR');
  const mover = tienePermiso(usuario, 'INVENTARIOS_MOVIMIENTOS');
  const aprobar = mover && tienePermiso(usuario, 'INVENTARIOS_EDITAR');
  const cache = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [termino, setTermino] = useState('');
  const [registro, setRegistro] = useState('');
  const [sedeFiltro, setSedeFiltro] = useState('');
  const [operacion, setOperacion] = useState<Operacion>('ENTRADA');
  const [recepcion, setRecepcion] = useState<number>();
  const [mensaje, setMensaje] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [origen, setOrigen] = useState('');
  const [loteOperacion, setLoteOperacion] = useState('0');

  const estructura = useQuery({
    queryKey: ['estructura-inventario', empresaId],
    queryFn: async () => (await api.get<Sede[]>(apiBase)).data,
  });
  const sedes = estructura.data ?? [];
  const bodegas = sedes.flatMap((sede) => sede.bodegas.map((bodega) => ({ ...bodega, sedeId: sede.id, sede: sede.nombre })));
  const principales = bodegas.some((bodega) => bodega.principal);
  const productos = useQuery({
    queryKey: ['catalogo-sedes', empresaId, termino],
    queryFn: async () => {
      const { data } = await api.get<Producto[]>('/inventarios/catalogo/productos', { params: { buscar: termino } });
      return data.filter((producto) => producto.source === 'REGISTRO_ENTIDAD');
    },
    enabled: principales,
  });
  const detalle = useQuery({
    queryKey: ['detalle-sedes', empresaId, registro],
    queryFn: async () => (await api.get<Detalle>(`${apiBase}/productos/${registro}`)).data,
    enabled: !!registro && principales,
  });

  const guardar = useMutation({
    mutationFn: async ({ ruta, datos, patch }: { ruta: string; datos?: object; patch?: boolean }) =>
      api.request({ url: apiBase + ruta, method: patch ? 'PATCH' : 'POST', data: datos ?? {} }),
    onSuccess: async () => {
      setMensaje('Operación registrada.');
      setRecepcion(undefined);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['detalle-sedes', empresaId] }),
        cache.invalidateQueries({ queryKey: ['estructura-inventario', empresaId] }),
        cache.invalidateQueries({ queryKey: ['catalogo-sedes', empresaId] }),
      ]);
    },
    onError: (error) => {
      const respuesta = isAxiosError(error) ? error.response : undefined;
      const mensaje = respuesta?.data?.message;
      setErrorOperacion(respuesta && respuesta.status < 500 && typeof mensaje === 'string'
        ? mensaje
        : 'No se pudo confirmar la operación. Actualiza el detalle antes de repetirla.');
      if (respuesta?.status === 400 || respuesta?.status === 409) void detalle.refetch();
    },
  });

  function enviar(ruta: string, datos?: object, patch = false) {
    setMensaje('');
    setErrorOperacion('');
    guardar.mutate({ ruta, datos, patch });
  }

  function operar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const valores = new FormData(evento.currentTarget);
    const comun = {
      registroId: Number(registro),
      loteId: Number(valores.get('lote')),
      cantidad: Number(valores.get('cantidad')),
    };
    if (operacion === 'TRASLADO') {
      enviar('/traslados', { ...comun, origenId: Number(valores.get('bodega')), destinoId: Number(valores.get('destino')) });
      return;
    }
    const ruta = operacion === 'CONTEO' ? '/conteos' : operacion === 'ASIGNAR' ? '/lotes/asignar' : '/movimientos';
    enviar(ruta, { ...comun, bodegaId: Number(valores.get('bodega')), motivo: valores.get('motivo'), tipo: operacion });
  }

  function bodegaNombre(id: number) {
    const bodega = bodegas.find((item) => item.id === id);
    return bodega ? `${bodega.sede} / ${bodega.nombre}` : `Bodega #${id}`;
  }

  function loteNombre(id: number) {
    return id === 0 ? 'Sin lote' : detalle.data?.lotes.find((lote) => lote.id === id)?.codigo ?? `Lote #${id}`;
  }

  function opcionesBodega(excluir?: string) {
    return bodegas.filter((bodega) => String(bodega.id) !== excluir).map((bodega) => <option key={bodega.id} value={bodega.id}>{bodegaNombre(bodega.id)}</option>);
  }

  const datos = detalle.data;
  const origenActual = origen || String(datos?.principalId ?? bodegas[0]?.id ?? '');
  function saldoDisponible(bodegaId: number, loteId: number) {
    if (loteId === 0 && bodegaId === datos?.principalId) return Number(datos.disponiblePrincipal);
    return Number(datos?.saldos.find((saldo) => saldo.bodegaId === bodegaId && saldo.loteId === loteId)?.cantidad ?? 0);
  }
  const descuenta = operacion === 'SALIDA' || operacion === 'TRASLADO' || operacion === 'ASIGNAR';
  const disponible = saldoDisponible(Number(origenActual), operacion === 'ASIGNAR' ? 0 : Number(loteOperacion));
  const existencias = datos ? [
    ...(datos.principalId ? [{ bodegaId: datos.principalId, loteId: 0, cantidad: datos.disponiblePrincipal }] : []),
    ...datos.saldos,
  ].filter((saldo) => !sedeFiltro || bodegas.some((bodega) => bodega.id === saldo.bodegaId && bodega.sedeId === Number(sedeFiltro))) : [];

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Inventario por sede</h1><p className="mt-1 text-sm text-slate-600">Consulta existencias y registra operaciones por bodega y lote.</p></div>
      <Link to="/inventario" className={secondary}>Volver al inventario general</Link>
    </header>
    {estructura.isPending && <p>Cargando sedes…</p>}
    {estructura.isError && <p role="alert">No se pudieron cargar las sedes.</p>}
    {estructura.isSuccess && !principales && <section className={card}>
      <h2 className="font-semibold">Configurar inventario por sede</h2>
      <p className="my-2 text-sm text-slate-600">Las existencias actuales se mostrarán en Sede principal / Bodega principal, sin lote.</p>
      {crear && <button type="button" className={primary} disabled={guardar.isPending} onClick={() => enviar('/activar')}>Activar inventario por sede</button>}
    </section>}
    {errorOperacion && <p role="alert" className="sticky top-0 z-10 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorOperacion}</p>}
    {mensaje && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm">{mensaje}</p>}
    {principales && <>
      <section className={card}>
        <h2 className="text-lg font-semibold">Sedes y bodegas</h2>
        <ul className="my-3 space-y-1 text-sm">{sedes.map((sede) => <li key={sede.id}><strong>{sede.nombre}</strong> · {sede.bodegas.map((bodega) => bodega.nombre).join(', ') || 'Sin bodegas'}</li>)}</ul>
        {crear && <div className="grid gap-4 lg:grid-cols-2">
          <form className="flex items-end gap-2" onSubmit={(e) => {
            e.preventDefault(); enviar('/sedes', { nombre: new FormData(e.currentTarget).get('nombre') });
          }}>
            <label className="flex-1 text-sm">Nombre de sede<input name="nombre" className={field} required maxLength={80} /></label>
            <button className={secondary} disabled={guardar.isPending}>Crear sede</button>
          </form>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            enviar(`/sedes/${f.get('sede')}/bodegas`, { nombre: f.get('nombre') });
          }}>
            <label className="flex-1 text-sm">Sede<select className={field} name="sede" required>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
            <label className="flex-1 text-sm">Nombre de bodega<input name="nombre" className={field} required maxLength={80} /></label>
            <button className={secondary} disabled={guardar.isPending}>Crear bodega</button>
          </form>
        </div>}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Referencia</h2>
        <form className="my-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setTermino(busqueda.trim()); }}>
          <label className="min-w-48 flex-1 text-sm">Buscar por nombre, código o referencia<input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={field} /></label>
          <button className={secondary}>Buscar</button>
        </form>
        <label className="block text-sm">Producto<select className={field} value={registro} onChange={(e) => { setRegistro(e.target.value); setRecepcion(undefined); setLoteOperacion('0'); setErrorOperacion(''); }}>
          <option value="">Selecciona un producto</option>
          {registro && !productos.data?.some((producto) => String(producto.registroId) === registro) && <option value={registro}>PRD-{registro}</option>}
          {productos.data?.map((producto) => <option key={producto.registroId} value={producto.registroId}>{producto.codigo} · {producto.nombre}</option>)}
        </select></label>
        {productos.isError && <p role="alert" className="mt-2 text-sm">No se pudo cargar el catálogo.</p>}
      </section>

      {detalle.isFetching && !datos && <p>Cargando existencias…</p>}
      {detalle.isError && <p role="alert">No se pudo cargar el detalle del producto.</p>}
      {datos && <>
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">Existencias de PRD-{registro}</h2>
            <label className="text-sm">Filtrar sede<select className={field} value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)}>
              <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select></label>
          </div>
          <Tabla titulos={['Sede y bodega', 'Lote', 'Vencimiento', 'Disponible']}>
            {existencias.map((saldo) => <tr key={`${saldo.bodegaId}-${saldo.loteId}`}><td>{bodegaNombre(saldo.bodegaId)}</td><td>{loteNombre(saldo.loteId)}</td><td>{datos.lotes.find((lote) => lote.id === saldo.loteId)?.vence?.slice(0, 10) ?? '—'}</td><td>{saldo.cantidad}</td></tr>)}
          </Tabla>
          {!existencias.length && <p className="mt-3 text-sm text-slate-600">No hay existencias en la sede seleccionada.</p>}
        </section>

        {mover && <section className={card}>
          <h2 className="text-lg font-semibold">Registrar operación</h2>
          <form key={registro} className="my-3 grid items-end gap-3 md:grid-cols-3" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            enviar('/lotes', { registroId: Number(registro), codigo: f.get('codigo'), vence: f.get('vence') });
          }}>
            <label className="text-sm">Código de lote<input className={field} name="codigo" required maxLength={80} /></label>
            <label className="text-sm">Vencimiento del lote<input className={field} type="date" name="vence" /></label>
            <button className={secondary} disabled={guardar.isPending}>Crear lote</button>
          </form>
          <form key={`${registro}-${operacion}`} onSubmit={operar} className="grid items-end gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">Operación<select className={field} value={operacion} onChange={(e) => { setOperacion(e.target.value as Operacion); setLoteOperacion('0'); setErrorOperacion(''); }}>
              <option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="TRASLADO">Crear traslado</option><option value="CONTEO">Conteo físico</option><option value="ASIGNAR">Asignar unidades a un lote</option>
            </select></label>
            <label className="text-sm">{operacion === 'TRASLADO' ? 'Bodega de origen' : 'Bodega'}<select name="bodega" className={field} value={origenActual} onChange={(e) => setOrigen(e.target.value)} required>{opcionesBodega()}</select></label>
            {operacion === 'TRASLADO' && <label className="text-sm">Bodega de destino<select key={origenActual} name="destino" className={field} required defaultValue=""><option value="">Selecciona destino</option>{opcionesBodega(origenActual)}</select></label>}
            <label className="text-sm">{operacion === 'ASIGNAR' ? 'Lote de destino' : 'Lote'}<select className={field} name="lote" value={operacion === 'ASIGNAR' && loteOperacion === '0' ? '' : loteOperacion} onChange={(e) => setLoteOperacion(e.target.value)} required>
              {operacion === 'ASIGNAR' ? <option value="">Selecciona un lote</option> : <option value="0">Sin lote</option>}{datos.lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.codigo}</option>)}
            </select></label>
            <label className="text-sm">{operacion === 'CONTEO' ? 'Cantidad contada' : 'Cantidad'}<input className={field} type="number" name="cantidad" step="0.001" min={operacion === 'CONTEO' ? 0 : 0.001} max={descuenta ? Math.max(0, disponible) : undefined} required />
              {descuenta && <span className="mt-1 block text-xs text-slate-600">Disponible {disponible}{operacion === 'ASIGNAR' ? ' sin lote' : ''}</span>}
            </label>
            {operacion !== 'TRASLADO' && <label className="text-sm sm:col-span-2">Motivo<input className={field} name="motivo" required maxLength={250} /></label>}
            <button className={primary} disabled={guardar.isPending || (descuenta && disponible <= 0) || (operacion === 'TRASLADO' && bodegas.length < 2)}>Registrar</button>
          </form>
        </section>}

        <section className={card}>
          <h2 className="mb-3 text-lg font-semibold">Traslados</h2>
          <Tabla titulos={['Traslado', 'Origen y destino', 'Lote', 'Cantidad', 'Estado', 'Acciones']}>
            {datos.traslados.map((t) => <tr key={t.id}>
              <td>#{t.id}</td><td>{bodegaNombre(t.origenId)} → {bodegaNombre(t.destinoId)}</td><td>{loteNombre(t.loteId)}</td><td>{t.cantidad}{t.recibida !== null && ` · Recibida: ${t.recibida}`}</td><td>{accionAuditoria(t.estado)}{t.diferenciaMotivo && <p>{t.diferenciaMotivo}</p>}</td>
              <td className="space-x-1">{mover && t.estado === 'PENDIENTE' && <>
                <button className={secondary} disabled={guardar.isPending || saldoDisponible(t.origenId, t.loteId) < Number(t.cantidad)} onClick={() => enviar(`/traslados/${t.id}`, { accion: 'DESPACHAR' }, true)}>Despachar</button>
                {saldoDisponible(t.origenId, t.loteId) < Number(t.cantidad) && <p className="mt-1 whitespace-normal text-xs text-red-700">Origen con saldo insuficiente. Disponible {saldoDisponible(t.origenId, t.loteId)}.</p>}
                <button className={secondary} disabled={guardar.isPending} onClick={() => enviar(`/traslados/${t.id}`, { accion: 'CANCELAR' }, true)}>Cancelar</button>
              </>}{mover && t.estado === 'EN_TRANSITO' && <button className={secondary} disabled={guardar.isPending} onClick={() => { setRecepcion(t.id); setErrorOperacion(''); }}>Recibir</button>}</td>
            </tr>)}
          </Tabla>
          {!datos.traslados.length && <p className="mt-3 text-sm text-slate-600">Todavía no hay traslados.</p>}
          {mover && datos.traslados.some((t) => t.id === recepcion && t.estado === 'EN_TRANSITO') && <form key={recepcion} className="mt-4 grid items-end gap-2 sm:grid-cols-3" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            enviar(`/traslados/${recepcion}`, { accion: 'RECIBIR', recibida: Number(f.get('cantidad')), motivo: f.get('motivo') }, true);
          }}>
            <label className="text-sm">Cantidad recibida<input className={field} name="cantidad" type="number" step="0.001" min="0" max={datos.traslados.find((t) => t.id === recepcion)?.cantidad} defaultValue={datos.traslados.find((t) => t.id === recepcion)?.cantidad} required /></label>
            <label className="text-sm">Motivo si hay diferencia<input name="motivo" className={field} maxLength={250} /></label>
            <button className={primary} disabled={guardar.isPending}>Confirmar recepción #{recepcion}</button>
          </form>}
        </section>

        <section className={card}>
          <h2 className="mb-3 text-lg font-semibold">Conteos físicos</h2>
          <Tabla titulos={['Conteo', 'Bodega y lote', 'Esperado', 'Contado', 'Estado y motivo', 'Acciones']}>
            {datos.conteos.map((c) => <tr key={c.id}>
              <td>#{c.id}</td><td>{bodegaNombre(c.bodegaId)} · {loteNombre(c.loteId)}</td><td>{c.esperado}</td><td>{c.contado}</td><td>{accionAuditoria(c.estado)} · {c.motivo}<p className="text-xs text-slate-500">Contó #{c.contadoPor}{c.aprobadoPor && ` · Aprobó #${c.aprobadoPor}`}</p></td>
              <td className="space-x-1">{aprobar && c.estado === 'PENDIENTE' && <>
                <button className={secondary} disabled={guardar.isPending} onClick={() => enviar(`/conteos/${c.id}`, { aprobar: true }, true)}>Aprobar</button>
                <button className={secondary} disabled={guardar.isPending} onClick={() => enviar(`/conteos/${c.id}`, { aprobar: false }, true)}>Cancelar</button>
              </>}</td>
            </tr>)}
          </Tabla>
          {!datos.conteos.length && <p className="mt-3 text-sm text-slate-600">Todavía no hay conteos físicos.</p>}
        </section>

        <section className={card}>
          <h2 className="mb-3 text-lg font-semibold">Kárdex por bodega</h2>
          <Tabla titulos={['Fecha', 'Bodega y lote', 'Movimiento', 'Saldo anterior', 'Saldo nuevo', 'Responsable', 'Referencia']}>
            {datos.kardex.map((k) => <tr key={k.id}><td>{fechaAuditoria(k.fecha)}</td><td>{bodegaNombre(k.bodegaId)} · {loteNombre(k.loteId)}</td><td>{accionAuditoria(k.accion)}</td><td>{k.anterior}</td><td>{k.nuevo}</td><td>Usuario #{k.usuarioId}</td><td>{k.referencia ? `#${k.referencia}` : '—'} {k.motivo}</td></tr>)}
          </Tabla>
          {!datos.kardex.length && <p className="mt-3 text-sm text-slate-600">Todavía no hay movimientos por bodega.</p>}
          {!!datos.historico.length && <details className="mt-5">
            <summary className="cursor-pointer font-semibold text-indigo-800">Movimientos del inventario general</summary>
            <p className="mb-2 mt-1 text-sm text-slate-600">Historial existente de saldos globales, facturas y cargas.</p>
            <Tabla titulos={['Fecha', 'Tipo', 'Saldo global anterior', 'Saldo global nuevo', 'Responsable y documento']}>
              {datos.historico.map((h) => <tr key={h.id}><td>{fechaAuditoria(h.fechaCreacion)}</td><td>{accionAuditoria(h.tipo)}</td><td>{h.cantidadAnterior}</td><td>{h.cantidadNueva}</td><td>{h.usuarioId ? `Usuario #${h.usuarioId}` : '—'} {h.facturaId ? `· Factura #${h.facturaId}` : ''} {h.observacion}</td></tr>)}
            </Tabla>
          </details>}
        </section>
      </>}
    </>}
  </div>;
}
