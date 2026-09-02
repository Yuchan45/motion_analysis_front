import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { AnalysisPage } from "../pages/AnalysisPage/AnalysisPage";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { DashboardPage } from "../pages/DashboardPage/DashboardPage";
import { ProfilePage } from "../pages/ProfilePage/ProfilePage";
import { AuthenticatedLayout } from "./AuthenticatedLayout";
import { AppProviders } from "./providers/AppProviders";

export default function App() {
  return <AppProviders><BrowserRouter><AuthProvider><Routes><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route element={<ProtectedRoute />}><Route element={<AuthenticatedLayout />}><Route path="/" element={<DashboardPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/analysis/new" element={<AnalysisPage />} /><Route path="/videos/:videoId/new" element={<AnalysisPage />} /><Route path="/videos/:videoId/analyses/:analysisId" element={<AnalysisPage />} /></Route></Route></Routes></AuthProvider></BrowserRouter></AppProviders>;
}
