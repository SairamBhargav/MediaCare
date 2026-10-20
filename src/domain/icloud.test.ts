import { cloudBlockReason, cloudNote, type ConnectionState } from './icloud';

const wifi: ConnectionState = {
  known: true,
  connected: true,
  expensive: false,
  constrained: false,
  lowPower: false,
};
const wifiOnly = { allowMobileData: false };

test('Wi-Fi is allowed', () => {
  expect(cloudBlockReason(wifi, wifiOnly)).toBeNull();
});

test('mobile data needs the second switch', () => {
  const cellular = { ...wifi, expensive: true };
  expect(cloudBlockReason(cellular, wifiOnly)).toBe('mobile-data');
  expect(cloudBlockReason(cellular, { allowMobileData: true })).toBeNull();
});

test('offline or unknown connection blocks', () => {
  expect(cloudBlockReason({ ...wifi, connected: false }, wifiOnly)).toBe('offline');
  expect(cloudBlockReason({ ...wifi, known: false }, wifiOnly)).toBe('offline');
});

test('Low Power and Low Data Mode block even with mobile data allowed', () => {
  const allow = { allowMobileData: true };
  expect(cloudBlockReason({ ...wifi, lowPower: true }, allow)).toBe('low-power');
  expect(cloudBlockReason({ ...wifi, constrained: true }, allow)).toBe('low-data');
});

describe('cloudNote', () => {
  const base = {
    inCloud: 10,
    available: true,
    enabled: false,
    allowMobileData: false,
    blocked: undefined,
  };

  test('nothing to say without iCloud photos', () => {
    expect(cloudNote({ ...base, inCloud: 0 })).toBeNull();
  });

  test('older builds are asked to update', () => {
    expect(cloudNote({ ...base, available: false })?.text).toMatch(/Update MediaCare/);
  });

  test('switch off: points to Settings', () => {
    expect(cloudNote(base)).toEqual({
      text: expect.stringMatching(/Include photos in iCloud/),
      offerSettings: true,
    });
  });

  test('switch on: says why the last check stopped, or when they download', () => {
    const on = { ...base, enabled: true };
    expect(cloudNote({ ...on, blocked: 'mobile-data' })?.text).toMatch(/mobile data/);
    expect(cloudNote(on)?.text).toMatch(/on Wi-Fi/);
    expect(cloudNote({ ...on, allowMobileData: true })?.text).not.toMatch(/Wi-Fi/);
  });
});
