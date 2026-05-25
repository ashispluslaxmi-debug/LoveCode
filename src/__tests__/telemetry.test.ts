import { describe, it, expect, afterEach } from 'vitest';
import { isTelemetryEnabled, enableTelemetry, disableTelemetry, getTelemetryData, clearTelemetryData } from '../telemetry/telemetry.js';

describe('Telemetry System', () => {
  afterEach(() => {
    disableTelemetry('/tmp/lovecode-test-telemetry');
    clearTelemetryData('/tmp/lovecode-test-telemetry');
  });

  it('is disabled by default', () => {
    expect(isTelemetryEnabled('/tmp/lovecode-test-telemetry')).toBe(false);
  });

  it('can be enabled', () => {
    enableTelemetry('/tmp/lovecode-test-telemetry');
    expect(isTelemetryEnabled('/tmp/lovecode-test-telemetry')).toBe(true);
  });

  it('can be disabled', () => {
    enableTelemetry('/tmp/lovecode-test-telemetry');
    disableTelemetry('/tmp/lovecode-test-telemetry');
    expect(isTelemetryEnabled('/tmp/lovecode-test-telemetry')).toBe(false);
  });

  it('collects no events when disabled', () => {
    clearTelemetryData('/tmp/lovecode-test-telemetry');
    const data = getTelemetryData('/tmp/lovecode-test-telemetry');
    expect(data.events.length).toBe(0);
    expect(data.crashes.length).toBe(0);
  });

  it('clears all data', () => {
    clearTelemetryData('/tmp/lovecode-test-telemetry');
    const data = getTelemetryData('/tmp/lovecode-test-telemetry');
    expect(data.events.length).toBe(0);
  });
});
