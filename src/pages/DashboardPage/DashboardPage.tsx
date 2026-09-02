// @ts-nocheck
import { AddOutlined, DeleteOutlined as DeleteOutline, EditOutlined, PlayCircleOutlined as PlayCircleOutline } from "@mui/icons-material";
import { Alert, Box, Chip, IconButton, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { apiRequest } from "../../shared/api/apiClient";
import { AnalysisResource, VideoResource } from "../../shared/api/contracts";
import { AppButton } from "../../shared/ui/AppButton";
import { AppCard } from "../../shared/ui/AppCard";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";

type LibraryItem = VideoResource & { analyses: AnalysisResource[] };

export function DashboardPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const videos = await apiRequest<VideoResource[]>("/videos");
      setItems(await Promise.all(videos.map(async (video) => ({ ...video, analyses: await apiRequest<AnalysisResource[]>(`/videos/${video.id}/analyses`) }))));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar la biblioteca."); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function remove(video: VideoResource) { if (!window.confirm(`¿Eliminar ${video.title} y todos sus análisis?`)) return; await apiRequest<void>(`/videos/${video.id}`, { method: "DELETE" }); setItems((current) => current.filter((item) => item.id !== video.id)); }
  async function rename(video: VideoResource) { const title = window.prompt("Nuevo título", video.title)?.trim(); if (!title || title === video.title) return; await apiRequest(`/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ title }) }); await load(); }

  return <Box component="main" className="library-shell"><PageHeader eyebrow="Tu biblioteca" title="Videos y análisis." description="Retomá un análisis, revisá su estado o empezá un nuevo video." action={<AppButton component={RouterLink} to="/analysis/new" startIcon={<AddOutlined />}>Subir video</AppButton>} />
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {loading ? <Stack gap={2}>{[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={190} />)}</Stack> : items.length === 0 ? <EmptyState title="Tu biblioteca está vacía" description="Subí un video para iniciar tu primer análisis de movimiento." action={<AppButton component={RouterLink} to="/analysis/new" startIcon={<AddOutlined />}>Crear análisis</AppButton>} /> : <Box className="video-grid">{items.map((video) => <AppCard component="article" key={video.id} className="video-card" sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}><Box><Typography variant="caption" color="text.secondary">{new Date(video.createdAt).toLocaleDateString()}</Typography><Typography variant="h5" sx={{ mt: 0.5 }}>{video.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{video.originalFilename} · {(video.sizeBytes / 1024 / 1024).toFixed(1)} MB</Typography></Box><Stack direction="row"><Tooltip title="Renombrar"><IconButton size="small" onClick={() => void rename(video)}><EditOutlined fontSize="small" /></IconButton></Tooltip><Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => void remove(video)}><DeleteOutline fontSize="small" /></IconButton></Tooltip></Stack></Stack><AppButton component={RouterLink} to={`/videos/${video.id}/new`} variant="outlined" startIcon={<PlayCircleOutline />}>Nuevo análisis</AppButton><Stack component="ul" gap={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>{video.analyses.map((analysis) => <Stack component="li" key={analysis.id} direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography component={RouterLink} to={`/videos/${video.id}/analyses/${analysis.id}`} variant="body2" color="primary" fontWeight={700} sx={{ textDecoration: "none" }}>{analysis.type} {analysis.version}</Typography><Chip size="small" label={analysis.status} color={analysis.status === "COMPLETED" ? "success" : analysis.status === "FAILED" ? "error" : "default"} /></Stack>)}{video.analyses.length === 0 && <Typography component="li" variant="body2" color="text.secondary">Sin análisis todavía.</Typography>}</Stack></AppCard>)}</Box>}</Box>;
}
