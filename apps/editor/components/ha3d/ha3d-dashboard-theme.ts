import type { CSSProperties } from 'react'

export const HA3D_DASHBOARD_THEME_STYLE = {
  '--ha3d-dashboard-surface':
    'color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #0f172a)) 88%, transparent)',
  '--ha3d-dashboard-border': 'var(--divider-color, rgba(255, 255, 255, 0.12))',
  '--ha3d-dashboard-text': 'var(--primary-text-color, #f8fafc)',
  '--ha3d-dashboard-muted': 'var(--secondary-text-color, #94a3b8)',
  '--ha3d-dashboard-disabled': 'var(--disabled-text-color, #64748b)',
  '--ha3d-dashboard-primary': 'var(--primary-color, #22d3ee)',
  '--ha3d-dashboard-primary-soft':
    'color-mix(in srgb, var(--primary-color, #22d3ee) 18%, transparent)',
  '--ha3d-dashboard-primary-ring':
    'color-mix(in srgb, var(--primary-color, #22d3ee) 34%, transparent)',
  '--ha3d-dashboard-hover':
    'color-mix(in srgb, var(--primary-text-color, #f8fafc) 8%, transparent)',
  '--ha3d-dashboard-warning': 'var(--warning-color, #fbbf24)',
  '--ha3d-dashboard-warning-soft':
    'color-mix(in srgb, var(--warning-color, #fbbf24) 18%, transparent)',
  '--ha3d-dashboard-warning-ring':
    'color-mix(in srgb, var(--warning-color, #fbbf24) 30%, transparent)',
  '--ha3d-dashboard-success': 'var(--success-color, #34d399)',
  '--ha3d-dashboard-error': 'var(--error-color, #f87171)',
  '--ha3d-dashboard-error-soft': 'color-mix(in srgb, var(--error-color, #f87171) 12%, transparent)',
  '--ha3d-dashboard-error-ring': 'color-mix(in srgb, var(--error-color, #f87171) 30%, transparent)',
  '--ha3d-dashboard-light-active':
    'var(--state-light-active-color, var(--accent-color, var(--primary-color, #22d3ee)))',
  '--ha3d-dashboard-light-active-soft':
    'color-mix(in srgb, var(--state-light-active-color, var(--accent-color, var(--primary-color, #22d3ee))) 18%, transparent)',
  '--ha3d-dashboard-light-active-ring':
    'color-mix(in srgb, var(--state-light-active-color, var(--accent-color, var(--primary-color, #22d3ee))) 32%, transparent)',
} as CSSProperties

export const HA3D_EDITOR_THEME_STYLE = {
  ...HA3D_DASHBOARD_THEME_STYLE,
  '--radius': '0.875rem',
  '--background':
    'var(--primary-background-color, var(--ha-card-background, var(--card-background-color, #171717)))',
  '--foreground': 'var(--primary-text-color, #f8fafc)',
  '--card': 'var(--ha-card-background, var(--card-background-color, #202020))',
  '--card-foreground': 'var(--primary-text-color, #f8fafc)',
  '--popover': 'var(--ha-card-background, var(--card-background-color, #202020))',
  '--popover-foreground': 'var(--primary-text-color, #f8fafc)',
  '--primary': 'var(--primary-color, #03a9f4)',
  '--primary-foreground': 'var(--text-primary-color, #ffffff)',
  '--secondary':
    'color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #202020)) 88%, var(--primary-text-color, #f8fafc) 12%)',
  '--secondary-foreground': 'var(--primary-text-color, #f8fafc)',
  '--muted':
    'color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #202020)) 92%, var(--primary-text-color, #f8fafc) 8%)',
  '--muted-foreground': 'var(--secondary-text-color, #94a3b8)',
  '--accent':
    'color-mix(in srgb, var(--primary-color, #03a9f4) 12%, var(--ha-card-background, var(--card-background-color, #202020)))',
  '--accent-foreground': 'var(--primary-text-color, #f8fafc)',
  '--destructive': 'var(--error-color, #f87171)',
  '--border': 'var(--divider-color, rgba(255, 255, 255, 0.12))',
  '--input': 'var(--divider-color, rgba(255, 255, 255, 0.16))',
  '--ring': 'var(--primary-color, #03a9f4)',
  '--sidebar': 'var(--ha-card-background, var(--card-background-color, #202020))',
  '--sidebar-foreground': 'var(--primary-text-color, #f8fafc)',
  '--sidebar-primary': 'var(--primary-color, #03a9f4)',
  '--sidebar-primary-foreground': 'var(--text-primary-color, #ffffff)',
  '--sidebar-accent':
    'color-mix(in srgb, var(--primary-color, #03a9f4) 12%, var(--ha-card-background, var(--card-background-color, #202020)))',
  '--sidebar-accent-foreground': 'var(--primary-text-color, #f8fafc)',
  '--sidebar-border': 'var(--divider-color, rgba(255, 255, 255, 0.12))',
  '--sidebar-ring': 'var(--primary-color, #03a9f4)',
} as CSSProperties
