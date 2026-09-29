// lib/ha3d/hass-adapter.ts
function toEntityState(state) {
  return {
    entityId: state.entity_id,
    state: state.state,
    attributes: state.attributes,
    ...state.last_changed ? { lastChanged: state.last_changed } : {},
    ...state.last_updated ? { lastUpdated: state.last_updated } : {}
  };
}
function changedEntityIds(previous, next) {
  if (!previous)
    return Object.keys(next.states);
  const ids = new Set([...Object.keys(previous.states), ...Object.keys(next.states)]);
  return Array.from(ids).filter((entityId) => previous.states[entityId] !== next.states[entityId]);
}
function serviceTarget(call) {
  const entityId = call.target?.entityId;
  if (entityId === undefined)
    return;
  return { entity_id: entityId };
}

class HomeAssistantHassAdapter {
  id = "home-assistant";
  hass;
  listeners = new Set;
  constructor(hass = null) {
    this.hass = hass;
  }
  updateHass(hass) {
    const changed = changedEntityIds(this.hass, hass);
    this.hass = hass;
    if (changed.length === 0)
      return;
    for (const listener of this.listeners)
      listener(changed);
  }
  disconnect() {
    this.hass = null;
  }
  getEntity(entityId) {
    const state = this.hass?.states[entityId];
    return state ? toEntityState(state) : undefined;
  }
  listEntities() {
    if (!this.hass)
      return [];
    return Object.values(this.hass.states).map(toEntityState);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async callService(call) {
    const hass = this.hass;
    if (!hass)
      throw new Error("[ha3d] Home Assistant host is disconnected");
    await hass.callService(call.domain, call.service, call.data, serviceTarget(call));
  }
}

// lib/ha3d/runtime.ts
var listeners = new Set;
var adapterUnsubscribe = null;
var snapshot = {
  adapter: null,
  connected: false,
  revision: 0
};
function publish(adapter) {
  snapshot = {
    adapter,
    connected: adapter !== null,
    revision: snapshot.revision + 1
  };
  for (const listener of listeners)
    listener();
}
function setHomeAssistantAdapter(adapter) {
  if (snapshot.adapter === adapter)
    return;
  adapterUnsubscribe?.();
  adapterUnsubscribe = null;
  publish(adapter);
  if (adapter) {
    adapterUnsubscribe = adapter.subscribe(() => {
      if (snapshot.adapter === adapter)
        publish(adapter);
    });
  }
}
function getHomeAssistantRuntimeSnapshot() {
  return snapshot;
}

// lib/ha3d/hass-host.ts
var hosts = new Map;
var adapter = new HomeAssistantHassAdapter;
var activeHost = null;
function latestHost() {
  const entries = Array.from(hosts.entries());
  return entries.length > 0 ? entries[entries.length - 1] ?? null : null;
}
function activate(token, hass) {
  hosts.delete(token);
  hosts.set(token, hass);
  activeHost = token;
  adapter.updateHass(hass);
  if (getHomeAssistantRuntimeSnapshot().adapter !== adapter) {
    setHomeAssistantAdapter(adapter);
  }
}
function deactivate(token) {
  const wasActive = activeHost === token;
  hosts.delete(token);
  if (!wasActive)
    return;
  const fallback = latestHost();
  if (fallback) {
    activeHost = fallback[0];
    adapter.updateHass(fallback[1]);
    return;
  }
  activeHost = null;
  adapter.disconnect();
  if (getHomeAssistantRuntimeSnapshot().adapter === adapter) {
    setHomeAssistantAdapter(null);
  }
}
function createHomeAssistantHassHost() {
  const token = Symbol("ha3d-hass-host");
  let disposed = false;
  return {
    setHass: (hass) => {
      if (disposed)
        throw new Error("[ha3d] Home Assistant hass host is disposed");
      activate(token, hass);
    },
    dispose: () => {
      if (disposed)
        return;
      disposed = true;
      deactivate(token);
    }
  };
}

// lib/ha3d/panel-host-controller.ts
class HomeAssistantPanelHostController {
  host = null;
  hassValue = null;
  connectedValue = false;
  setHass(hass) {
    this.hassValue = hass;
    if (this.connectedValue)
      this.ensureHost().setHass(hass);
  }
  connect() {
    if (this.connectedValue)
      return;
    this.connectedValue = true;
    if (this.hassValue)
      this.ensureHost().setHass(this.hassValue);
  }
  disconnect() {
    if (!this.connectedValue)
      return;
    this.connectedValue = false;
    this.host?.dispose();
    this.host = null;
  }
  isConnected() {
    return this.connectedValue;
  }
  ensureHost() {
    this.host ??= createHomeAssistantHassHost();
    return this.host;
  }
}

// ha-panel/ha3d-panel.ts
class Ha3dDashboardPanel extends HTMLElement {
  controller = new HomeAssistantPanelHostController;
  hassValue = null;
  narrowValue = false;
  panelValue = null;
  root;
  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }
  set hass(value) {
    this.hassValue = value;
    this.controller.setHass(value);
    this.render();
  }
  get hass() {
    return this.hassValue;
  }
  set narrow(value) {
    this.narrowValue = Boolean(value);
    this.render();
  }
  get narrow() {
    return this.narrowValue;
  }
  set panel(value) {
    this.panelValue = value;
    this.render();
  }
  get panel() {
    return this.panelValue;
  }
  connectedCallback() {
    this.controller.connect();
    this.render();
  }
  disconnectedCallback() {
    this.controller.disconnect();
  }
  render() {
    const entityCount = this.hassValue ? Object.keys(this.hassValue.states).length : 0;
    const connected = this.hassValue !== null;
    const configuredVersion = this.panelValue?.config?.version;
    this.root.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          min-height: 100%;
          color: var(--primary-text-color, #fff);
          background: var(--primary-background-color, #111);
          font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
        }
        .shell {
          box-sizing: border-box;
          min-height: 100vh;
          padding:
            max(24px, env(safe-area-inset-top))
            max(24px, env(safe-area-inset-right))
            max(24px, env(safe-area-inset-bottom))
            max(24px, env(safe-area-inset-left));
          display: grid;
          place-items: center;
        }
        .card {
          width: min(680px, 100%);
          border: 1px solid var(--divider-color, rgba(255,255,255,.14));
          border-radius: 20px;
          padding: 24px;
          background: var(--card-background-color, rgba(20,20,20,.92));
          box-shadow: 0 18px 60px rgba(0,0,0,.22);
        }
        h1 { margin: 0; font-size: 24px; }
        p { color: var(--secondary-text-color, #aaa); line-height: 1.5; }
        .status { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
        .pill {
          border: 1px solid var(--divider-color, rgba(255,255,255,.14));
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
        }
      </style>
      <div class="shell">
        <section class="card">
          <h1>HA 3D Dashboard</h1>
          <p>
            Native Home Assistant panel host is active. The next checkpoint moves project
            storage into Home Assistant and mounts the full editor/dashboard shell here.
          </p>
          <div class="status">
            <span class="pill">hass: ${connected ? "connected" : "waiting"}</span>
            <span class="pill">entities: ${entityCount}</span>
            <span class="pill">layout: ${this.narrowValue ? "narrow" : "wide"}</span>
            ${configuredVersion ? `<span class="pill">v${configuredVersion}</span>` : ""}
          </div>
        </section>
      </div>
    `;
  }
}
if (!customElements.get("ha3d-dashboard-panel")) {
  customElements.define("ha3d-dashboard-panel", Ha3dDashboardPanel);
}
export {
  Ha3dDashboardPanel
};
