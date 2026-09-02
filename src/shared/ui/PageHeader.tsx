// @ts-nocheck
import { Box, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

type PageHeaderProps = { eyebrow?: string; title: string; description?: string; action?: ReactNode };

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return <Stack className="ui-page-header" direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} gap={2}>
    <Box>{eyebrow && <Typography variant="overline" color="primary.main" fontWeight={800}>{eyebrow}</Typography>}<Typography variant="h1">{title}</Typography>{description && <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 620 }}>{description}</Typography>}</Box>
    {action && <Box className="ui-page-header-action">{action}</Box>}
  </Stack>;
}
