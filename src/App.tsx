import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import AdminShell from './components/AdminShell';
import { tienePermiso } from './lib/permisos';
import { useAuthStore } from './store/auth.store';

const AccesoDenegado = lazy(() => import('./pages/AccesoDenegado'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminEmpresaDetalle = lazy(() => import('./pages/AdminEmpresaDetalle'));
const AdminEmpresas = lazy(() => import('./pages/AdminEmpresas'));
const CargaMasiva = lazy(() => import('./pages/CargaMasiva'));
const Certificacion = lazy(() => import('./pages/Certificacion'));
const CertificarPublico = lazy(() => import('./pages/CertificarPublico'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Facturas = lazy(() => import('./pages/Facturas'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Login = lazy(() => import('./pages/Login'));
const Notificaciones = lazy(() => import('./pages/Notificaciones'));
const Productos = lazy(() => import('./pages/Productos1'));
const Proveedores = lazy(() => import('./pages/Proveedores'));
const Reportes = lazy(() => import('./pages/Reportes'));
const RolesPermisos = lazy(() => import('./pages/RolesPermisos'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Validar = lazy(() => import('./pages/Validar'));
const Verificar = lazy(() => import('./pages/Verificar'));
const VerificarCertificado = lazy(() => import('./pages/VerificarCertificado'));

function CargaRuta() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}

function RutaTenant({ children, permiso }: { children: React.ReactNode; permiso?: string }) {
  const token = useAuthStore((state) => state.token);
  const usuario = useAuthStore((state) => state.usuario);

  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (usuario.rol === 'SUPER_ADMIN' && !usuario.modoEmpresa) return <Navigate to="/admin" replace />;
  if (!tienePermiso(usuario, permiso)) return <AppShell><AccesoDenegado /></AppShell>;

  return <AppShell>{children}</AppShell>;
}

function RutaSuperAdmin({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const usuario = useAuthStore((state) => state.usuario);

  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;

  return <AdminShell>{children}</AdminShell>;
}

function Entrada() {
  const token = useAuthStore((state) => state.token);
  const usuario = useAuthStore((state) => state.usuario);

  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (usuario.rol === 'SUPER_ADMIN' && !usuario.modoEmpresa) return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<CargaRuta />}>
      <Routes>
        <Route path="/certificar/:token" element={<CertificarPublico />} />
        <Route path="/verificar-certificado/:codigo" element={<VerificarCertificado />} />
        <Route path="/verificar/:codigoQr" element={<Verificar />} />
        <Route path="/login" element={<Login />} />

        <Route path="/admin" element={<RutaSuperAdmin><AdminDashboard /></RutaSuperAdmin>} />
        <Route path="/admin/empresas" element={<RutaSuperAdmin><AdminEmpresas /></RutaSuperAdmin>} />
        <Route path="/admin/empresas/:id" element={<RutaSuperAdmin><AdminEmpresaDetalle /></RutaSuperAdmin>} />

        <Route path="/dashboard" element={<RutaTenant permiso="DASHBOARD_VER"><Dashboard /></RutaTenant>} />
        <Route path="/productos" element={<RutaTenant permiso="PRODUCTOS_VER"><Productos /></RutaTenant>} />
        <Route path="/inventario" element={<RutaTenant permiso="INVENTARIOS_VER"><Inventario /></RutaTenant>} />
        <Route path="/carga-masiva" element={<RutaTenant permiso="CARGA_MASIVA"><CargaMasiva /></RutaTenant>} />
        <Route path="/clientes" element={<RutaTenant permiso="CLIENTES_VER"><Clientes /></RutaTenant>} />
        <Route path="/proveedores" element={<RutaTenant permiso="PROVEEDORES_VER"><Proveedores /></RutaTenant>} />
        <Route path="/contactos" element={<Navigate to="/clientes" replace />} />
        <Route path="/facturas" element={<RutaTenant permiso="FACTURAS_VER"><Facturas /></RutaTenant>} />
        <Route path="/certificacion" element={<RutaTenant permiso="CERTIFICACION_VER"><Certificacion /></RutaTenant>} />
        <Route path="/modulos" element={<Navigate to="/inventario" replace />} />
        <Route path="/validar" element={<RutaTenant permiso="CERTIFICACION_VER"><Validar /></RutaTenant>} />
        <Route path="/notificaciones" element={<RutaTenant permiso="NOTIFICACIONES_VER"><Notificaciones /></RutaTenant>} />
        <Route path="/reportes" element={<RutaTenant permiso="REPORTES_VER"><Reportes /></RutaTenant>} />
        <Route path="/usuarios" element={<RutaTenant permiso="USUARIOS_VER"><Usuarios /></RutaTenant>} />
        <Route path="/roles" element={<RutaTenant permiso="ROLES_VER"><RolesPermisos /></RutaTenant>} />

        <Route path="/" element={<Entrada />} />
        <Route path="*" element={<Entrada />} />
      </Routes>
    </Suspense>
  );
}
