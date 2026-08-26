import { postForm } from "../../../shared/api/apiClient";
import { Analysis, Correction, SlowMotionSegment } from "../types/videoAnalysis.types";

export function analyzeVideo(file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("video", file);
  return postForm("/analyze", formData);
}

type RenderVideoInput = {
  video: File;
  analysis: Analysis;
  corrections: Correction[];
  slowMotionSegments: SlowMotionSegment[];
};

export function renderVideo({
  video,
  analysis,
  corrections,
  slowMotionSegments,
}: RenderVideoInput): Promise<Response> {
  const formData = new FormData();
  formData.append("video", video);
  formData.append(
    "analysis",
    new Blob([JSON.stringify(analysis)], { type: "application/json" }),
    "analysis.json",
  );
  formData.append("corrections", JSON.stringify({ corrections }));
  formData.append(
    "slow_motion",
    JSON.stringify({
      segments: slowMotionSegments.map(({ start_frame, end_frame, speed }) => ({
        start_frame,
        end_frame,
        speed,
      })),
    }),
  );
  return postForm("/render", formData);
}
