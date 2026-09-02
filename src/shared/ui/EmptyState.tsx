// @ts-nocheck
import { InboxOutlined } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import { ReactNode } from "react";
import { AppCard } from "./AppCard";

type EmptyStateProps = { title: string; description: string; action?: ReactNode };

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <AppCard sx={{ p: { xs: 3, sm: 5 }, textAlign: "center", borderStyle: "dashed" }}><Stack alignItems="center" gap={1.25}><InboxOutlined color="primary" sx={{ fontSize: 40 }} /><Typography variant="h5" fontWeight={800}>{title}</Typography><Typography color="text.secondary">{description}</Typography>{action}</Stack></AppCard>;
}
