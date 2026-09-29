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
        entityId: 'switch.salon_tv_backlight',
        state: 'on',
        attributes: {
          friendly_name: 'Salon — podświetlenie TV',
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
      {
        entityId: 'sensor.salon_co2',
        state: '612',
        attributes: {
          friendly_name: 'Salon — CO₂',
          unit_of_measurement: 'ppm',
        },
      },
      {
        entityId: 'binary_sensor.salon_presence',
        state: 'on',
        attributes: {
          friendly_name: 'Salon — obecność',
          device_class: 'occupancy',
        },
      },
      {
        entityId: 'climate.salon',
        state: 'heat',
        attributes: {
          friendly_name: 'Salon — termostat',
          current_temperature: 21.8,
          temperature: 22.5,
          temperature_unit: '°C',
          hvac_modes: ['off', 'heat', 'cool', 'auto'],
        },
      },
    ]),
  )
}
