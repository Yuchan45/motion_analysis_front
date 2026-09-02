// @ts-nocheck
import { AccountCircleOutlined, LogoutOutlined } from "@mui/icons-material";
import { AppBar, Avatar, Box, Button, IconButton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import { Link as RouterLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { apiAssetUrl } from "../shared/api/apiClient";

export function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const avatar = user?.profile.avatar;
  const displayName = user?.profile.displayName?.trim() || user?.username || "Perfil";
  const initial = displayName.slice(0, 1).toUpperCase();

  return <div className="authenticated-shell">
    <AppBar component="header" position="sticky" color="inherit" elevation={0} className="app-navbar">
      <Toolbar sx={{ minHeight: { xs: 64, sm: 72 }, px: { xs: 2, sm: 4 }, gap: 2 }}>
        <Stack component={RouterLink} to="/" direction="row" alignItems="center" gap={1.25} color="inherit" sx={{ textDecoration: "none", mr: "auto" }} aria-label="Motion Analysis, inicio">
          <Box className="brand-mark" aria-hidden="true">MA</Box><Typography fontWeight={800} letterSpacing="-0.03em">Motion Analysis</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Tooltip title="Mi perfil"><IconButton component={RouterLink} to="/profile" color="primary" aria-label="Abrir mi perfil"><Avatar src={avatar?.url ? apiAssetUrl(avatar.url) : undefined} sx={{ width: 32, height: 32, bgcolor: "secondary.light", color: "text.primary", fontWeight: 800 }}>{avatar?.url ? null : initial}</Avatar><AccountCircleOutlined sx={{ display: { xs: "none", md: "block" }, ml: 0.5 }} /></IconButton></Tooltip>
          <Typography variant="body2" fontWeight={700} sx={{ display: { xs: "none", md: "block" }, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</Typography>
          <Tooltip title="Cerrar sesión"><Button color="inherit" size="small" startIcon={<LogoutOutlined />} onClick={() => void logout()} sx={{ display: { xs: "none", sm: "inline-flex" } }}>Salir</Button><IconButton color="inherit" onClick={() => void logout()} sx={{ display: { sm: "none" } }} aria-label="Cerrar sesión"><LogoutOutlined /></IconButton></Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
    <Outlet />
  </div>;
}
