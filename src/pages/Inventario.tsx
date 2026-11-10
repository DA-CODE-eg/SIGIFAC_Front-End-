import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { isAxiosError } from 'axios';
import { tienePermiso } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

type Categoria = { id: number; nombre: string; inventarioId: number; modoCampos?: string };
type Inventario = { id: number; nombre: string; entidades: Categoria[] };
type Proveedor = { id: number; nombreRazonSocial: string };
type Producto = {
  id: number;
  proveedor?: Proveedor;
  datos: {
    nombre?: string; producto?: string; referencia?: string; cantidad?: number;
    precio?: number; unidad?: string; stockMinimo?: number; ubicacion?: string;
    lote?: string; fechaVencimiento?: string;
  };
};
type Movimiento = {
  id: number; tipo: string; cantidadAnterior: string; cantidadNueva: string;
  observacion?: string; fechaCreacion: string;
};

const caja = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const campo = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
const boton = 'rounded-lg bg-[#284bc2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const enlace = 'rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#284bc2]';
const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });
const normalizar = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const codigo = (id: number) => `PRD-${id}`;
const nombre = (p: Producto) => p.datos.nombre || p.datos.producto || p.datos.referencia || codigo(p.id);

function mensaje(error: unknown) {
  if (isAxiosError(error)) {
    const detalle = error.response?.data?.message;
    return typeof detalle === 'string' ? detalle : 'No se pudo completar la operación';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación';
}

async function prepararFoto(archivo: File) {
  if (!archivo.type.startsWith('image/') || archivo.size > 15 * 1024 * 1024) {
    throw new Error('Selecciona una imagen de hasta 15 MB');
  }
  const imagen = await createImageBitmap(archivo);
  try {
    const canvas = document.createElement('canvas');
    const escala = Math.min(1, 640 / Math.max(imagen.width, imagen.height));
    canvas.width = Math.max(1, Math.round(imagen.width * escala));
    canvas.height = Math.max(1, Math.round(imagen.height * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('El navegador no pudo procesar la foto');
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    for (const calidad of [0.82, 0.65, 0.45]) {
      const foto = canvas.toDataURL('image/jpeg', calidad);
      if (foto.startsWith('data:image/jpeg;') && foto.length <= 245000) return foto;
    }
    throw new Error('Selecciona una foto más pequeña');
  } finally {
    imagen.close();
  }
}

export default function Inventario() {
  const cache = useQueryClient();
  const usuario = useAuthStore((state) => state.usuario);
  const [seleccion, setSeleccion] = useState<number>();
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<number>();
  const [confirmacion, setConfirmacion] = useState('');

  const inventarios = useQuery({
    queryKey: ['inventarios'],
    queryFn: async () => (await api.get<Inventario[]>('/inventarios')).data,
  });
  const origenes = inventarios.data ?? [];
  const categorias = origenes.flatMap((inventario) => inventario.entidades.map((categoria) => ({
    ...categoria, origen: inventario.nombre,
  }))).sort((a, b) =>
    Number(b.origen === 'Inventario nacional') - Number(a.origen === 'Inventario nacional') ||
    a.nombre.localeCompare(b.nombre, 'es'));
  const categoria = categorias.find((item) => item.id === seleccion) ?? categorias[0];

  const categoriaEstandar = categoria?.origen === 'Inventario nacional' && categoria.modoCampos === 'PLANTILLA';

  const productos = useQuery({
    queryKey: ['inventario-productos', categoria?.id],
    queryFn: async () => (await api.get<Producto[]>(`/inventarios/categorias/${categoria!.id}/registros`)).data,
    enabled: Boolean(categoria),
  });

  const crearCategoria = useMutation({
    mutationFn: async (nombreCategoria: string) =>
      (await api.post<Categoria>('/inventarios/estandar/categorias', { nombre: nombreCategoria })).data,
    onSuccess: async (creada) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['inventarios'] }),
        cache.invalidateQueries({ queryKey: ['inventarios-carga-masiva'] }),
      ]);
      cambiarCategoria(creada.id);
      setNuevaCategoria(false);
    },
  });

  function cambiarCategoria(id: number) {
    setSeleccion(id);
    setNuevoProducto(false);
    setDetalle(undefined);
    setBusqueda('');
    setConfirmacion('');
  }

  async function actualizarProductos() {
    await cache.invalidateQueries({
      predicate: ({ queryKey }) => [
        'inventario-productos', 'inventario-movimientos', 'inventario-foto', 'productos-globales', 'dashboard-resumen-fase3',
      ].includes(String(queryKey[0])),
    });
  }

  const lista = productos.data ?? [];
  const filtro = normalizar(busqueda.trim());
  const visibles = lista.filter((p) => normalizar(`${codigo(p.id)} ${nombre(p)} ${p.datos.referencia ?? ''} ${p.datos.lote ?? ''}`).includes(filtro));
  const activo = lista.find((p) => p.id === detalle);

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[#202a47]">Inventario nacional</h1>
          <p className="mt-1 text-sm text-slate-600">Organiza productos por categoría y consulta sus existencias y movimientos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tienePermiso(usuario, 'PRODUCTOS_VER') && <Link className={enlace} to="/productos">Catálogo</Link>}
          {tienePermiso(usuario, 'CARGA_MASIVA') && <Link className={enlace} to="/carga-masiva">Carga masiva</Link>}
          {tienePermiso(usuario, 'INVENTARIOS_CREAR') && <button className={boton} onClick={() => { crearCategoria.reset(); setNuevaCategoria(!nuevaCategoria); }}>Nueva categoría</button>}
        </div>
      </header>

      {nuevaCategoria && <form className={caja} onSubmit={(evento) => {
        evento.preventDefault();
        crearCategoria.mutate(String(new FormData(evento.currentTarget).get('categoria')));
      }}>
        <label className="block max-w-md text-sm font-medium">Nombre de la categoría
          <input className={campo} name="categoria" placeholder="Ej. Pañales" maxLength={80} required autoFocus />
        </label>
        <button className={`${boton} mt-3`} disabled={crearCategoria.isPending}>Guardar categoría</button>
        {crearCategoria.isError && <p role="alert" className="mt-2 text-red-700">{mensaje(crearCategoria.error)}</p>}
      </form>}

      {inventarios.isPending && <p>Cargando inventario…</p>}
      {inventarios.isError && <p role="alert">{mensaje(inventarios.error)}</p>}
      {inventarios.isSuccess && !categoria && <section className={caja}>Crea la primera categoría para empezar a registrar productos.</section>}

      {categoria && <>
        <section className={`${caja} flex flex-wrap items-end gap-4`}>
          <label className="min-w-56 flex-1 text-sm font-medium">Categoría
            <select className={campo} value={categoria.id} onChange={(evento) => cambiarCategoria(Number(evento.target.value))}>
              {categorias.map((item) => <option key={item.id} value={item.id}>
                {item.nombre}{item.origen !== 'Inventario nacional' ? ` · ${item.origen}` : ''}
              </option>)}
            </select>
          </label>
          <label className="min-w-56 flex-1 text-sm font-medium">Buscar en la categoría
            <input className={campo} value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre, código, referencia o lote" />
          </label>
          {categoriaEstandar && tienePermiso(usuario, 'PRODUCTOS_CREAR') &&
            <button className={boton} onClick={() => { setNuevoProducto(!nuevoProducto); setDetalle(undefined); }}>Nuevo producto</button>}
        </section>

        {!categoriaEstandar &&
          <p className="text-sm text-slate-600">Categoría anterior. Puedes consultar sus productos y movimientos. Para nuevas fichas, crea una categoría estándar.</p>}

        {nuevoProducto && <AltaProducto key={categoria.id} categoriaId={categoria.id} onGuardar={async (producto) => {
          setConfirmacion(`Producto guardado con código ${codigo(producto.id)}.`);
          setNuevoProducto(false);
          setBusqueda('');
          await actualizarProductos();
        }} onCancelar={() => setNuevoProducto(false)} />}

        {confirmacion && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{confirmacion}</p>}

        <section className={caja}>
          <h2 className="mb-3 text-lg font-semibold">{categoria.nombre} · {lista.length} productos</h2>
          {productos.isPending && <p>Cargando productos…</p>}
          {productos.isError && <p role="alert">{mensaje(productos.error)}</p>}
          {productos.isSuccess && !visibles.length && <p className="text-sm text-slate-600">{filtro ? 'No hay coincidencias.' : 'Todavía no hay productos en esta categoría.'}</p>}
          {visibles.length > 0 && <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{['Producto', 'Código', 'Existencia', 'Precio', 'Ubicación', ''].map((titulo) => <th key={titulo} className="px-3 py-2" scope="col">{titulo || 'Acciones'}</th>)}</tr>
              </thead>
              <tbody>{visibles.map((p) => {
                const existencia = Number(p.datos.cantidad ?? 0);
                const bajo = existencia > 0 && existencia <= Number(p.datos.stockMinimo ?? 5);
                return <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-3 py-3"><strong>{nombre(p)}</strong><div className="text-xs text-slate-500">{p.datos.referencia}</div></td>
                  <td className="px-3 py-3 font-mono">{codigo(p.id)}</td>
                  <td className="px-3 py-3">{existencia} {p.datos.unidad ?? 'UND'}
                    {(existencia <= 0 || bajo) && <div className="text-xs font-medium text-amber-800">{existencia <= 0 ? 'Agotado' : 'Stock bajo'}</div>}
                  </td>
                  <td className="px-3 py-3">{moneda.format(Number(p.datos.precio ?? 0))}</td>
                  <td className="px-3 py-3">{p.datos.ubicacion || '—'}</td>
                  <td className="px-3 py-3"><button className={enlace} aria-expanded={detalle === p.id} onClick={() => { setNuevoProducto(false); setDetalle(detalle === p.id ? undefined : p.id); }}>Ficha y movimientos</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        </section>

        {activo && <Ficha key={activo.id} producto={activo} inventarioId={categoria.inventarioId} onMovimiento={actualizarProductos} />}
      </>}
    </main>
  );
}

function AltaProducto({ categoriaId, onGuardar, onCancelar }: {
  categoriaId: number; onGuardar: (producto: Producto) => Promise<void>; onCancelar: () => void;
}) {
  const [foto, setFoto] = useState<string>();
  const [errorFoto, setErrorFoto] = useState('');
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const seleccionFoto = useRef(0);
  const proveedores = useQuery({
    queryKey: ['inventario-proveedores'],
    queryFn: async () => (await api.get<Proveedor[]>('/contactos', { params: { tipo: 'PROVEEDOR' } })).data,
  });
  const guardar = useMutation({
    mutationFn: async (formulario: FormData) => {
      const datos = Object.fromEntries(formulario);
      return (await api.post<Producto>(`/inventarios/categorias/${categoriaId}/productos`, {
        datos: {
          ...datos, cantidad: Number(datos.cantidad), stockMinimo: Number(datos.stockMinimo),
          precio: Number(datos.precio), foto,
        },
        proveedorId: datos.proveedorId ? Number(datos.proveedorId) : undefined,
      })).data;
    },
    onSuccess: onGuardar,
  });

  async function elegirFoto(archivo?: File) {
    const solicitud = ++seleccionFoto.current;
    setErrorFoto('');
    setFoto(undefined);
    setProcesandoFoto(Boolean(archivo));
    if (!archivo) return;
    try {
      const resultado = await prepararFoto(archivo);
      if (seleccionFoto.current === solicitud) setFoto(resultado);
    } catch (error) {
      if (seleccionFoto.current === solicitud) setErrorFoto(mensaje(error));
    } finally {
      if (seleccionFoto.current === solicitud) setProcesandoFoto(false);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!procesandoFoto && !guardar.isPending) guardar.mutate(new FormData(evento.currentTarget));
  }

  return <form className={caja} onSubmit={enviar}>
    <h2 className="mb-4 text-lg font-semibold">Ficha del producto</h2>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium">Nombre del producto <input className={campo} name="nombre" maxLength={120} required /></label>
      <label className="text-sm font-medium">Referencia comercial <input className={campo} name="referencia" maxLength={80} /></label>
      <label className="text-sm font-medium">Unidad
        <select className={campo} name="unidad" required>
          <option value="UND">Unidad</option><option value="PAQ">Paquete</option><option value="CAJA">Caja</option>
          <option value="KG">Kilogramo</option><option value="L">Litro</option>
        </select>
      </label>
      <label className="text-sm font-medium">Existencia inicial <input className={campo} type="number" name="cantidad" min="0" step="0.001" defaultValue="0" required /></label>
      <label className="text-sm font-medium">Stock mínimo <input className={campo} type="number" name="stockMinimo" min="0" step="0.001" defaultValue="0" /></label>
      <label className="text-sm font-medium">Precio unitario (COP) <input className={campo} type="number" name="precio" min="0" step="0.01" /></label>
      <label className="text-sm font-medium">Ubicación <input className={campo} name="ubicacion" maxLength={100} placeholder="Ej. Bodega 1, estante A" /></label>
      <label className="text-sm font-medium">Lote <input className={campo} name="lote" maxLength={80} /></label>
      <label className="text-sm font-medium">Vencimiento <input className={campo} name="fechaVencimiento" type="date" /></label>
      <label className="text-sm font-medium">Proveedor
        <select className={campo} name="proveedorId" disabled={proveedores.isPending || proveedores.isError}>
          <option value="">{proveedores.isError ? 'No se pudieron cargar proveedores' : 'Sin proveedor'}</option>
          {(proveedores.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombreRazonSocial}</option>)}
        </select>
      </label>
      <div className="space-y-2 text-sm font-medium">
        <label className="block">Elegir foto <input className={campo} type="file" accept="image/*" onChange={(e) => void elegirFoto(e.target.files?.[0])} /></label>
        <label className="block">Tomar foto con el celular <input className={campo} type="file" accept="image/*" capture="environment" onChange={(e) => void elegirFoto(e.target.files?.[0])} /></label>
        {procesandoFoto && <p role="status">Preparando foto…</p>}
        {foto && <div className="flex items-start gap-3"><img src={foto} alt="Foto seleccionada" className="size-24 rounded-lg object-cover" />
          <button type="button" className={enlace} onClick={() => void elegirFoto()}>Quitar foto</button></div>}
        {errorFoto && <p role="alert" className="text-red-700">{errorFoto}</p>}
      </div>
    </div>
    <p className="my-4 text-sm text-slate-600">El código único se asigna al guardar.</p>
    <div className="flex gap-2">
      <button className={boton} disabled={guardar.isPending || procesandoFoto}>Guardar producto</button>
      <button className={enlace} type="button" disabled={guardar.isPending} onClick={onCancelar}>Cancelar</button>
    </div>
    {guardar.isError && <p role="alert" className="mt-2 text-red-700">{mensaje(guardar.error)}</p>}
  </form>;
}

function Ficha({ producto, inventarioId, onMovimiento }: {
  producto: Producto; inventarioId: number; onMovimiento: () => Promise<void>;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const usuario = useAuthStore((state) => state.usuario);
  const consultaFoto = useQuery({
    queryKey: ['inventario-foto', producto.id],
    queryFn: async () => (await api.get<{ foto: string | null }>(`/inventarios/registros/${producto.id}/foto`)).data,
  });
  const fotoProducto = consultaFoto.data?.foto;
  const actualizarFoto = useMutation({
    mutationFn: async (archivo: File | null) => {
      const foto = archivo ? await prepararFoto(archivo) : null;
      return api.patch(`/inventarios/registros/${producto.id}/foto`, { foto });
    },
    onSuccess: onMovimiento,
  });
  const historial = useQuery({
    queryKey: ['inventario-movimientos', inventarioId, producto.id],
    queryFn: async () => (await api.get<Movimiento[]>(`/inventarios/${inventarioId}/movimientos`, {
      params: { registroId: producto.id },
    })).data,
  });
  const mover = useMutation({
    mutationFn: async (datos: FormData) => api.post(`/inventarios/registros/${producto.id}/movimientos`, {
      tipo: datos.get('tipo'), cantidad: Number(datos.get('cantidad')), observacion: datos.get('observacion'),
    }),
    onSuccess: async () => { formulario.current?.reset(); await onMovimiento(); },
  });

  return <section className={caja}>
    <h2 className="text-lg font-semibold">{nombre(producto)} · {codigo(producto.id)}</h2>
    <dl className="my-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {[
        ['Proveedor', producto.proveedor?.nombreRazonSocial],
        ['Lote', producto.datos.lote],
        ['Vencimiento', String(producto.datos.fechaVencimiento ?? '').slice(0, 10) || undefined],
        ['Stock mínimo', producto.datos.stockMinimo],
      ].map(([etiqueta, valor]) => <div key={etiqueta}><dt className="text-slate-500">{etiqueta}</dt><dd className="font-medium">{valor ?? '—'}</dd></div>)}
    </dl>
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      {fotoProducto?.startsWith('data:image/jpeg;base64,') &&
        <img src={fotoProducto} alt={`Foto de ${nombre(producto)}`} className="size-24 rounded-lg object-cover" />}
      {tienePermiso(usuario, 'PRODUCTOS_EDITAR') && <label className="font-medium">Actualizar foto
        <input className={campo} type="file" accept="image/*" disabled={actualizarFoto.isPending} onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) actualizarFoto.mutate(archivo);
          e.target.value = '';
        }} />
      </label>}
      {tienePermiso(usuario, 'PRODUCTOS_EDITAR') && fotoProducto && <button type="button" className={enlace} disabled={actualizarFoto.isPending} onClick={() => actualizarFoto.mutate(null)}>Quitar foto</button>}
      {consultaFoto.isError && <p role="alert" className="text-red-700">{mensaje(consultaFoto.error)}</p>}
      {actualizarFoto.isPending && <p role="status">Guardando foto…</p>}
      {actualizarFoto.isError && <p role="alert" className="text-red-700">{mensaje(actualizarFoto.error)}</p>}
    </div>
    {producto.datos.cantidad !== undefined && tienePermiso(usuario, 'INVENTARIOS_MOVIMIENTOS') && <form ref={formulario} className="flex flex-wrap items-end gap-3 border-y border-slate-100 py-4" onSubmit={(evento) => {
      evento.preventDefault();
      mover.mutate(new FormData(evento.currentTarget));
    }}>
      <label className="text-sm font-medium">Movimiento
        <select className={campo} name="tipo"><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste a cantidad final</option></select>
      </label>
      <label className="text-sm font-medium">Cantidad <input className={campo} name="cantidad" type="number" min="0" step="0.001" required /></label>
      <label className="min-w-48 flex-1 text-sm font-medium">Motivo <input className={campo} name="observacion" maxLength={250} required /></label>
      <button className={boton} disabled={mover.isPending}>Registrar movimiento</button>
    </form>}
    {mover.isError && <p role="alert" className="mt-2 text-red-700">{mensaje(mover.error)}</p>}
    {mover.isSuccess && <p role="status" className="mt-2 text-emerald-800">Movimiento registrado.</p>}
    <h3 className="mt-5 font-semibold">Historial de existencias</h3>
    {historial.isPending && <p>Cargando movimientos…</p>}
    {historial.isError && <p role="alert">{mensaje(historial.error)}</p>}
    {historial.isSuccess && !historial.data.length && <p className="mt-2 text-sm text-slate-600">Aún no hay movimientos registrados.</p>}
    <ul className="mt-2 divide-y divide-slate-100 text-sm">{historial.data?.map((movimiento) => <li key={movimiento.id} className="flex flex-wrap justify-between gap-2 py-2">
      <span><strong>{movimiento.tipo}</strong> · {movimiento.cantidadAnterior} → {movimiento.cantidadNueva} · {movimiento.observacion || 'Sin observación'}</span>
      <time dateTime={movimiento.fechaCreacion}>{new Date(movimiento.fechaCreacion).toLocaleString('es-CO')}</time>
    </li>)}</ul>
  </section>;
}
