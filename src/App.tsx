import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";

const ANALYZE_URL =
  import.meta.env.VITE_ANALYZE_URL ?? "http://localhost:8000/analyze";
const RENDER_URL =
  import.meta.env.VITE_RENDER_URL ?? ANALYZE_URL.replace(/\/analyze$/, "/render");

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

type Landmark = { x: number; y: number; z: number; visibility: number };
type Analysis = {
  metadata: { fps: number; width: number; height: number; frame_count: number };
  landmark_indices: number[];
  frames: Array<Landmark[] | null>;
  frame_times: number[];
};
type Correction = { frame_index: number; landmark_index: number; x: number; y: number };
type DragState = { landmarkIndex: number; pointerId: number };
type FrameCallbackVideo = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
};

const WORKFLOW_STEPS = ["Cargar y analizar", "Revisar y ajustar", "Generar MP4"];

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

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? "No se pudo procesar el video.";
  } catch {
    return "No se pudo procesar el video.";
  }
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

export default function App() {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [corrections, setCorrections] = useState<Record<string, Correction>>({});
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedLandmark, setSelectedLandmark] = useState<number | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const correctionsRef = useRef(corrections);
  const analysisRef = useRef(analysis);
  const drawOverlayRef = useRef<(frameIndex: number) => void>(() => undefined);
  const dragRef = useRef<DragState | null>(null);

  correctionsRef.current = corrections;
  analysisRef.current = analysis;

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
      const aspectRatio = analysis.metadata.width / analysis.metadata.height;
      const maxHeight = Math.min(window.innerHeight - 250, 720);
      const width = Math.min(workspace.clientWidth, maxHeight * aspectRatio);
      setStageSize({ width: Math.round(width), height: Math.round(width / aspectRatio) });
    };

    resizeStage();
    const observer = new ResizeObserver(resizeStage);
    observer.observe(workspace);
    window.addEventListener("resize", resizeStage);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeStage);
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
    const landmarks = correctedLandmarks(frameIndex, frame, correctionsRef.current);
    const landmarkMap = new Map(
      currentAnalysis.landmark_indices.map((index, position) => [index, landmarks[position]]),
    );

    context.strokeStyle = "#c4e844";
    context.lineWidth = 1.5 * pixelRatio;
    for (const [start, end] of POSE_CONNECTIONS) {
      const startPoint = landmarkMap.get(start);
      const endPoint = landmarkMap.get(end);
      if (!startPoint || !endPoint || startPoint.visibility < 0.45 || endPoint.visibility < 0.45) continue;
      context.beginPath();
      context.moveTo(viewport.x + startPoint.x * viewport.width, viewport.y + startPoint.y * viewport.height);
      context.lineTo(viewport.x + endPoint.x * viewport.width, viewport.y + endPoint.y * viewport.height);
      context.stroke();
    }

    for (const [index, landmark] of landmarkMap) {
      if (landmark.visibility < 0.45) continue;
      const x = viewport.x + landmark.x * viewport.width;
      const y = viewport.y + landmark.y * viewport.height;
      context.beginPath();
      context.fillStyle = index === selectedLandmark ? "#ffffff" : "#ff4a18";
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
  }, [analysis, corrections, currentFrame, selectedLandmark]);

  function selectVideo(file: File | null) {
    if (!file) return;
    setSelectedVideo(file);
    setSourceUrl(URL.createObjectURL(file));
    setResultUrl(null);
    setAnalysis(null);
    setCorrections({});
    setCurrentFrame(0);
    setSelectedLandmark(null);
    setStageSize(null);
    setErrorMessage("");
    setFailedStep(null);
    setRequestState("idle");
  }

  async function analyzeVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVideo || requestState === "analyzing" || requestState === "exporting") return;

    setRequestState("analyzing");
    setErrorMessage("");
    setFailedStep(null);
    const formData = new FormData();
    formData.append("video", selectedVideo);

    try {
      const response = await fetch(ANALYZE_URL, { method: "POST", body: formData });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const nextAnalysis = (await response.json()) as Analysis;
      setAnalysis(nextAnalysis);
      setCorrections({});
      setCurrentFrame(0);
      setRequestState("editing");
    } catch (error) {
      setRequestState("error");
      setErrorMessage(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
      setFailedStep(1);
    }
  }

  function goToFrame(nextFrame: number) {
    if (!analysis || !videoRef.current) return;
    const frame = Math.min(analysis.metadata.frame_count - 1, Math.max(0, nextFrame));
    videoRef.current.pause();
    videoRef.current.currentTime = frame / analysis.metadata.fps;
    setCurrentFrame(frame);
    requestAnimationFrame(() => drawOverlay(frame));
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
      if (landmark.visibility < 0.45) return;
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
  }

  async function exportVideo() {
    if (!selectedVideo || !analysis || requestState === "exporting") return;
    setRequestState("exporting");
    setErrorMessage("");
    setFailedStep(null);
    const formData = new FormData();
    formData.append("video", selectedVideo);
    formData.append(
      "analysis",
      new Blob([JSON.stringify(analysis)], { type: "application/json" }),
      "analysis.json",
    );
    formData.append("corrections", JSON.stringify({ corrections: Object.values(corrections) }));

    try {
      const response = await fetch(RENDER_URL, { method: "POST", body: formData });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      setResultUrl(URL.createObjectURL(await response.blob()));
      setRequestState("complete");
    } catch (error) {
      setRequestState("error");
      setErrorMessage(error instanceof Error ? error.message : "No se pudo exportar el video.");
      setFailedStep(3);
    }
  }

  const isBusy = requestState === "analyzing" || requestState === "exporting";
  const hasPose = Boolean(analysis?.frames[currentFrame]);
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

  return (
    <main className="page-shell">
      <header className="masthead">
        <a className="brand" href="/" aria-label="Motion Analysis, inicio">
          <span className="brand-mark" aria-hidden="true">MA</span>
          Motion Analysis
        </a>
        <span className="version">MVP / EDITOR</span>
      </header>

      <nav className="workflow-stepper" aria-label="Progreso del analisis">
        <ol className="workflow-steps">
          {WORKFLOW_STEPS.map((label, index) => {
            const step = index + 1;
            const state = step === failedStep
              ? "is-error"
              : step < activeStep || (step === 3 && requestState === "complete")
              ? "is-complete"
              : step === activeStep
                ? "is-active"
                : "is-pending";
            return (
              <li key={label} className={`workflow-step ${state}`} aria-current={step === activeStep ? "step" : undefined}>
                <span className="step-dot">{step}</span>
                <span className="step-label">{label}</span>
              </li>
            );
          })}
        </ol>
        <p className={`workflow-message ${isBusy ? "is-busy" : ""} ${failedStep ? "is-error" : ""}`} role="status" aria-live="polite">
          {workflowMessage}
        </p>
      </nav>

      <div className="workflow-viewport">
        <div className="workflow-track" style={{ transform: `translateX(-${(activeStep - 1) * 100}%)` }}>
          <section className="workflow-panel upload-view" aria-labelledby="page-title">
            <div className="hero-copy">
              <p className="eyebrow">Pose correction for pitching</p>
              <h1 id="page-title">Ajusta el frame que el modelo no pudo leer.</h1>
              <p className="intro">Carga un video, revisa el skeleton y exporta una version corregida.</p>
            </div>
            <form className="upload-panel" onSubmit={analyzeVideo}>
              <span className="panel-index">01 / ANALISIS</span>
              <input ref={inputRef} className="visually-hidden" id="pitch-video" type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mkv" onChange={(event) => selectVideo(event.target.files?.[0] ?? null)} />
              <button className="file-picker" type="button" onClick={() => { if (inputRef.current) inputRef.current.value = ""; inputRef.current?.click(); }} disabled={isBusy}>
                <span className="picker-symbol" aria-hidden="true">+</span>
                <span><strong>{selectedVideo ? "Cambiar video" : "Seleccionar video"}</strong><small>MP4, MOV, AVI, MKV o WebM</small></span>
              </button>
              {selectedVideo && <div className="file-data"><span>{selectedVideo.name}</span><span>{formatFileSize(selectedVideo.size)}</span></div>}
              <button className="analyze-button" type="submit" disabled={!selectedVideo || isBusy}>{requestState === "analyzing" ? "Detectando landmarks..." : "Analizar movimiento"}<span aria-hidden="true">&#8599;</span></button>
              {requestState === "analyzing" && <div className="progress" aria-live="polite"><span className="progress-line" />Procesando el video localmente.</div>}
              {failedStep === 1 && <p className="error-message" role="alert">{errorMessage}</p>}
            </form>
          </section>

          <section className="workflow-panel editor-view" aria-label="Editor de landmarks">
            <div className="editor-panel-heading"><span className="panel-index">02 / EDITOR</span><p>Pausa y arrastra un punto.</p></div>
            {sourceUrl ? (
              <div ref={workspaceRef} className="editor-workspace">
                <div ref={stageRef} className="video-stage" style={stageSize ? { width: `${stageSize.width}px`, height: `${stageSize.height}px` } : undefined}>
                  <video ref={videoRef} className="editor-video" src={sourceUrl} playsInline onLoadedMetadata={() => drawOverlay(currentFrame)}>Tu navegador no puede reproducir este video.</video>
                  <canvas ref={canvasRef} className={`pose-canvas ${hasPose ? "is-editable" : ""}`} aria-label="Skeleton corporal editable" onPointerDown={startDragging} onPointerMove={updateDraggedLandmark} onPointerUp={stopDragging} onPointerCancel={stopDragging} />
                  {analysis && !hasPose && <p className="no-pose">No hubo pose detectada en este frame.</p>}
                  {analysis && (
                    <div className="editor-controls" aria-label="Controles de frame">
                      <div className="transport-row">
                        <button className="compact-icon" type="button" title="Frame anterior" aria-label="Frame anterior" onClick={() => goToFrame(currentFrame - 1)} disabled={currentFrame === 0}>&#9664;</button>
                        <button className="compact-icon" type="button" title="Reproducir o pausar" aria-label="Reproducir o pausar" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}>&#9654;&#10074;&#10074;</button>
                        <button className="compact-icon" type="button" title="Frame siguiente" aria-label="Frame siguiente" onClick={() => goToFrame(currentFrame + 1)} disabled={currentFrame === analysis.metadata.frame_count - 1}>&#9654;</button>
                        <input aria-label="Frame actual" className="frame-slider" type="range" min="0" max={analysis.metadata.frame_count - 1} value={currentFrame} onChange={(event) => goToFrame(Number(event.target.value))} />
                        <span className="frame-readout">{currentFrame + 1} / {analysis.metadata.frame_count}</span>
                      </div>
                      <div className="compact-actions">
                        <span className="correction-status">{selectedLandmark === null ? "Selecciona un punto" : LANDMARK_NAMES[selectedLandmark]} · {Object.keys(corrections).length} keys</span>
                        <button type="button" title="Deshacer punto" onClick={undoCurrentCorrection} disabled={!selectedCorrection}>&#8630;</button>
                        <button type="button" title="Resetear ajustes" onClick={() => setCorrections({})} disabled={Object.keys(corrections).length === 0}>&#8635;</button>
                        <button type="button" title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"} aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={toggleFullscreen}>{isFullscreen ? "X" : "\u26F6"}</button>
                        <button className="export-button" type="button" onClick={exportVideo} disabled={isBusy}>&#8595; MP4</button>
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
    </main>
  );
}
