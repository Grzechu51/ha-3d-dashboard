import { describe, expect, test } from 'bun:test'
import {
  entityFriendlyName,
  formatHomeAssistantEntityDetail,
  formatHomeAssistantEntityValue,
  numericEntityAttribute,
  stringListEntityAttribute,
} from './entity-display'

describe('Home Assistant entity display', () => {
  test('formats sensors with their units', () => {
    const entity = {
      entityId: 'sensor.salon_temperature',
      state: '22.4',
      attributes: {
        friendly_name: 'Salon temperature',
        unit_of_measurement: '°C',
      },
    }

    expect(entityFriendlyName(entity)).toBe('Salon temperature')
    expect(formatHomeAssistantEntityValue(entity)).toBe('22.4 °C')
  })

  test('formats common binary sensor device classes', () => {
    expect(
      formatHomeAssistantEntityValue({
        entityId: 'binary_sensor.motion',
        state: 'on',
        attributes: { device_class: 'motion' },
      }),
    ).toBe('Detected')
    expect(
      formatHomeAssistantEntityValue({
        entityId: 'binary_sensor.window',
        state: 'off',
        attributes: { device_class: 'window' },
      }),
    ).toBe('Closed')
  })

  test('formats climate current and target temperatures', () => {
    const entity = {
      entityId: 'climate.salon',
      state: 'heat',
      attributes: {
        current_temperature: 21.5,
        temperature: 22.5,
        temperature_unit: '°C',
        hvac_modes: ['off', 'heat', 'cool'],
      },
    }

    expect(formatHomeAssistantEntityValue(entity)).toBe('21.5 °C')
    expect(formatHomeAssistantEntityDetail(entity)).toBe('Target 22.5 °C · heat')
    expect(numericEntityAttribute(entity, 'temperature')).toBe(22.5)
    expect(stringListEntityAttribute(entity, 'hvac_modes')).toEqual(['off', 'heat', 'cool'])
  })
})
