// @ts-nocheck
import { LogoutOutlined } from "@mui/icons-material";
import { AppBar, Avatar, Box, Button, IconButton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import { Link as RouterLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { apiAssetUrl } from "../shared/api/apiClient";
import hawkLogo from "../assets/brand/hawk_white.png";

export function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const avatar = user?.profile.avatar;
  const displayName = user?.profile.displayName?.trim() || user?.username || "Perfil";
  const initial = displayName.slice(0, 1).toUpperCase();

  return <div className="authenticated-shell">
    <AppBar component="header" position="sticky" color="inherit" elevation={0} className="app-navbar">
      <Toolbar className="navbar-toolbar">
        <Stack component={RouterLink} to="/" className="navbar-brand" direction="row" alignItems="center" color="inherit" aria-label="Motion Analysis, inicio">
          <Box className="navbar-brand-mark" aria-hidden="true"><img src={hawkLogo} alt="" /></Box><Box className="navbar-brand-copy"><Typography className="navbar-brand-title">Motion Analysis</Typography><Typography className="navbar-brand-kicker">Performance lab</Typography></Box>
        </Stack>
        <Stack className="navbar-actions" direction="row" alignItems="center">
          <Button className="navbar-profile-button" component={RouterLink} to="/profile" color="inherit" startIcon={<Avatar src={avatar?.url ? apiAssetUrl(avatar.url) : undefined} sx={{ width: 30, height: 30, bgcolor: "secondary.light", color: "text.primary", fontSize: "0.75rem", fontWeight: 800 }}>{avatar?.url ? null : initial}</Avatar>} aria-label="Abrir mi perfil"><span className="navbar-profile-name">{displayName}</span></Button>
          <Tooltip title="Cerrar sesión"><IconButton className="navbar-logout-button" color="inherit" onClick={() => void logout()} aria-label="Cerrar sesión"><LogoutOutlined fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
    <Outlet />
  </div>;
}
