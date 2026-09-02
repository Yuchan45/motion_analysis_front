import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { apiAssetUrl } from "../shared/api/apiClient";

export function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const avatar = user?.profile.avatar;
  const displayName = user?.profile.displayName?.trim() || user?.username || "Perfil";
  const initial = displayName.slice(0, 1).toUpperCase();

  return <div className="authenticated-shell">
    <header className="masthead app-navbar">
      <Link className="brand" to="/" aria-label="Motion Analysis, inicio">
        <span className="brand-mark" aria-hidden="true">MA</span>
        Motion Analysis
      </Link>
      <div className="navbar-user-actions">
        <Link className="navbar-profile-link" to="/profile" aria-label="Abrir mi perfil">
          {avatar?.url
            ? <img className="header-avatar" src={apiAssetUrl(avatar.url)} alt="" />
            : <span className="header-avatar initials" aria-hidden="true">{initial}</span>}
          <span>{displayName}</span>
        </Link>
        <button className="navbar-logout" type="button" onClick={() => void logout()}>Salir</button>
      </div>
    </header>
    <Outlet />
  </div>;
}
