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
