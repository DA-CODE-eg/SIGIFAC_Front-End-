import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type TipoCampo = 'TEXTO' | 'NUMERO' | 'FECHA' | 'BOOLEANO' | 'SELECCION';
type RolContacto = 'NINGUNO' | 'CLIENTES' | 'PROVEEDORES' | 'INVENTARIO';

interface CampoDefinicion {
  id: number;
  nombreCampo: string;
  etiqueta: string;
  tipoDato: TipoCampo;
  esObligatorio: boolean;
}

interface Modulo {
  id: number;
  nombreModulo: string;
  descripcion: string | null;
  rolContacto: RolContacto;
  campoNombreId: number | null;
  campoCorreoId: number | null;
  campoCantidadId: number | null;
  campoPrecioId: number | null;
  campoVencimientoId: number | null;
  campos: CampoDefinicion[];
}

interface Registro {
  id: number;
  datos: Record<string, any>;
  fechaCreacion: string;
}

const etiquetaRol: Record<RolContacto, string> = {
  NINGUNO: '',
  CLIENTES: 'Clientes',
  PROVEEDORES: 'Proveedores',
  INVENTARIO: 'Inventario',
};

const colorRol: Record<RolContacto, string> = {
  NINGUNO: '',
  CLIENTES: 'bg-emerald/10 text-emerald',
  PROVEEDORES: 'bg-amber/15 text-amber',
  INVENTARIO: 'bg-ink/10 text-ink',
};

export default function ModulosGestion() {
  const queryClient = useQueryClient();
  const [moduloSeleccionadoId, setModuloSeleccionadoId] = useState<number | null>(null);
  const [nombreModulo, setNombreModulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  const { data: modulos, isLoading: cargandoModulos } = useQuery<Modulo[]>({
    queryKey: ['modulos'],
    queryFn: async () => (await api.get('/modulos')).data,
  });

  const crearModulo = useMutation({
    mutationFn: async () => api.post('/modulos', { nombreModulo, descripcion: descripcion || undefined }),
    onSuccess: async (res: any) => {
      await queryClient.invalidateQueries({ queryKey: ['modulos'] });
      setNombreModulo('');
      setDescripcion('');
      setMostrarNuevo(false);
      if (res?.data?.id) setModuloSeleccionadoId(res.data.id);
    },
  });

  const moduloActivo = modulos?.find((m) => m.id === moduloSeleccionadoId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
      {/* Columna izquierda: lista de módulos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink">Tus módulos</h2>
          <button
            onClick={() => setMostrarNuevo((v) => !v)}
            className="text-sm text-emerald hover:underline"
          >
            {mostrarNuevo ? 'Cancelar' : '+ Nuevo'}
          </button>
        </div>

        {mostrarNuevo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crearModulo.mutate();
            }}
            className="flex flex-col gap-2 mb-4 border-b border-slate-200 pb-4"
          >
            <input
              className="border-b-2 border-slate-300 focus:border-emerald outline-none py-1.5 bg-transparent text-sm"
              placeholder="Nombre (ej. Clientes)"
              value={nombreModulo}
              onChange={(e) => setNombreModulo(e.target.value)}
              required
              autoFocus
            />
            <input
              className="border-b-2 border-slate-300 focus:border-emerald outline-none py-1.5 bg-transparent text-sm"
              placeholder="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <button
              type="submit"
              disabled={crearModulo.isPending}
              className="bg-emerald text-paper rounded-sm px-3 py-1.5 text-sm hover:bg-emerald-light disabled:opacity-60 self-start mt-1"
            >
              {crearModulo.isPending ? 'Creando...' : 'Crear módulo'}
            </button>
            {crearModulo.isError && <p className="text-red-600 text-sm">Error al crear el módulo</p>}
          </form>
        )}

        {cargandoModulos && <p className="text-slate text-sm">Cargando...</p>}
        {!cargandoModulos && modulos?.length === 0 && !mostrarNuevo && (
          <p className="text-slate text-sm">Todavía no has creado ningún módulo.</p>
        )}

        <div className="flex flex-col divide-y divide-slate-100">
          {modulos?.map((m) => (
            <button
              key={m.id}
              onClick={() => setModuloSeleccionadoId(m.id)}
              className={`py-2.5 flex flex-col gap-1 text-left px-2 -mx-2 rounded-sm transition-colors ${
                m.id === moduloSeleccionadoId ? 'bg-emerald/5' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`text-sm ${m.id === moduloSeleccionadoId ? 'text-emerald font-medium' : 'text-ink'}`}>
                {m.nombreModulo}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate text-xs">{m.campos.length} campo(s)</span>
                {m.rolContacto !== 'NINGUNO' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${colorRol[m.rolContacto]}`}>
                    {etiquetaRol[m.rolContacto]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Columna derecha: detalle del módulo elegido */}
      <div>
        {!moduloActivo && (
          <div className="border-l-2 border-slate-200 pl-4 py-1">
            <p className="text-slate text-sm">Elige un módulo de la lista, o crea uno nuevo, para configurarlo aquí.</p>
          </div>
        )}
        {moduloActivo && <DetalleModulo moduloId={moduloActivo.id} />}
      </div>
    </div>
  );
}

function DetalleModulo({ moduloId }: { moduloId: number }) {
  const queryClient = useQueryClient();
  const { data: modulo, isLoading } = useQuery<Modulo>({
    queryKey: ['modulo', moduloId],
    queryFn: async () => (await api.get(`/modulos/${moduloId}`)).data,
  });
  const { data: registros, isLoading: cargandoRegistros } = useQuery<Registro[]>({
    queryKey: ['modulo-registros', moduloId],
    queryFn: async () => (await api.get(`/modulos/${moduloId}/registros`)).data,
  });

  const [nombreCampo, setNombreCampo] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [tipoDato, setTipoDato] = useState<TipoCampo>('TEXTO');
  const [esObligatorio, setEsObligatorio] = useState(false);

  const agregarCampo = useMutation({
    mutationFn: async () =>
      api.post(`/modulos/${moduloId}/campos`, { nombreCampo, etiqueta, tipoDato, esObligatorio }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      setNombreCampo('');
      setEtiqueta('');
      setTipoDato('TEXTO');
      setEsObligatorio(false);
    },
  });

  const [datosNuevoRegistro, setDatosNuevoRegistro] = useState<Record<string, string>>({});
  const crearRegistro = useMutation({
    mutationFn: async () => api.post(`/modulos/${moduloId}/registros`, { datos: datosNuevoRegistro }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo-registros', moduloId] });
      setDatosNuevoRegistro({});
    },
  });

  const [registroEditandoId, setRegistroEditandoId] = useState<number | null>(null);
  const [datosEdicion, setDatosEdicion] = useState<Record<string, string>>({});

  const iniciarEdicionRegistro = (r: Registro, campos: CampoDefinicion[]) => {
    const valores: Record<string, string> = {};
    campos.forEach((c) => {
      valores[c.nombreCampo] = r.datos[c.nombreCampo] ?? '';
    });
    setRegistroEditandoId(r.id);
    setDatosEdicion(valores);
  };

  const actualizarRegistro = useMutation({
    mutationFn: async (registroId: number) =>
      api.patch(`/modulos/${moduloId}/registros/${registroId}`, { datos: datosEdicion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo-registros', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['inventario-items'] });
      setRegistroEditandoId(null);
    },
  });

  const borrarRegistro = useMutation({
    mutationFn: async (registroId: number) => api.delete(`/modulos/${moduloId}/registros/${registroId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo-registros', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['inventario-items'] });
    },
  });

  const [editandoModulo, setEditandoModulo] = useState(false);
  const [nombreModuloEdit, setNombreModuloEdit] = useState('');
  const [descripcionModuloEdit, setDescripcionModuloEdit] = useState('');

  const iniciarEdicionModulo = () => {
    if (!modulo) return;
    setNombreModuloEdit(modulo.nombreModulo);
    setDescripcionModuloEdit(modulo.descripcion ?? '');
    setEditandoModulo(true);
  };

  const actualizarModulo = useMutation({
    mutationFn: async () =>
      api.patch(`/modulos/${moduloId}`, {
        nombreModulo: nombreModuloEdit,
        descripcion: descripcionModuloEdit || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      queryClient.invalidateQueries({ queryKey: ['inventario-modulos'] });
      setEditandoModulo(false);
    },
  });

  const borrarModulo = useMutation({
    mutationFn: async () => api.delete(`/modulos/${moduloId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      queryClient.invalidateQueries({ queryKey: ['inventario-modulos'] });
      window.location.reload();
    },
  });

  const [rolContacto, setRolContacto] = useState<RolContacto>('NINGUNO');
  const [campoNombreId, setCampoNombreId] = useState('');
  const [campoCorreoId, setCampoCorreoId] = useState('');
  const [campoCantidadId, setCampoCantidadId] = useState('');
  const [campoPrecioId, setCampoPrecioId] = useState('');
  const [campoVencimientoId, setCampoVencimientoId] = useState('');

  useEffect(() => {
    if (!modulo) return;
    setRolContacto(modulo.rolContacto);
    setCampoNombreId(modulo.campoNombreId ? String(modulo.campoNombreId) : '');
    setCampoCorreoId(modulo.campoCorreoId ? String(modulo.campoCorreoId) : '');
    setCampoCantidadId(modulo.campoCantidadId ? String(modulo.campoCantidadId) : '');
    setCampoPrecioId(modulo.campoPrecioId ? String(modulo.campoPrecioId) : '');
    setCampoVencimientoId(modulo.campoVencimientoId ? String(modulo.campoVencimientoId) : '');
  }, [modulo]);

  const esClienteOProveedor = rolContacto === 'CLIENTES' || rolContacto === 'PROVEEDORES';

  const guardarRolContacto = useMutation({
    mutationFn: async () =>
      api.patch(`/modulos/${moduloId}/rol-contacto`, {
        rolContacto,
        campoNombreId: rolContacto === 'NINGUNO' ? undefined : campoNombreId ? Number(campoNombreId) : undefined,
        campoCorreoId: esClienteOProveedor ? Number(campoCorreoId) : undefined,
        campoCantidadId: rolContacto === 'INVENTARIO' && campoCantidadId ? Number(campoCantidadId) : undefined,
        campoPrecioId: rolContacto === 'INVENTARIO' && campoPrecioId ? Number(campoPrecioId) : undefined,
        campoVencimientoId: rolContacto === 'INVENTARIO' && campoVencimientoId ? Number(campoVencimientoId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      queryClient.invalidateQueries({ queryKey: ['inventario-modulos'] });
    },
  });

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [trabajoId, setTrabajoId] = useState<number | null>(null);

  const subirArchivo = useMutation({
    mutationFn: async (archivo: File) => {
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('tipoDestino', 'MODULO');
      formData.append('moduloId', String(moduloId));
      const { data } = await api.post('/carga-masiva', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setTrabajoId(data.id);
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
    },
  });

  const { data: estadoTrabajo } = useQuery({
    queryKey: ['carga-masiva', trabajoId],
    queryFn: async () => (await api.get(`/carga-masiva/${trabajoId}`)).data,
    enabled: trabajoId !== null,
    refetchInterval: (query) =>
      query.state.data?.estado === 'COMPLETADO' || query.state.data?.estado === 'CON_ERRORES' ? false : 1500,
  });

  const selectClass = 'border-b-2 border-slate-300 focus:border-emerald outline-none py-2 bg-transparent text-sm';
  const inputClass = 'border-b-2 border-slate-300 focus:border-emerald outline-none py-2 bg-transparent text-sm';

  if (isLoading || !modulo) {
    return <p className="text-slate text-sm">Cargando...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado del módulo */}
      <div>
        {!editandoModulo ? (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-2xl text-ink mb-1">{modulo.nombreModulo}</h1>
              {modulo.descripcion && <p className="text-slate text-sm">{modulo.descripcion}</p>}
            </div>
            <div className="flex gap-4 shrink-0">
              <button onClick={iniciarEdicionModulo} className="text-sm text-emerald hover:underline">
                Editar
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Borrar el módulo "${modulo.nombreModulo}" y todos sus registros? Esto no se puede deshacer.`)) {
                    borrarModulo.mutate();
                  }
                }}
                disabled={borrarModulo.isPending}
                className="text-sm text-red-600 hover:underline disabled:opacity-60"
              >
                {borrarModulo.isPending ? 'Borrando...' : 'Borrar módulo'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className={inputClass + ' flex-1'}
              value={nombreModuloEdit}
              onChange={(e) => setNombreModuloEdit(e.target.value)}
              placeholder="Nombre del módulo"
            />
            <input
              className={inputClass + ' flex-1'}
              value={descripcionModuloEdit}
              onChange={(e) => setDescripcionModuloEdit(e.target.value)}
              placeholder="Descripción (opcional)"
            />
            <div className="flex gap-4 items-center">
              <button
                onClick={() => actualizarModulo.mutate()}
                disabled={actualizarModulo.isPending}
                className="bg-emerald text-paper rounded-sm px-4 py-2 text-sm hover:bg-emerald-light disabled:opacity-60"
              >
                {actualizarModulo.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditandoModulo(false)} className="text-slate hover:text-ink text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rol + Carga masiva, lado a lado en pantallas anchas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="font-display text-lg text-ink mb-1">Rol de este módulo</h2>
          <p className="text-slate text-sm mb-3">
            Márcalo si guarda clientes, proveedores o inventario, para que Notificaciones y Facturación puedan usarlo.
          </p>
          <div className="flex flex-col gap-2">
            <select className={selectClass} value={rolContacto} onChange={(e) => setRolContacto(e.target.value as RolContacto)}>
              <option value="NINGUNO">Ningún rol especial</option>
              <option value="CLIENTES">Este módulo es mis Clientes</option>
              <option value="PROVEEDORES">Este módulo es mis Proveedores</option>
              <option value="INVENTARIO">Este módulo es un Inventario</option>
            </select>

            {rolContacto !== 'NINGUNO' && modulo.campos.length === 0 && (
              <p className="text-amber text-sm">Agrega al menos un campo antes de marcarlo.</p>
            )}

            {esClienteOProveedor && modulo.campos.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <select className={selectClass} value={campoNombreId} onChange={(e) => setCampoNombreId(e.target.value)}>
                  <option value="">¿Nombre?</option>
                  {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                </select>
                <select className={selectClass} value={campoCorreoId} onChange={(e) => setCampoCorreoId(e.target.value)}>
                  <option value="">¿Correo?</option>
                  {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                </select>
              </div>
            )}

            {rolContacto === 'INVENTARIO' && modulo.campos.length > 0 && (
              <>
                <p className="text-slate text-xs">Mapeos opcionales — sin ellos no calcula totales ni avisa vencimientos.</p>
                <div className="grid grid-cols-2 gap-3">
                  <select className={selectClass} value={campoNombreId} onChange={(e) => setCampoNombreId(e.target.value)}>
                    <option value="">¿Nombre?</option>
                    {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                  </select>
                  <select className={selectClass} value={campoCantidadId} onChange={(e) => setCampoCantidadId(e.target.value)}>
                    <option value="">¿Cantidad?</option>
                    {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                  </select>
                  <select className={selectClass} value={campoPrecioId} onChange={(e) => setCampoPrecioId(e.target.value)}>
                    <option value="">¿Precio?</option>
                    {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                  </select>
                  <select className={selectClass} value={campoVencimientoId} onChange={(e) => setCampoVencimientoId(e.target.value)}>
                    <option value="">¿Vencimiento?</option>
                    {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                  </select>
                </div>
              </>
            )}

            <button
              onClick={() => guardarRolContacto.mutate()}
              disabled={guardarRolContacto.isPending || (esClienteOProveedor && (!campoNombreId || !campoCorreoId))}
              className="bg-emerald text-paper rounded-sm px-4 py-2 text-sm hover:bg-emerald-light disabled:opacity-60 self-start mt-1"
            >
              {guardarRolContacto.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            {guardarRolContacto.isSuccess && <p className="text-emerald text-sm">Guardado.</p>}
            {guardarRolContacto.isError && (
              <p className="text-red-600 text-sm">{(guardarRolContacto.error as any)?.response?.data?.message ?? 'Error al guardar'}</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-ink mb-1">Carga masiva</h2>
          <p className="text-slate text-sm mb-3">
            Sube un CSV o Excel — el encabezado de cada columna debe coincidir con un campo de este módulo.
          </p>
          <input
            ref={inputArchivoRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subirArchivo.mutate(archivo);
            }}
            className="text-sm"
          />
          {subirArchivo.isPending && <p className="text-slate text-sm mt-2">Subiendo archivo...</p>}
          {subirArchivo.isError && <p className="text-red-600 text-sm mt-2">Error al subir el archivo.</p>}
          {estadoTrabajo && (
            <div className="text-sm mt-3">
              <p className="text-ink">Estado: <strong>{estadoTrabajo.estado}</strong>{estadoTrabajo.totalFilas > 0 && ` — ${estadoTrabajo.filasProcesadas}/${estadoTrabajo.totalFilas} filas`}</p>
              {estadoTrabajo.filasError > 0 && (
                <details className="mt-1">
                  <summary className="text-amber cursor-pointer">{estadoTrabajo.filasError} fila(s) con error</summary>
                  <ul className="text-xs text-slate mt-1 list-disc pl-4">
                    {(estadoTrabajo.detalleErrores ?? []).map((e: any, i: number) => <li key={i}>Fila {e.fila}: {e.error}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Campos + formulario de agregar, lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8">
        <div>
          <h2 className="font-display text-lg text-ink mb-3">Campos</h2>
          <div className="flex flex-col divide-y divide-slate-100">
            {modulo.campos.map((c) => (
              <div key={c.id} className="py-2 text-sm text-ink flex items-baseline justify-between">
                <span>{c.etiqueta}</span>
                <span className="text-slate text-xs">{c.tipoDato.toLowerCase()}{c.esObligatorio ? ' · obligatorio' : ''}</span>
              </div>
            ))}
            {modulo.campos.length === 0 && <p className="text-slate text-sm py-2">Sin campos todavía.</p>}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-ink mb-3">Agregar campo</h2>
          <form onSubmit={(e) => { e.preventDefault(); agregarCampo.mutate(); }} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} placeholder="Nombre técnico (ej. correo)" value={nombreCampo} onChange={(e) => setNombreCampo(e.target.value)} required />
              <input className={inputClass} placeholder="Etiqueta visible" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} required />
            </div>
            <div className="flex items-center gap-4">
              <select className={selectClass} value={tipoDato} onChange={(e) => setTipoDato(e.target.value as TipoCampo)}>
                <option value="TEXTO">Texto</option>
                <option value="NUMERO">Número</option>
                <option value="FECHA">Fecha</option>
                <option value="BOOLEANO">Sí/No</option>
                <option value="SELECCION">Selección</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={esObligatorio} onChange={(e) => setEsObligatorio(e.target.checked)} />
                Obligatorio
              </label>
            </div>
            <button type="submit" disabled={agregarCampo.isPending} className="bg-emerald text-paper rounded-sm px-4 py-2 text-sm hover:bg-emerald-light disabled:opacity-60 self-start">
              {agregarCampo.isPending ? 'Agregando...' : 'Agregar campo'}
            </button>
          </form>
        </div>
      </div>

      {/* Registros */}
      <div>
        <h2 className="font-display text-lg text-ink mb-3">Registros</h2>

        {modulo.campos.length > 0 && (
          <form
            onSubmit={(e) => { e.preventDefault(); crearRegistro.mutate(); }}
            className="flex flex-wrap items-end gap-3 mb-6 pb-6 border-b border-slate-200"
          >
            {modulo.campos.map((c) => (
              <input
                key={c.id}
                className={inputClass + ' flex-1 min-w-[160px]'}
                placeholder={c.etiqueta}
                value={datosNuevoRegistro[c.nombreCampo] ?? ''}
                onChange={(e) => setDatosNuevoRegistro((prev) => ({ ...prev, [c.nombreCampo]: e.target.value }))}
                required={c.esObligatorio}
              />
            ))}
            <button type="submit" disabled={crearRegistro.isPending} className="bg-emerald text-paper rounded-sm px-4 py-2 text-sm hover:bg-emerald-light disabled:opacity-60">
              {crearRegistro.isPending ? 'Guardando...' : 'Agregar'}
            </button>
          </form>
        )}

        {cargandoRegistros && <p className="text-slate text-sm">Cargando...</p>}

        {registros && registros.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate">
                {modulo.campos.map((c) => (
                  <th key={c.id} className="py-2 font-medium pr-4">{c.etiqueta}</th>
                ))}
                <th className="py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((r) =>
                registroEditandoId === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={modulo.campos.length + 1} className="py-3">
                      <div className="flex flex-wrap items-end gap-3">
                        {modulo.campos.map((c) => (
                          <input
                            key={c.id}
                            className={inputClass + ' flex-1 min-w-[140px]'}
                            placeholder={c.etiqueta}
                            value={datosEdicion[c.nombreCampo] ?? ''}
                            onChange={(e) => setDatosEdicion((prev) => ({ ...prev, [c.nombreCampo]: e.target.value }))}
                            required={c.esObligatorio}
                          />
                        ))}
                        <button
                          onClick={() => actualizarRegistro.mutate(r.id)}
                          disabled={actualizarRegistro.isPending}
                          className="bg-emerald text-paper rounded-sm px-3 py-2 text-sm hover:bg-emerald-light disabled:opacity-60"
                        >
                          {actualizarRegistro.isPending ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => setRegistroEditandoId(null)} className="text-slate hover:text-ink text-sm px-2">
                          Cancelar
                        </button>
                      </div>
                      {actualizarRegistro.isError && <p className="text-red-600 text-sm mt-1">Error al guardar</p>}
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    {modulo.campos.map((c) => (
                      <td key={c.id} className="py-2.5 text-ink pr-4">{r.datos[c.nombreCampo] ?? '—'}</td>
                    ))}
                    <td className="py-2.5 text-right">
                      <div className="flex gap-4 justify-end">
                        <button onClick={() => iniciarEdicionRegistro(r, modulo.campos)} className="text-sm text-emerald hover:underline">
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('¿Borrar este registro?')) borrarRegistro.mutate(r.id);
                          }}
                          disabled={borrarRegistro.isPending}
                          className="text-sm text-red-600 hover:underline disabled:opacity-60"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
        {registros?.length === 0 && <p className="text-slate text-sm">Sin registros todavía.</p>}
      </div>
    </div>
  );
}