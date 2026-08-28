import { VideoAnalysisFeature } from "../../features/video-analysis";
import { useParams } from "react-router-dom";

export function AnalysisPage() {
  const { videoId, analysisId } = useParams();
  return <VideoAnalysisFeature initialVideoId={videoId} initialAnalysisId={analysisId} />;
}
