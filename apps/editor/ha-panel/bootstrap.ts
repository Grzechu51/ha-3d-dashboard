import { type AnyNodeDefinition, nodeRegistry, registerNode } from '@pascal-app/core'
import { registerEditorHostPanel } from '@pascal-app/editor'
import { builtinPlugin } from '@pascal-app/nodes'
import { registerViewerPresentation } from '@pascal-app/viewer'
import { ha3dHostPanel, ha3dPresentation } from '../lib/ha3d/plugin'

let initialized = false

export function initializeHa3dPanelRuntime(): void {
  if (initialized) return
  initialized = true

  for (const definition of builtinPlugin.nodes ?? []) {
    const node = definition as AnyNodeDefinition
    if (!nodeRegistry.has(node.kind)) registerNode(node)
  }

  registerEditorHostPanel(ha3dHostPanel)
  registerViewerPresentation(ha3dPresentation)
}

initializeHa3dPanelRuntime()
