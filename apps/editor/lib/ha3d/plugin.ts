import type { Plugin } from '@pascal-app/core'
import type { EditorHostPanel } from '@pascal-app/editor'

export const ha3dPlugin: Plugin = {
  id: 'ha3d:home-assistant',
  apiVersion: 1,
}

export const ha3dHostPanel: EditorHostPanel = {
  id: 'ha3d:home-assistant:panel',
  pluginId: ha3dPlugin.id,
  label: 'Home Assistant',
  description: 'Bind Pascal scene objects to Home Assistant entities.',
  creator: {
    name: 'HA 3D Dashboard',
  },
  icon: { kind: 'iconify', name: 'lucide:house-plug' },
  component: () => import('../../components/ha3d/ha3d-panel'),
  defaultInstalled: true,
}
