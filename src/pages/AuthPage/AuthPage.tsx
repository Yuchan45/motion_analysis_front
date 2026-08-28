import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await (mode === "login" ? login(email, password) : register(email, password)); navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo iniciar la sesión."); }
    finally { setBusy(false); }
  }
  const isLogin = mode === "login";
  return <main className="auth-shell"><section className="auth-card"><span className="brand-mark">MA</span><p className="eyebrow">Motion Analysis</p><h1>{isLogin ? "Volvé a tus análisis." : "Creá tu espacio de trabajo."}</h1><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" minLength={8} autoComplete={isLogin ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error-message" role="alert">{error}</p>}<button className="analyze-button" disabled={busy}>{busy ? "Procesando..." : isLogin ? "Iniciar sesión" : "Registrarme"}</button></form><p>{isLogin ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"} <Link to={isLogin ? "/register" : "/login"}>{isLogin ? "Registrate" : "Iniciá sesión"}</Link></p></section></main>;
}
