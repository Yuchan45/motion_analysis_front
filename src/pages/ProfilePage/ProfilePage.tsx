import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { apiAssetUrl } from "../../shared/api/apiClient";

const DICEBEAR_STYLES = ["waves", "stack", "stripes", "initial-face", "patchwork"];
type AvatarSource = "none" | "upload" | "generated" | undefined;

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarSource, setAvatarSource] = useState<AvatarSource>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [diceBearStyle, setDiceBearStyle] = useState("waves");
  const [diceBearSeed, setDiceBearSeed] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const [gridSeed, setGridSeed] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  useEffect(() => {
    setDisplayName(user?.profile.displayName ?? user?.username ?? "");
    setBio(user?.profile.bio ?? "");
    setAvatarSource(undefined);
    setAvatarFile(null);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview("");
  }, [user]);
  useEffect(() => {
    if (!avatarModalOpen) return;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAvatarModalOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [avatarModalOpen]);

  const generatedPreview = useMemo(() => `https://api.dicebear.com/10.x/${diceBearStyle}/svg?seed=${encodeURIComponent(diceBearSeed)}`, [diceBearSeed, diceBearStyle]);
  const avatarOptions = useMemo(() => Array.from({ length: 16 }, (_, index) => ({ style: DICEBEAR_STYLES[index % DICEBEAR_STYLES.length], seed: `${gridSeed}-${index}` })), [gridSeed]);
  if (!user) return null;

  const avatar = user.profile.avatar;
  const currentName = user.profile.displayName?.trim() || user.username;
  const preview = avatarSource === "upload" ? localPreview : avatarSource === "generated" ? generatedPreview : avatarSource === "none" ? "" : avatar?.url ? apiAssetUrl(avatar.url) : "";
  const isDirty = displayName !== (user.profile.displayName ?? user.username) || bio !== (user.profile.bio ?? "") || avatarSource !== undefined;

  function chooseLocalAvatar(file: File | null) {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setAvatarFile(file);
    setLocalPreview(file ? URL.createObjectURL(file) : "");
    if (file) setAvatarSource("upload");
  }

  function selectGeneratedAvatar(style: string, seed: string) {
    setDiceBearStyle(style);
    setDiceBearSeed(seed);
    setAvatarSource("generated");
    setAvatarModalOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (!isDirty) return;
    setSaving(true);
    setError("");
    try {
      const data = new FormData();
      if (displayName !== (user.profile.displayName ?? user.username)) data.set("displayName", displayName);
      if (bio !== (user.profile.bio ?? "")) data.set("bio", bio);
      if (avatarSource) {
        data.set("avatarSource", avatarSource);
        if (avatarSource === "upload" && avatarFile) data.set("avatar", avatarFile);
        if (avatarSource === "generated") { data.set("diceBearStyle", diceBearStyle); data.set("diceBearSeed", diceBearSeed); }
      }
      await updateProfile(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar los cambios.");
    } finally { setSaving(false); }
  }

  return <main className="profile-shell">
    <section className="profile-heading"><div><p className="eyebrow">Cuenta</p><h1>Tu perfil.</h1><p>Personalizá cómo aparecés dentro de Motion Analysis.</p></div><Link to="/" className="profile-back-link">Volver a la biblioteca</Link></section>
    <section className="profile-card" aria-labelledby="profile-form-title">
      <div className="profile-avatar-section">
        {preview ? <img className="profile-avatar" src={preview} alt={`Avatar de ${currentName}`} /> : <span className="profile-avatar profile-initials" aria-label={`Inicial de ${currentName}`}>{currentName.slice(0, 1).toUpperCase()}</span>}
        <div><p className="panel-index">IMAGEN DE PERFIL</p><h2>{currentName}</h2><p className="profile-muted">Elegí una imagen local, un avatar generado o usá tus iniciales.</p><div className="profile-avatar-actions"><label>Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseLocalAvatar(event.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => setAvatarModalOpen(true)}>Elegir avatar</button><button type="button" onClick={() => { setAvatarSource("none"); setAvatarFile(null); if (localPreview) URL.revokeObjectURL(localPreview); setLocalPreview(""); }}>Usar iniciales</button></div></div>
      </div>
      <form className="profile-form" onSubmit={submit}>
        <h2 id="profile-form-title">Información pública</h2>
        <label>Nombre visible<input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Bio<textarea value={bio} maxLength={280} rows={4} onChange={(event) => setBio(event.target.value)} /></label>
        <p className="profile-character-count">{bio.length}/280</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="profile-save-row"><button className="analyze-button" type="submit" disabled={!isDirty || saving}>{saving ? "Guardando..." : "Guardar cambios"}</button><p>Los cambios se aplican a tu perfil y al navbar inmediatamente.</p></div>
      </form>
      <section className="profile-account-data" aria-labelledby="account-data-title"><h2 id="account-data-title">Datos de cuenta</h2><dl><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Username</dt><dd>@{user.username}</dd></div><div><dt>Plan</dt><dd>{user.role}</dd></div><div><dt>Miembro desde</dt><dd>{new Date(user.createdAt).toLocaleDateString()}</dd></div></dl></section>
    </section>
    {avatarModalOpen && <div className="avatar-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAvatarModalOpen(false); }}><section className="avatar-modal" role="dialog" aria-modal="true" aria-labelledby="profile-avatar-modal-title"><header><div><p className="eyebrow">DiceBear</p><h2 id="profile-avatar-modal-title">Elegí un avatar</h2></div><button ref={closeRef} className="modal-close" type="button" aria-label="Cerrar selector de avatar" onClick={() => setAvatarModalOpen(false)}>×</button></header><p className="modal-description">Elegí una opción o generá una nueva grilla.</p><div className="avatar-grid">{avatarOptions.map((option) => <button key={`${option.style}-${option.seed}`} type="button" aria-label={`Elegir avatar ${option.style}`} onClick={() => selectGeneratedAvatar(option.style, option.seed)}><img src={`https://api.dicebear.com/10.x/${option.style}/svg?seed=${encodeURIComponent(option.seed)}`} alt="" /></button>)}</div><footer><button type="button" className="avatar-regenerate" onClick={() => setGridSeed(crypto.randomUUID().replaceAll("-", ""))}>Generar nuevas opciones</button><button type="button" className="modal-done" onClick={() => setAvatarModalOpen(false)}>Listo</button></footer></section></div>}
  </main>;
}
