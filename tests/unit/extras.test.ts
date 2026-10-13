import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration, pictureFrame, sanitizeSettings } from '../../shared/extras';

describe('timing', () => {
  it('reads planned lengths', () => {
    expect(parseDuration('5')).toBe(300);
    expect(parseDuration('4:30')).toBe(270);
    expect(parseDuration('1:05:00')).toBe(3900);
    expect(parseDuration('')).toBe(0);
    expect(parseDuration('five')).toBeNull();
  });
  it('formats lengths', () => {
    expect(formatDuration(270)).toBe('4:30');
    expect(formatDuration(3900)).toBe('1:05:00');
  });
});

describe('safe margins', () => {
  it('keeps the picture 16:9 inside the margins', () => {
    expect(pictureFrame({ top: 5, right: 5, bottom: 5, left: 5 })).toEqual({ scale: 0.9, x: 5, y: 5 });
    const f = pictureFrame({ top: 0, right: 0, bottom: 10, left: 0 });
    expect(f.scale).toBeCloseTo(0.9);
    expect(f.x).toBeCloseTo(5);
    expect(f.y).toBe(0);
  });
});

describe('settings', () => {
  it('fills in defaults for older files', () => {
    const s = sanitizeSettings(undefined);
    expect(s.logUsage).toBe(false);
    expect(s.screens.stageLayout).toBe('standard');
    expect(s.alertPresets.length).toBeGreaterThan(0);
  });
  it('clamps bad values', () => {
    const s = sanitizeSettings({ screens: { projector: { top: 99, right: -3 }, stageTextScale: 999 } });
    expect(s.screens.projector.top).toBe(25);
    expect(s.screens.projector.right).toBe(0);
    expect(s.screens.stageTextScale).toBe(200);
  });
});
