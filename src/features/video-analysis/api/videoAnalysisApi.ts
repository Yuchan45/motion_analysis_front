import { apiBlob, apiRequest } from "../../../shared/api/apiClient";
import { AnalysisResource, EditorState, VideoResource } from "../../../shared/api/contracts";
import { Analysis, Correction, SlowMotionSegment } from "../types/videoAnalysis.types";

export type AnalysisSession = { videoId: string; analysisId: string; data: Analysis };

export async function analyzeVideo(file: File, existingVideoId?: string): Promise<AnalysisSession> {
  let videoId = existingVideoId;
  if (!videoId) {
    const form = new FormData();
    form.append("video", file);
    const video = await apiRequest<VideoResource>("/videos", { method: "POST", body: form });
    videoId = video.id;
  }
  const analysis = await apiRequest<AnalysisResource>(`/videos/${videoId}/analyses`, {
    method: "POST",
    body: JSON.stringify({ type: "pose-overlay" }),
  });
  return { videoId, analysisId: analysis.id, data: await apiRequest<Analysis>(`/analyses/${analysis.id}/data`) };
}

export async function loadVideo(videoId: string) {
  const [video, blob] = await Promise.all([
    apiRequest<VideoResource>(`/videos/${videoId}`),
    apiBlob(`/videos/${videoId}/content`),
  ]);
  return { video, file: new File([blob], video.originalFilename, { type: video.mimeType }) };
}

export async function loadAnalysis(videoId: string, analysisId: string) {
  const [{ video, file }, resource, data] = await Promise.all([
    loadVideo(videoId),
    apiRequest<AnalysisResource>(`/analyses/${analysisId}`),
    apiRequest<Analysis>(`/analyses/${analysisId}/data`),
  ]);
  return { video, file, resource, data };
}

export function saveEditorState(analysisId: string, state: EditorState) {
  return apiRequest<AnalysisResource>(`/analyses/${analysisId}/editor-state`, {
    method: "PUT",
    body: JSON.stringify(state),
  });
}

type RenderVideoInput = { analysisId: string; corrections: Correction[]; slowMotionSegments: SlowMotionSegment[] };

export async function renderVideo({ analysisId, corrections, slowMotionSegments }: RenderVideoInput): Promise<Blob> {
  await saveEditorState(analysisId, {
    corrections,
    slowMotionSegments: slowMotionSegments.map(({ start_frame, end_frame, speed }) => ({ start_frame, end_frame, speed })),
  });
  await apiRequest<AnalysisResource>(`/analyses/${analysisId}/render`, { method: "POST" });
  return apiBlob(`/analyses/${analysisId}/result`);
}
