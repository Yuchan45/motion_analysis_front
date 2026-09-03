import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { CloudUploadOutlined, DownloadOutlined, FullscreenOutlined, RestartAltOutlined } from "@mui/icons-material";
import { Toast, ToastAction, ToastType } from "../../shared/ui/Toast";
import hawkLogo from "../../assets/brand/hawk_white.png";
import {
  analyzeVideo as analyzeVideoRequest,
  loadAnalysis as loadAnalysisRequest,
  loadVideo as loadVideoRequest,
  renderVideo as renderVideoRequest,
  saveEditorState,
} from "./api/videoAnalysisApi";
import {
  Analysis,
  Correction,
  Landmark,
  SlowMotionSegment,
  SlowMotionSpeed,
} from "./types/videoAnalysis.types";

const BODY_LANDMARK_INDICES = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
] as const;

const LANDMARK_NAMES: Record<number, string> = {
  11: "Hombro izq.", 12: "Hombro der.", 13: "Codo izq.", 14: "Codo der.",
  15: "Mano izq.", 16: "Mano der.",
  23: "Cadera izq.", 24: "Cadera der.", 25: "Rodilla izq.", 26: "Rodilla der.",
  27: "Tobillo izq.", 28: "Tobillo der.", 29: "Talón izq.", 30: "Talón der.",
  31: "Pie izq.", 32: "Pie der.",
};

type RequestState = "idle" | "analyzing" | "editing" | "exporting" | "complete" | "error";

type SlowMotionDraft = Pick<SlowMotionSegment, "start_frame" | "end_frame">;
type DragState = { landmarkIndex: number; pointerId: number };
type TimelineDragState = {
  pointerId: number;
  mode: "scrub" | "create" | "resize-start" | "resize-end";
  segmentId?: number;
  anchorFrame: number;
};
type ToastState = {
  id: number;
  type: ToastType;
  message?: string;
  autoCloseMs?: number | null;
  actions?: ToastAction[];
  onClose?: () => void;
};
type FrameCallbackVideo = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
};

const WORKFLOW_STEPS = ["Cargar y analizar", "Revisar y ajustar", "Generar MP4"];
const MIN_PORTRAIT_VIEWER_ASPECT_RATIO = 0.9;
const SLOW_MOTION_SPEEDS: SlowMotionSpeed[] = [0.5, 0.25, 0.125];

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function correctionKey(frameIndex: number, landmarkIndex: number): string {
  return `${frameIndex}:${landmarkIndex}`;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function frameFromTime(time: number, analysis: Analysis): number {
  let low = 0;
  let high = analysis.frame_times.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (analysis.frame_times[middle] <= time + 0.0001) low = middle + 1;
    else high = middle - 1;
  }
  return Math.min(analysis.metadata.frame_count - 1, Math.max(0, high));
}

function playbackSpeedForFrame(frameIndex: number, segments: SlowMotionSegment[]): number {
  return segments.find((segment) => (
    frameIndex >= segment.start_frame && frameIndex <= segment.end_frame
  ))?.speed ?? 1;
}

function mediaViewport(
  containerWidth: number,
  containerHeight: number,
  mediaWidth: number,
  mediaHeight: number,
) {
  const scale = Math.min(containerWidth / mediaWidth, containerHeight / mediaHeight);
  const width = mediaWidth * scale;
  const height = mediaHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

function correctedLandmarks(
  frameIndex: number,
  landmarks: Landmark[],
  corrections: Record<string, Correction>,
): Landmark[] {
  const values = Object.values(corrections);
  return landmarks.map((landmark, position) => {
    const landmarkIndex = BODY_LANDMARK_INDICES[position];
    const keyframes = values
      .filter((correction) => correction.landmark_index === landmarkIndex)
      .sort((first, second) => first.frame_index - second.frame_index);
    const before = [...keyframes].reverse().find((item) => item.frame_index <= frameIndex);
    const after = keyframes.find((item) => item.frame_index >= frameIndex);
    if (!before || !after) return landmark;

    if (before.frame_index === after.frame_index) {
      return { ...landmark, x: before.x, y: before.y };
    }
    const progress = (frameIndex - before.frame_index) / (after.frame_index - before.frame_index);
    return {
      ...landmark,
      x: before.x + progress * (after.x - before.x),
      y: before.y + progress * (after.y - before.y),
    };
  });
}

type VideoAnalysisFeatureProps = { initialVideoId?: string; initialAnalysisId?: string };

export default function VideoAnalysisFeature({ initialVideoId, initialAnalysisId }: VideoAnalysisFeatureProps) {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(initialVideoId ?? null);
  const [analysisId, setAnalysisId] = useState<string | null>(initialAnalysisId ?? null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [corrections, setCorrections] = useState<Record<string, Correction>>({});
  const [slowMotionSegments, setSlowMotionSegments] = useState<SlowMotionSegment[]>([]);
  const [slowMotionDraft, setSlowMotionDraft] = useState<SlowMotionDraft | null>(null);
  const [selectedSlowMotionId, setSelectedSlowMotionId] = useState<number | null>(null);
  const [isSlowMotionMode, setIsSlowMotionMode] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedLandmark, setSelectedLandmark] = useState<number | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [viewedStep, setViewedStep] = useState(1);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const correctionsRef = useRef(corrections);
  const analysisRef = useRef(analysis);
  const drawOverlayRef = useRef<(frameIndex: number) => void>(() => undefined);
  const dragRef = useRef<DragState | null>(null);
  const timelineDragRef = useRef<TimelineDragState | null>(null);
  const currentFrameRef = useRef(currentFrame);
  const slowMotionRef = useRef(slowMotionSegments);
  const slowMotionIdRef = useRef(0);

  correctionsRef.current = corrections;
  analysisRef.current = analysis;
  currentFrameRef.current = currentFrame;
  slowMotionRef.current = slowMotionSegments;

  useEffect(() => {
    if (!initialVideoId) return;
    let cancelled = false;
    setRequestState("analyzing");
    const load = async () => {
      try {
        if (initialAnalysisId) {
          const session = await loadAnalysisRequest(initialVideoId, initialAnalysisId);
          if (cancelled) return;
          const restoredSegments = session.resource.editorState.slowMotionSegments.map((segment, index) => ({ ...segment, id: index + 1 }));
          slowMotionIdRef.current = restoredSegments.length;
          setSelectedVideo(session.file);
          setSourceUrl(URL.createObjectURL(session.file));
          setAnalysis(session.data);
          setCorrections(Object.fromEntries(session.resource.editorState.corrections.map((item) => [correctionKey(item.frame_index, item.landmark_index), item])));
          setSlowMotionSegments(restoredSegments);
          setVideoId(initialVideoId);
          setAnalysisId(initialAnalysisId);
          setRequestState("editing");
          setViewedStep(2);
          setSaveState("saved");
        } else {
          const session = await loadVideoRequest(initialVideoId);
          if (cancelled) return;
          setSelectedVideo(session.file);
          setSourceUrl(URL.createObjectURL(session.file));
          setVideoId(initialVideoId);
          setRequestState("idle");
        }
      } catch (error) {
        if (cancelled) return;
        setRequestState("error");
        setFailedStep(1);
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el análisis.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [initialAnalysisId, initialVideoId]);

  useEffect(() => {
    if (!analysisId || !analysis || requestState !== "editing") return;
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      void saveEditorState(analysisId, {
        corrections: Object.values(corrections),
        slowMotionSegments: slowMotionSegments.map(({ start_frame, end_frame, speed }) => ({ start_frame, end_frame, speed })),
      }).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [analysis, analysisId, corrections, requestState, slowMotionSegments]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!analysis || !workspace) {
      setStageSize(null);
      return;
    }

    const resizeStage = () => {
      const videoAspectRatio = analysis.metadata.width / analysis.metadata.height;
      const viewerAspectRatio = Math.max(videoAspectRatio, MIN_PORTRAIT_VIEWER_ASPECT_RATIO);
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const maxHeight = Math.max(180, viewportHeight - 105);
      const height = Math.min(maxHeight, workspace.clientWidth / viewerAspectRatio);
      setStageSize({ width: Math.round(height * viewerAspectRatio), height: Math.round(height) });
    };

    resizeStage();
    const observer = new ResizeObserver(resizeStage);
    const viewport = window.visualViewport;
    observer.observe(workspace);
    window.addEventListener("resize", resizeStage);
    viewport?.addEventListener("resize", resizeStage);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeStage);
      viewport?.removeEventListener("resize", resizeStage);
    };
  }, [analysis]);

  function drawOverlay(frameIndex: number) {
    const currentAnalysis = analysisRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!currentAnalysis || !video || !canvas || !video.videoWidth || !video.videoHeight) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const canvasWidth = Math.round(canvas.clientWidth * pixelRatio);
    const canvasHeight = Math.round(canvas.clientHeight * pixelRatio);
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const viewport = mediaViewport(canvas.width, canvas.height, video.videoWidth, video.videoHeight);

    const frame = currentAnalysis.frames[frameIndex];
    if (!frame) return;
    const isEstimatedFrame = currentAnalysis.estimated_frames?.[frameIndex] ?? false;
    const landmarks = correctedLandmarks(frameIndex, frame, correctionsRef.current);
    const landmarkMap = new Map(
      currentAnalysis.landmark_indices.map((index, position) => [index, landmarks[position]]),
    );

    context.strokeStyle = isEstimatedFrame ? "#f2ad3d" : "#c4e844";
    context.lineWidth = 1.5 * pixelRatio;
    for (const [start, end] of POSE_CONNECTIONS) {
      const startPoint = landmarkMap.get(start);
      const endPoint = landmarkMap.get(end);
      if (!startPoint || !endPoint) continue;
      context.beginPath();
      context.moveTo(viewport.x + startPoint.x * viewport.width, viewport.y + startPoint.y * viewport.height);
      context.lineTo(viewport.x + endPoint.x * viewport.width, viewport.y + endPoint.y * viewport.height);
      context.stroke();
    }

    for (const [index, landmark] of landmarkMap) {
      const x = viewport.x + landmark.x * viewport.width;
      const y = viewport.y + landmark.y * viewport.height;
      context.beginPath();
      context.fillStyle = index === selectedLandmark ? "#ffffff" : isEstimatedFrame ? "#f2ad3d" : "#ff4a18";
      context.arc(x, y, (index === selectedLandmark ? 4 : 2.5) * pixelRatio, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#142226";
      context.lineWidth = pixelRatio;
      context.stroke();
    }
  }

  drawOverlayRef.current = drawOverlay;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !analysis) return;
    let animationFrame = 0;
    let videoFrameCallback = 0;
    const frameVideo = video as FrameCallbackVideo;
    const paint = (mediaTime: number) => {
      const nextFrame = frameFromTime(mediaTime, analysis);
      video.playbackRate = playbackSpeedForFrame(nextFrame, slowMotionRef.current);
      currentFrameRef.current = nextFrame;
      setCurrentFrame((previous) => (previous === nextFrame ? previous : nextFrame));
      drawOverlayRef.current(nextFrame);
    };
    const schedule = () => {
      if (video.paused || video.ended) return;
      if (frameVideo.requestVideoFrameCallback) {
        videoFrameCallback = frameVideo.requestVideoFrameCallback((_, metadata) => {
          paint(metadata.mediaTime);
          schedule();
        });
      } else {
        animationFrame = requestAnimationFrame(() => {
          paint(video.currentTime);
          schedule();
        });
      }
    };
    const start = () => schedule();
    const seeked = () => paint(video.currentTime);
    const pause = () => {
      const pausedFrame = frameFromTime(video.currentTime, analysis);
      drawOverlayRef.current(pausedFrame);
    };
    video.addEventListener("play", start);
    video.addEventListener("pause", pause);
    video.addEventListener("seeked", seeked);
    return () => {
      cancelAnimationFrame(animationFrame);
      if (videoFrameCallback && frameVideo.cancelVideoFrameCallback) {
        frameVideo.cancelVideoFrameCallback(videoFrameCallback);
      }
      video.removeEventListener("play", start);
      video.removeEventListener("pause", pause);
      video.removeEventListener("seeked", seeked);
    };
  }, [analysis]);

  useEffect(() => {
    drawOverlay(currentFrame);
  }, [analysis, corrections, currentFrame, selectedLandmark, stageSize, isFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackSpeedForFrame(currentFrame, slowMotionSegments);
  }, [currentFrame, slowMotionSegments]);

  function closeToast() {
    setToast((currentToast) => {
      currentToast?.onClose?.();
      return null;
    });
  }

  function showToast(nextToast: Omit<ToastState, "id">) {
    toastIdRef.current += 1;
    setToast({ ...nextToast, id: toastIdRef.current });
  }

  function applySelectedVideo(file: File) {
    setSelectedVideo(file);
    setVideoId(null);
    setAnalysisId(null);
    setSourceUrl(URL.createObjectURL(file));
    setResultUrl(null);
    setAnalysis(null);
    setCorrections({});
    setSlowMotionSegments([]);
    setSlowMotionDraft(null);
    setSelectedSlowMotionId(null);
    setIsSlowMotionMode(false);
    setCurrentFrame(0);
    setSelectedLandmark(null);
    setStageSize(null);
    setErrorMessage("");
    setFailedStep(null);
    setViewedStep(1);
    setRequestState("idle");
    setSaveState("idle");
  }

  function cancelPendingVideo() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectVideo(file: File | null) {
    if (!file) return;
    if (analysis || resultUrl) {
      showToast({
        type: "warning",
        message: "Al analizar otro video se perderan los marcadores y el video actualmente en progreso.",
        actions: [
          { label: "Cancelar", tone: "secondary", onClick: closeToast },
          {
            label: "Analizar otro video",
            onClick: () => {
              applySelectedVideo(file);
              setToast(null);
            },
          },
        ],
        onClose: cancelPendingVideo,
      });
      return;
    }
    applySelectedVideo(file);
  }

  async function startAnalysis() {
    if (!selectedVideo || requestState === "analyzing" || requestState === "exporting") return;

    setRequestState("analyzing");
    setErrorMessage("");
    setFailedStep(null);
    try {
      const session = await analyzeVideoRequest(selectedVideo, videoId ?? undefined);
      setVideoId(session.videoId);
      setAnalysisId(session.analysisId);
      setAnalysis(session.data);
      setCorrections({});
      setSlowMotionSegments([]);
      setSlowMotionDraft(null);
      setSelectedSlowMotionId(null);
      setIsSlowMotionMode(false);
      setCurrentFrame(0);
      setRequestState("editing");
      setSaveState("saved");
      setViewedStep(2);
      showToast({ type: "success", message: "Landmarks listos para revisar.", autoCloseMs: 3500 });
    } catch (error) {
      setRequestState("error");
      setErrorMessage(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
      setFailedStep(1);
      setViewedStep(1);
    }
  }

  function analyzeVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void startAnalysis();
  }

  function requestReanalysis() {
    showToast({
      type: "warning",
      message: "Reanalizar creara una nueva entrada en el historial y conservara este analisis.",
      actions: [
        { label: "Cancelar", tone: "secondary", onClick: closeToast },
        {
          label: "Reanalizar desde cero",
          onClick: () => {
            setToast(null);
            void startAnalysis();
          },
        },
      ],
    });
  }

  function goToFrame(nextFrame: number) {
    if (!analysis || !videoRef.current) return;
    const frame = Math.min(analysis.metadata.frame_count - 1, Math.max(0, nextFrame));
    const video = videoRef.current;
    video.pause();
    currentFrameRef.current = frame;
    setCurrentFrame(frame);
    video.playbackRate = playbackSpeedForFrame(frame, slowMotionRef.current);
    // Use the source timestamps so manual stepping matches variable-frame-rate video too.
    video.currentTime = analysis.frame_times[frame] ?? frame / analysis.metadata.fps;
  }

  function timelineFrameFromPointer(event: PointerEvent<HTMLDivElement>): number | null {
    if (!analysis || !timelineRef.current) return null;
    const bounds = timelineRef.current.getBoundingClientRect();
    if (!bounds.width) return null;
    const progress = clamp((event.clientX - bounds.left) / bounds.width);
    return Math.round(progress * (analysis.metadata.frame_count - 1));
  }

  function availableRange(anchorFrame: number, excludingId?: number): { start: number; end: number } {
    if (!analysis) return { start: 0, end: 0 };
    const segments = slowMotionSegments
      .filter((segment) => segment.id !== excludingId)
      .sort((first, second) => first.start_frame - second.start_frame);
    const previous = [...segments].reverse().find((segment) => segment.end_frame < anchorFrame);
    const next = segments.find((segment) => segment.start_frame > anchorFrame);
    return {
      start: previous ? previous.end_frame + 1 : 0,
      end: next ? next.start_frame - 1 : analysis.metadata.frame_count - 1,
    };
  }

  function startTimelineDrag(event: PointerEvent<HTMLDivElement>) {
    const frame = timelineFrameFromPointer(event);
    if (frame === null) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-segment-handle]");
    const segmentElement = target.closest<HTMLElement>("[data-segment-id]");

    if (!isSlowMotionMode) {
      timelineDragRef.current = { pointerId: event.pointerId, mode: "scrub", anchorFrame: frame };
      goToFrame(frame);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (handle && segmentElement) {
      const segmentId = Number(segmentElement.dataset.segmentId);
      const mode = handle.dataset.segmentHandle === "start" ? "resize-start" : "resize-end";
      timelineDragRef.current = { pointerId: event.pointerId, mode, segmentId, anchorFrame: frame };
      setSelectedSlowMotionId(segmentId);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (segmentElement) {
      const segmentId = Number(segmentElement.dataset.segmentId);
      setSelectedSlowMotionId(segmentId);
      goToFrame(frame);
      return;
    }

    const available = availableRange(frame);
    if (frame < available.start || frame > available.end) return;
    timelineDragRef.current = { pointerId: event.pointerId, mode: "create", anchorFrame: frame };
    setSelectedSlowMotionId(null);
    setSlowMotionDraft({ start_frame: frame, end_frame: frame });
    goToFrame(frame);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateTimelineDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = timelineDragRef.current;
    const frame = timelineFrameFromPointer(event);
    if (!drag || frame === null || !analysis) return;

    if (drag.mode === "scrub") {
      goToFrame(frame);
      return;
    }

    if (drag.mode === "create") {
      const available = availableRange(drag.anchorFrame);
      const endFrame = Math.min(available.end, Math.max(available.start, frame));
      setSlowMotionDraft({
        start_frame: Math.min(drag.anchorFrame, endFrame),
        end_frame: Math.max(drag.anchorFrame, endFrame),
      });
      goToFrame(endFrame);
      return;
    }

    setSlowMotionSegments((segments) => segments.map((segment) => {
      if (segment.id !== drag.segmentId) return segment;
      const available = availableRange(
        drag.mode === "resize-start" ? segment.end_frame : segment.start_frame,
        segment.id,
      );
      if (drag.mode === "resize-start") {
        const start = Math.min(segment.end_frame - 1, Math.max(available.start, frame));
        return { ...segment, start_frame: start };
      }
      const end = Math.max(segment.start_frame + 1, Math.min(available.end, frame));
      return { ...segment, end_frame: end };
    }));
  }

  function stopTimelineDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = timelineDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    timelineDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.mode === "create") {
      setSlowMotionDraft((draft) => (
        draft && draft.end_frame > draft.start_frame ? draft : null
      ));
    }
  }

  function addSlowMotionSegment(speed: SlowMotionSpeed) {
    if (!slowMotionDraft) return;
    slowMotionIdRef.current += 1;
    const segment = { ...slowMotionDraft, speed, id: slowMotionIdRef.current };
    setSlowMotionSegments((segments) => [...segments, segment].sort(
      (first, second) => first.start_frame - second.start_frame,
    ));
    setSelectedSlowMotionId(segment.id);
    setSlowMotionDraft(null);
  }

  function updateSelectedSlowMotionSpeed(speed: SlowMotionSpeed) {
    if (selectedSlowMotionId === null) return;
    setSlowMotionSegments((segments) => segments.map((segment) => (
      segment.id === selectedSlowMotionId ? { ...segment, speed } : segment
    )));
  }

  function removeSelectedSlowMotionSegment() {
    if (selectedSlowMotionId === null) return;
    setSlowMotionSegments((segments) => segments.filter((segment) => segment.id !== selectedSlowMotionId));
    setSelectedSlowMotionId(null);
  }

  function toggleSlowMotionMode() {
    if (isSlowMotionMode) {
      setSlowMotionDraft(null);
      setSelectedSlowMotionId(null);
    }
    setIsSlowMotionMode(!isSlowMotionMode);
  }

  function updateDraggedLandmark(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const video = videoRef.current;
    if (!video) return;
    const viewport = mediaViewport(bounds.width, bounds.height, video.videoWidth, video.videoHeight);
    const x = clamp((event.clientX - bounds.left - viewport.x) / viewport.width);
    const y = clamp((event.clientY - bounds.top - viewport.y) / viewport.height);
    const correction: Correction = {
      frame_index: currentFrame,
      landmark_index: drag.landmarkIndex,
      x,
      y,
    };
    setCorrections((previous) => ({
      ...previous,
      [correctionKey(currentFrame, drag.landmarkIndex)]: correction,
    }));
  }

  function startDragging(event: PointerEvent<HTMLCanvasElement>) {
    if (!analysis || !analysis.frames[currentFrame] || !videoRef.current?.paused) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const video = videoRef.current;
    const viewport = mediaViewport(bounds.width, bounds.height, video.videoWidth, video.videoHeight);
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    if (
      pointerX < viewport.x || pointerX > viewport.x + viewport.width ||
      pointerY < viewport.y || pointerY > viewport.y + viewport.height
    ) return;
    const x = (pointerX - viewport.x) / viewport.width;
    const y = (pointerY - viewport.y) / viewport.height;
    const landmarks = correctedLandmarks(currentFrame, analysis.frames[currentFrame], corrections);
    let closestIndex: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    landmarks.forEach((landmark, position) => {
      const distance = Math.hypot((landmark.x - x) * viewport.width, (landmark.y - y) * viewport.height);
      if (distance < closestDistance) {
        closestIndex = BODY_LANDMARK_INDICES[position];
        closestDistance = distance;
      }
    });

    if (closestIndex === null || closestDistance > 18) return;
    dragRef.current = { landmarkIndex: closestIndex, pointerId: event.pointerId };
    setSelectedLandmark(closestIndex);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDraggedLandmark(event);
  }

  function stopDragging(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function undoCurrentCorrection() {
    if (selectedLandmark === null) return;
    setCorrections((previous) => {
      const next = { ...previous };
      delete next[correctionKey(currentFrame, selectedLandmark)];
      return next;
    });
  }

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
    } else {
      await stage.requestFullscreen();
    }
  }

  function returnToEditor() {
    setRequestState("editing");
    setFailedStep(null);
    setErrorMessage("");
    setViewedStep(2);
  }

  async function exportVideo() {
    if (!analysisId || !analysis || requestState === "exporting") return;
    setRequestState("exporting");
    setErrorMessage("");
    setFailedStep(null);
    setViewedStep(3);
    try {
      const result = await renderVideoRequest({
        analysisId,
        corrections: Object.values(corrections),
        slowMotionSegments,
      });
      setResultUrl(URL.createObjectURL(result));
      setRequestState("complete");
      showToast({ type: "success", message: "El MP4 corregido esta listo.", autoCloseMs: 4000 });
    } catch (error) {
      setRequestState("error");
      setErrorMessage(error instanceof Error ? error.message : "No se pudo exportar el video.");
      setFailedStep(3);
      setViewedStep(3);
    }
  }

  const isBusy = requestState === "analyzing" || requestState === "exporting";
  const hasPose = Boolean(analysis?.frames[currentFrame]);
  const hasEstimatedPose = Boolean(analysis?.estimated_frames?.[currentFrame]);
  const activeStep = failedStep ?? (requestState === "exporting" || requestState === "complete"
    ? 3
    : analysis
      ? 2
      : 1);
  const workflowMessage = failedStep
    ? errorMessage
    : requestState === "analyzing"
    ? "Subiendo y detectando landmarks"
    : requestState === "exporting"
      ? "Generando el MP4 corregido"
      : requestState === "complete"
        ? "MP4 listo para reproducir o descargar"
        : analysis
          ? "Pausa el video y ajusta los marcadores necesarios"
          : "Selecciona un video para comenzar";
  const selectedCorrection = selectedLandmark !== null
    ? corrections[correctionKey(currentFrame, selectedLandmark)]
    : undefined;
  const selectedSlowMotion = slowMotionSegments.find((segment) => segment.id === selectedSlowMotionId);
  const outputFrameCount = analysis
    ? analysis.metadata.frame_count + slowMotionSegments.reduce(
      (total, segment) => total + (segment.end_frame - segment.start_frame + 1) * (1 / segment.speed - 1),
      0,
    )
    : 0;

  return (
    <main className="page-shell">
      <header className="workflow-toolbar">
        <a className="brand" href="/" aria-label="Motion Analysis, inicio">
          <span className="brand-mark" aria-hidden="true"><img src={hawkLogo} alt="" /></span>
          Motion Analysis
        </a>
        <nav className="workflow-stepper" aria-label="Progreso del analisis">
          <ol className="workflow-steps">
            {WORKFLOW_STEPS.map((label, index) => {
              const step = index + 1;
              const canNavigate = !isBusy && step <= activeStep;
              const state = step === failedStep
                ? "is-error"
                : step < activeStep || (step === 3 && requestState === "complete")
                ? "is-complete"
                : step === activeStep
                  ? "is-active"
                  : "is-pending";
              return (
                <li key={label} className={`workflow-step ${state} ${canNavigate ? "is-navigable" : ""}`}>
                  <button
                    className="workflow-step-control"
                    type="button"
                    onClick={() => setViewedStep(step)}
                    disabled={!canNavigate}
                    aria-current={step === viewedStep ? "step" : undefined}
                    aria-label={`${label}${canNavigate ? ", abrir paso" : ", aun no disponible"}`}
                  >
                    <span className="step-dot">{step}</span>
                    <span className="step-label">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="visually-hidden" role="status" aria-live="polite">{workflowMessage}</p>
        </nav>
        <span className="version">MVP / EDITOR</span>
      </header>

      <div className="workflow-viewport">
        <div className="workflow-track" style={{ transform: `translateX(-${(viewedStep - 1) * 100}%)` }}>
          <section className="workflow-panel upload-view" aria-labelledby="page-title">
            <div className="hero-copy">
              <p className="eyebrow">Pose correction for pitching</p>
              <h1 id="page-title">Ajusta el frame que el modelo no pudo leer.</h1>
              <p className="intro">Carga un video, revisa el skeleton y exporta una version corregida.</p>
            </div>
            <form className={`upload-panel ${selectedVideo ? "has-selected-video" : ""}`} onSubmit={analyzeVideo}>
              <span className="panel-index">01 / ANALISIS</span>
              <input ref={inputRef} className="visually-hidden" id="pitch-video" type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mkv" onChange={(event) => selectVideo(event.target.files?.[0] ?? null)} />
              <button className="file-picker" type="button" onClick={() => { if (inputRef.current) inputRef.current.value = ""; inputRef.current?.click(); }} disabled={isBusy}>
                <CloudUploadOutlined className="picker-symbol" aria-hidden="true" />
                <span><strong>{selectedVideo ? "Cambiar video" : "Seleccionar video"}</strong><small>MP4, MOV, AVI, MKV o WebM</small></span>
              </button>
              {selectedVideo && (
                <div className="file-data">
                  <span className="file-loaded-details">
                    <span className="file-loaded-status"><span aria-hidden="true">&#10003;</span> Video cargado</span>
                    <strong title={selectedVideo.name}>{selectedVideo.name}</strong>
                  </span>
                  <span className="file-size">{formatFileSize(selectedVideo.size)}</span>
                </div>
              )}
              {analysis ? (
                <div className="existing-analysis-actions">
                  <button className="analyze-button" type="button" onClick={() => setViewedStep(2)} disabled={isBusy}>Continuar revision<span aria-hidden="true">&#8594;</span></button>
                  <button className="reanalyze-button" type="button" onClick={requestReanalysis} disabled={isBusy}>Reanalizar desde cero</button>
                </div>
              ) : (
                <button className="analyze-button" type="submit" disabled={!selectedVideo || isBusy}>{requestState === "analyzing" ? "Detectando landmarks..." : "Analizar movimiento"}<span aria-hidden="true">&#8599;</span></button>
              )}
              {requestState === "analyzing" && <div className="progress" aria-live="polite"><span className="progress-line" />Procesando el video localmente.</div>}
              {failedStep === 1 && <p className="error-message" role="alert">{errorMessage}</p>}
            </form>
          </section>

          <section className="workflow-panel editor-view" aria-label="Editor de landmarks">
            <div className="editor-panel-heading"><span className="panel-index">02 / EDITOR</span><p>Pausa y arrastra un punto. <span className={`save-state save-${saveState}`}>{saveState === "saving" ? "Guardando..." : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error al guardar" : ""}</span></p></div>
            {sourceUrl ? (
              <div ref={workspaceRef} className="editor-workspace">
                <div ref={stageRef} className="video-stage" style={stageSize ? { width: `${stageSize.width}px`, height: `${stageSize.height}px` } : undefined}>
                  <video ref={videoRef} className="editor-video" src={sourceUrl} playsInline onLoadedMetadata={() => drawOverlay(currentFrame)}>Tu navegador no puede reproducir este video.</video>
                  <canvas ref={canvasRef} className={`pose-canvas ${hasPose ? "is-editable" : ""}`} aria-label="Skeleton corporal editable" onPointerDown={startDragging} onPointerMove={updateDraggedLandmark} onPointerUp={stopDragging} onPointerCancel={stopDragging} />
                  {analysis && !hasPose && <p className="no-pose">No hubo pose detectada en este frame.</p>}
                  {analysis && hasEstimatedPose && <p className="estimated-pose">Pose estimada: revisa y ajusta si es necesario.</p>}
                  {analysis && (
                    <div className="editor-controls" aria-label="Controles de frame">
                      <div className="transport-row">
                        <button className="compact-icon" type="button" title="Frame anterior" aria-label="Frame anterior" onClick={() => goToFrame(currentFrameRef.current - 1)} disabled={currentFrame === 0}>&#9664;</button>
                        <button className="compact-icon" type="button" title="Reproducir o pausar" aria-label="Reproducir o pausar" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}>&#9654;&#10074;&#10074;</button>
                        <button className="compact-icon" type="button" title="Frame siguiente" aria-label="Frame siguiente" onClick={() => goToFrame(currentFrameRef.current + 1)} disabled={currentFrame === analysis.metadata.frame_count - 1}>&#9654;</button>
                        <div
                          ref={timelineRef}
                          className={`frame-timeline ${isSlowMotionMode ? "is-slow-motion-mode" : ""}`}
                          role="slider"
                          aria-label="Timeline de frames y lapsos de slow motion"
                          aria-valuemin={0}
                          aria-valuemax={analysis.metadata.frame_count - 1}
                          aria-valuenow={currentFrame}
                          onPointerDown={startTimelineDrag}
                          onPointerMove={updateTimelineDrag}
                          onPointerUp={stopTimelineDrag}
                          onPointerCancel={stopTimelineDrag}
                        >
                          {slowMotionSegments.map((segment) => (
                            <span
                              key={segment.id}
                              className={`slow-motion-segment ${segment.id === selectedSlowMotionId ? "is-selected" : ""}`}
                              data-segment-id={segment.id}
                              style={{
                                left: `${segment.start_frame / (analysis.metadata.frame_count - 1) * 100}%`,
                                width: `${Math.max(0.7, (segment.end_frame - segment.start_frame + 1) / analysis.metadata.frame_count * 100)}%`,
                              }}
                            >
                              <button type="button" className="segment-handle" data-segment-handle="start" aria-label="Ajustar inicio del lapso" />
                              <span>1/{1 / segment.speed}</span>
                              <button type="button" className="segment-handle" data-segment-handle="end" aria-label="Ajustar final del lapso" />
                            </span>
                          ))}
                          {slowMotionDraft && (
                            <span
                              className="slow-motion-draft"
                              style={{
                                left: `${slowMotionDraft.start_frame / (analysis.metadata.frame_count - 1) * 100}%`,
                                width: `${Math.max(0.7, (slowMotionDraft.end_frame - slowMotionDraft.start_frame + 1) / analysis.metadata.frame_count * 100)}%`,
                              }}
                            />
                          )}
                          <span className="timeline-playhead" style={{ left: `${currentFrame / (analysis.metadata.frame_count - 1) * 100}%` }} />
                        </div>
                        <span className="frame-readout">{currentFrame + 1} / {analysis.metadata.frame_count}</span>
                      </div>
                      <div className="slow-motion-row">
                        <button className={`slow-motion-toggle ${isSlowMotionMode ? "is-active" : ""}`} type="button" onClick={toggleSlowMotionMode}>Slow Motion</button>
                        {isSlowMotionMode && slowMotionDraft ? <>
                          <span className="slow-motion-selection">{slowMotionDraft.start_frame + 1}-{slowMotionDraft.end_frame + 1}</span>
                          {SLOW_MOTION_SPEEDS.map((speed) => <button key={speed} type="button" onClick={() => addSlowMotionSegment(speed)}>1/{1 / speed}</button>)}
                          <button type="button" title="Cancelar lapso" onClick={() => setSlowMotionDraft(null)}>&#215;</button>
                        </> : isSlowMotionMode && selectedSlowMotion ? <>
                          <span className="slow-motion-selection">{selectedSlowMotion.start_frame + 1}-{selectedSlowMotion.end_frame + 1}</span>
                          {SLOW_MOTION_SPEEDS.map((speed) => <button key={speed} className={selectedSlowMotion.speed === speed ? "is-active" : ""} type="button" onClick={() => updateSelectedSlowMotionSpeed(speed)}>1/{1 / speed}</button>)}
                          <button type="button" title="Eliminar lapso" onClick={removeSelectedSlowMotionSegment}>&#128465;</button>
                        </> : isSlowMotionMode ? <span className="slow-motion-hint">Arrastra sobre la timeline para crear un lapso.</span> : null}
                        {slowMotionSegments.length > 0 && <span className="output-duration">Salida: ~{Math.round(outputFrameCount / analysis.metadata.fps * 10) / 10}s</span>}
                      </div>
                      <div className="compact-actions">
                        <span className="correction-status">{selectedLandmark === null ? "Selecciona un punto" : LANDMARK_NAMES[selectedLandmark]} · {Object.keys(corrections).length} keys</span>
                        <button type="button" title="Deshacer punto" onClick={undoCurrentCorrection} disabled={!selectedCorrection}>&#8630;</button>
                        <button type="button" title="Resetear ajustes" onClick={() => setCorrections({})} disabled={Object.keys(corrections).length === 0}><RestartAltOutlined fontSize="small" /></button>
                        <button type="button" title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"} aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={toggleFullscreen}>{isFullscreen ? "X" : <FullscreenOutlined fontSize="small" />}</button>
                        <button className="export-button" type="button" onClick={exportVideo} disabled={isBusy}><DownloadOutlined fontSize="small" /> MP4</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : <p className="empty-editor">El analisis aparecera aqui.</p>}
          </section>

          <section className="workflow-panel export-view" aria-labelledby="export-title">
            <div className="export-card">
              <span className="panel-index">03 / EXPORTADO</span>
              {requestState === "exporting" ? <><h2 id="export-title">Generando tu video.</h2><p>Aplicando los keyframes y renderizando el skeleton corregido.</p><span className="export-loader" aria-label="Generando video" /></> : resultUrl ? <><h2 id="export-title">Video corregido.</h2><video className="final-video" src={resultUrl} controls playsInline /><a className="download-link" href={resultUrl} download="processed-pitch.mp4">Descargar MP4</a><button className="return-button" type="button" onClick={returnToEditor}>Volver a editar</button></> : <><h2 id="export-title">No se pudo generar el video.</h2><p className="error-message">{errorMessage}</p><button className="return-button" type="button" onClick={returnToEditor}>Volver a editar</button></>}
            </div>
          </section>
        </div>
      </div>
      {toast && (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          autoCloseMs={toast.autoCloseMs}
          actions={toast.actions}
          onClose={closeToast}
        />
      )}
    </main>
  );
}
