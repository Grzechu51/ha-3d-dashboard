import { MockHomeAssistantAdapter } from './mock-home-assistant-adapter'
import { getHomeAssistantRuntimeSnapshot, setHomeAssistantAdapter } from './runtime'

export function installDevelopmentHomeAssistantMock(): void {
  if (getHomeAssistantRuntimeSnapshot().adapter) return

  setHomeAssistantAdapter(
    new MockHomeAssistantAdapter([
      {
        entityId: 'light.salon_ceiling',
        state: 'off',
        attributes: {
          friendly_name: 'Salon — sufit',
          brightness: 255,
          color_temp_kelvin: 3200,
        },
      },
      {
        entityId: 'light.salon_ambient',
        state: 'on',
        attributes: {
          friendly_name: 'Salon — RGBW',
          brightness: 140,
          rgb_color: [40, 110, 255],
        },
      },
      {
        entityId: 'cover.salon_blind',
        state: 'open',
        attributes: {
          friendly_name: 'Salon — żaluzja',
          current_position: 100,
        },
      },
      {
        entityId: 'sensor.salon_temperature',
        state: '22.4',
        attributes: {
          friendly_name: 'Salon — temperatura',
          unit_of_measurement: '°C',
        },
      },
    ]),
  )
}
