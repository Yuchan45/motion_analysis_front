import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";

const DICEBEAR_STYLES = ["waves", "stack", "stripes", "initial-face", "patchwork"];

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarSource, setAvatarSource] = useState<"none" | "upload" | "generated">("none");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [diceBearStyle, setDiceBearStyle] = useState("waves");
  const [diceBearSeed, setDiceBearSeed] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const [avatarGridSeed, setAvatarGridSeed] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const diceBearCloseRef = useRef<HTMLButtonElement>(null);
  const uploadCloseRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = mode === "login";

  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);
  useEffect(() => {
    if (!avatarModalOpen && !uploadModalOpen) return;
    (avatarModalOpen ? diceBearCloseRef : uploadCloseRef).current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAvatarModalOpen(false); setUploadModalOpen(false); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [avatarModalOpen, uploadModalOpen]);

  const diceBearPreview = useMemo(() => `https://api.dicebear.com/10.x/${diceBearStyle}/svg?seed=${encodeURIComponent(diceBearSeed)}`, [diceBearSeed, diceBearStyle]);
  const avatarOptions = useMemo(() => Array.from({ length: 16 }, (_, index) => {
    const style = DICEBEAR_STYLES[index % DICEBEAR_STYLES.length];
    return { style, seed: `${avatarGridSeed}-${index}` };
  }), [avatarGridSeed]);
  if (user) return <Navigate to="/" replace />;

  function chooseLocalAvatar(file: File | null) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
    if (file) setAvatarSource("upload");
    setUploadModalOpen(false);
  }

  function selectGeneratedAvatar(style: string, seed: string) {
    setDiceBearStyle(style);
    setDiceBearSeed(seed);
    setAvatarSource("generated");
    setAvatarModalOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (isLogin) await login(email, password);
      else {
        const data = new FormData();
        data.set("email", email);
        data.set("username", username);
        data.set("password", password);
        data.set("avatarSource", avatarSource);
        if (avatarSource === "generated") { data.set("diceBearStyle", diceBearStyle); data.set("diceBearSeed", diceBearSeed); }
        if (avatarSource === "upload" && avatarFile) data.set("avatar", avatarFile);
        await register(data);
      }
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar la sesión.");
    } finally { setBusy(false); }
  }

  const selectedPreview = avatarSource === "generated" ? diceBearPreview : avatarPreview;
  const selectedLabel = avatarSource === "generated" ? diceBearStyle : avatarFile?.name;
  const openUploadModal = () => { setAvatarModalOpen(false); setUploadModalOpen(true); };

  return <main className="auth-shell"><section className={`auth-card ${isLogin ? "is-login" : "is-register"}`}><header className="auth-heading"><span className="brand-mark">MA</span><div><p className="eyebrow">Motion Analysis</p><h1>{isLogin ? "Bienvenido." : "Crear cuenta."}</h1></div></header><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>{!isLogin && <label>Username<input type="text" autoComplete="username" minLength={3} maxLength={30} pattern="[a-z0-9_-]+" required value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} /><small>3–30 caracteres: letras, números, _ o -.</small></label>}<label>Contraseña<input type="password" minLength={8} autoComplete={isLogin ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{!isLogin && <fieldset className="avatar-picker"><legend>Imagen de perfil <small>(opcional)</small></legend><div className="avatar-source-options"><button type="button" className={avatarSource === "none" ? "is-selected" : ""} onClick={() => setAvatarSource("none")}>Iniciales</button><button type="button" className={avatarSource === "upload" ? "is-selected" : ""} onClick={openUploadModal}>Subir imagen</button><button type="button" className={avatarSource === "generated" ? "is-selected" : ""} onClick={() => { setUploadModalOpen(false); setAvatarModalOpen(true); }}>Elegir avatar</button></div>{avatarSource !== "none" && selectedPreview && <div className="chosen-avatar"><img className="avatar-preview" src={selectedPreview} alt="Avatar seleccionado" /><div><strong>Avatar seleccionado</strong><small>{selectedLabel}</small></div><button type="button" onClick={avatarSource === "generated" ? () => setAvatarModalOpen(true) : openUploadModal}>Cambiar</button></div>}</fieldset>}{error && <p className="error-message" role="alert">{error}</p>}<button className="analyze-button" disabled={busy}>{busy ? "Procesando..." : isLogin ? "Iniciar sesión" : "Registrarme"}</button></form><p className="auth-switch">{isLogin ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"} <Link to={isLogin ? "/register" : "/login"}>{isLogin ? "Registrate" : "Iniciá sesión"}</Link></p></section>{avatarModalOpen && <div className="avatar-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAvatarModalOpen(false); }}><section className="avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title"><header><div><p className="eyebrow">DiceBear</p><h2 id="avatar-modal-title">Elegí un avatar</h2></div><button ref={diceBearCloseRef} className="modal-close" type="button" aria-label="Cerrar selector de avatar" onClick={() => setAvatarModalOpen(false)}>×</button></header><p className="modal-description">Elegí una opción o generá una nueva grilla.</p><div className="avatar-grid">{avatarOptions.map((option) => { const selected = diceBearStyle === option.style && diceBearSeed === option.seed; return <button key={`${option.style}-${option.seed}`} type="button" className={selected ? "is-selected" : ""} aria-label={`Elegir avatar ${option.style}`} onClick={() => selectGeneratedAvatar(option.style, option.seed)}><img src={`https://api.dicebear.com/10.x/${option.style}/svg?seed=${encodeURIComponent(option.seed)}`} alt="" />{selected && <span className="avatar-check" aria-label="Seleccionado">✓</span>}</button>; })}</div><footer><button type="button" className="avatar-regenerate" onClick={() => setAvatarGridSeed(crypto.randomUUID().replaceAll("-", ""))}>Generar nuevas opciones</button><button type="button" className="modal-done" onClick={() => setAvatarModalOpen(false)}>Listo</button></footer></section></div>}{uploadModalOpen && <div className="avatar-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUploadModalOpen(false); }}><section className="avatar-modal upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title"><header><div><p className="eyebrow">Imagen local</p><h2 id="upload-modal-title">Subí tu imagen</h2></div><button ref={uploadCloseRef} className="modal-close" type="button" aria-label="Cerrar selector de archivo" onClick={() => setUploadModalOpen(false)}>×</button></header><p className="modal-description">JPEG, PNG o WebP. Máximo 5 MB.</p><label className="upload-dropzone">{avatarPreview ? <img src={avatarPreview} alt="Vista previa de la imagen local" /> : <><span className="upload-symbol">+</span><strong>Elegir archivo</strong><small>Tu imagen se guarda de forma privada.</small></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseLocalAvatar(event.target.files?.[0] ?? null)} /></label>{avatarPreview && <label className="upload-replace">Cambiar archivo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseLocalAvatar(event.target.files?.[0] ?? null)} /></label>}</section></div>}</main>;
}
