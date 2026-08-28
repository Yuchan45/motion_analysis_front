import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { apiRequest } from "../../shared/api/apiClient";
import { AnalysisResource, VideoResource } from "../../shared/api/contracts";

type LibraryItem = VideoResource & { analyses: AnalysisResource[] };
export function DashboardPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try { const videos = await apiRequest<VideoResource[]>("/videos"); setItems(await Promise.all(videos.map(async (video) => ({ ...video, analyses: await apiRequest<AnalysisResource[]>(`/videos/${video.id}/analyses`) })))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar la biblioteca."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function remove(video: VideoResource) { if (!window.confirm(`¿Eliminar ${video.title} y todos sus análisis?`)) return; await apiRequest<void>(`/videos/${video.id}`, { method: "DELETE" }); setItems((current) => current.filter((item) => item.id !== video.id)); }
  async function rename(video: VideoResource) { const title = window.prompt("Nuevo título", video.title)?.trim(); if (!title || title === video.title) return; await apiRequest(`/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ title }) }); await load(); }
  return <main className="library-shell"><header className="masthead"><span className="brand"><span className="brand-mark">MA</span>Motion Analysis</span><span className="library-user">{user?.email}<button type="button" onClick={() => void logout()}>Salir</button></span></header><section className="library-hero"><div><p className="eyebrow">Tu biblioteca</p><h1>Videos y análisis, siempre disponibles.</h1></div><Link className="primary-link" to="/analysis/new">+ Subir video</Link></section>{error && <p className="error-message">{error}</p>}{loading ? <p>Cargando videos...</p> : items.length === 0 ? <section className="empty-library"><p>Todavía no subiste ningún video.</p><Link to="/analysis/new">Crear el primer análisis</Link></section> : <section className="video-grid">{items.map((video) => <article className="video-card" key={video.id}><div><span className="panel-index">{new Date(video.createdAt).toLocaleDateString()}</span><h2>{video.title}</h2><p>{video.originalFilename} · {(video.sizeBytes / 1024 / 1024).toFixed(1)} MB</p></div><div className="video-card-actions"><Link to={`/videos/${video.id}/new`}>Nuevo análisis</Link><button onClick={() => void rename(video)}>Renombrar</button><button onClick={() => void remove(video)}>Eliminar</button></div><ul className="analysis-history">{video.analyses.map((analysis) => <li key={analysis.id}><Link to={`/videos/${video.id}/analyses/${analysis.id}`}>{analysis.type} {analysis.version}</Link><span className={`status status-${analysis.status.toLowerCase()}`}>{analysis.status}</span></li>)}{video.analyses.length === 0 && <li>Sin análisis todavía.</li>}</ul></article>)}</section>}</main>;
}
