import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface Empresa {
  id: number;
  nombreEmpresa: string;
  identificacion: string;
  tipoEmpresa: string;
  correoContacto: string;
  estado: string;
  usuarios: { id: number }[];
}

export default function Empresas() {
  const queryClient = useQueryClient();

  // --- Crear empresa ---
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [errorLocal, setErrorLocal] = useState('');

  // --- Edición inline ---
  const [empresaEditandoId, setEmpresaEditandoId] = useState<number | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [correoEdit, setCorreoEdit] = useState('');
  const [estadoEdit, setEstadoEdit] = useState('ACTIVA');

  // --- Crear acceso a empresa vieja sin usuario ---
  const [empresaAccesoId, setEmpresaAccesoId] = useState<number | null>(null);
  const [nombreAdminAcceso, setNombreAdminAcceso] = useState('');
  const [correoAcceso, setCorreoAcceso] = useState('');
  const [contrasenaAcceso, setContrasenaAcceso] = useState('');
  const [confirmarAcceso, setConfirmarAcceso] = useState('');
  const [errorAcceso, setErrorAcceso] = useState('');

  const { data: empresas, isLoading } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: async () => (await api.get('/empresas')).data,
  });

  const crearEmpresaConAdmin = useMutation({
    mutationFn: async () => {
      const { data: empresa } = await api.post('/empresas', {
        nombreEmpresa,
        identificacion,
        tipoEmpresa: 'PEQUENA',
        correoContacto,
      });
      await api.post('/auth/registro', {
        empresaId: empresa.id,
        nombreCompleto: nombreAdmin,
        correo: correoContacto,
        contrasena,
        rol: 'ADMINISTRADOR',
      });
      return empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setNombreEmpresa('');
      setIdentificacion('');
      setCorreoContacto('');
      setNombreAdmin('');
      setContrasena('');
      setConfirmarContrasena('');
      setErrorLocal('');
    },
  });

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal('');
    if (contrasena.length < 8) {
      setErrorLocal('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (contrasena !== confirmarContrasena) {
      setErrorLocal('Las contraseñas no coinciden.');
      return;
    }
    crearEmpresaConAdmin.mutate();
  };

  const abrirEdicion = (emp: Empresa) => {
    setEmpresaAccesoId(null);
    setEmpresaEditandoId(emp.id);
    setNombreEdit(emp.nombreEmpresa);
    setCorreoEdit(emp.correoContacto);
    setEstadoEdit(emp.estado);
  };

  const guardarEdicion = useMutation({
    mutationFn: async (id: number) =>
      api.patch(`/empresas/${id}`, {
        nombreEmpresa: nombreEdit,
        correoContacto: correoEdit,
        estado: estadoEdit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setEmpresaEditandoId(null);
    },
  });

  const abrirCrearAcceso = (emp: Empresa) => {
    setEmpresaEditandoId(null);
    setEmpresaAccesoId(emp.id);
    setNombreAdminAcceso('');
    setCorreoAcceso(emp.correoContacto);
    setContrasenaAcceso('');
    setConfirmarAcceso('');
    setErrorAcceso('');
  };

  const crearAcceso = useMutation({
    mutationFn: async (empresaId: number) =>
      api.post('/auth/registro', {
        empresaId,
        nombreCompleto: nombreAdminAcceso,
        correo: correoAcceso,
        contrasena: contrasenaAcceso,
        rol: 'ADMINISTRADOR',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setEmpresaAccesoId(null);
    },
  });

  const manejarCrearAcceso = (e: React.FormEvent, empresaId: number) => {
    e.preventDefault();
    setErrorAcceso('');
    if (contrasenaAcceso.length < 8) {
      setErrorAcceso('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (contrasenaAcceso !== confirmarAcceso) {
      setErrorAcceso('Las contraseñas no coinciden.');
      return;
    }
    crearAcceso.mutate(empresaId);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-ink">Empresas registradas</h1>

      <form onSubmit={manejarSubmit} className="flex flex-col gap-2 mb-6 border p-4 rounded-lg">
        <p className="text-sm text-slate -mt-1 mb-1">Datos de la empresa</p>
        <input className="border rounded px-3 py-2" placeholder="Nombre de la empresa" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Identificación (NIT)" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Correo de contacto" type="email" value={correoContacto} onChange={(e) => setCorreoContacto(e.target.value)} required />

        <p className="text-sm text-slate mt-2 -mb-1">Acceso del administrador de la empresa</p>
        <input className="border rounded px-3 py-2" placeholder="Nombre completo del administrador" value={nombreAdmin} onChange={(e) => setNombreAdmin(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Contraseña (mín. 8 caracteres)" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Confirmar contraseña" type="password" value={confirmarContrasena} onChange={(e) => setConfirmarContrasena(e.target.value)} required />

        <button type="submit" disabled={crearEmpresaConAdmin.isPending} className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60">
          {crearEmpresaConAdmin.isPending ? 'Creando...' : 'Crear empresa'}
        </button>

        {errorLocal && <p className="text-red-600 text-sm">{errorLocal}</p>}
        {crearEmpresaConAdmin.isError && (
          <p className="text-red-600 text-sm">
            {(crearEmpresaConAdmin.error as any)?.response?.data?.message ?? 'Error al crear la empresa o su usuario.'}
          </p>
        )}
      </form>

      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {empresas?.map((emp) => {
            const sinUsuario = emp.usuarios.length === 0;
            return (
              <li key={emp.id} className="border rounded p-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <strong>{emp.nombreEmpresa}</strong> — {emp.identificacion}
                    {sinUsuario && <p className="text-amber text-xs mt-0.5">Sin acceso configurado</p>}
                  </div>
                  <div className="text-right flex flex-col items-end gap-1 shrink-0">
                    <span className="text-slate text-sm">{emp.correoContacto}</span>
                    <div className="flex gap-3">
                      <button onClick={() => abrirEdicion(emp)} className="text-sm text-emerald hover:underline">
                        Editar
                      </button>
                      {sinUsuario && (
                        <button onClick={() => abrirCrearAcceso(emp)} className="text-sm text-amber hover:underline">
                          Crear acceso
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {empresaEditandoId === emp.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      guardarEdicion.mutate(emp.id);
                    }}
                    className="mt-3 pt-3 border-t flex flex-col gap-2"
                  >
                    <input className="border rounded px-3 py-2" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} placeholder="Nombre de la empresa" required />
                    <input className="border rounded px-3 py-2" type="email" value={correoEdit} onChange={(e) => setCorreoEdit(e.target.value)} placeholder="Correo de contacto" required />
                    <select className="border rounded px-3 py-2" value={estadoEdit} onChange={(e) => setEstadoEdit(e.target.value)}>
                      <option value="ACTIVA">Activa</option>
                      <option value="INACTIVA">Inactiva</option>
                    </select>
                    <div className="flex gap-2">
                      <button type="submit" disabled={guardarEdicion.isPending} className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60">
                        {guardarEdicion.isPending ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button type="button" onClick={() => setEmpresaEditandoId(null)} className="text-slate hover:text-ink px-4 py-2">
                        Cancelar
                      </button>
                    </div>
                    {guardarEdicion.isError && <p className="text-red-600 text-sm">Error al guardar los cambios.</p>}
                  </form>
                )}

                {empresaAccesoId === emp.id && (
                  <form onSubmit={(e) => manejarCrearAcceso(e, emp.id)} className="mt-3 pt-3 border-t flex flex-col gap-2">
                    <p className="text-sm text-slate -mt-1">
                      Esta empresa no tiene ningún usuario. Créale su primer acceso de administrador.
                    </p>
                    <input className="border rounded px-3 py-2" placeholder="Nombre completo del administrador" value={nombreAdminAcceso} onChange={(e) => setNombreAdminAcceso(e.target.value)} required />
                    <input className="border rounded px-3 py-2" type="email" placeholder="Correo de acceso" value={correoAcceso} onChange={(e) => setCorreoAcceso(e.target.value)} required />
                    <input className="border rounded px-3 py-2" type="password" placeholder="Contraseña (mín. 8 caracteres)" value={contrasenaAcceso} onChange={(e) => setContrasenaAcceso(e.target.value)} required />
                    <input className="border rounded px-3 py-2" type="password" placeholder="Confirmar contraseña" value={confirmarAcceso} onChange={(e) => setConfirmarAcceso(e.target.value)} required />
                    <div className="flex gap-2">
                      <button type="submit" disabled={crearAcceso.isPending} className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60">
                        {crearAcceso.isPending ? 'Creando...' : 'Crear acceso'}
                      </button>
                      <button type="button" onClick={() => setEmpresaAccesoId(null)} className="text-slate hover:text-ink px-4 py-2">
                        Cancelar
                      </button>
                    </div>
                    {errorAcceso && <p className="text-red-600 text-sm">{errorAcceso}</p>}
                    {crearAcceso.isError && (
                      <p className="text-red-600 text-sm">
                        {(crearAcceso.error as any)?.response?.data?.message ?? 'Error al crear el acceso.'}
                      </p>
                    )}
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}