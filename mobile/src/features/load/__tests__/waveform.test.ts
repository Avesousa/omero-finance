import test from "node:test";
import assert from "node:assert/strict";
import { buildWaveform, flatWaveform, meterToLevel, WAVEFORM_BARS } from "../waveform.ts";

test("meterToLevel: dB a 0..1", () => {
  assert.equal(meterToLevel(-60), 0);
  assert.equal(meterToLevel(0), 1);
  assert.equal(meterToLevel(-30), 0.5);
  assert.equal(meterToLevel(-160), 0);
  assert.equal(meterToLevel(NaN), 0);
});

test("buildWaveform: 32 barras en 0..1, la más alta vale 1", () => {
  const samples = Array.from({ length: 200 }, (_, i) => (i % 20) / 20);
  const w = buildWaveform(samples);
  assert.equal(w.length, WAVEFORM_BARS);
  assert.ok(w.every((v) => v >= 0.08 && v <= 1));
  assert.equal(Math.max(...w), 1);
});

test("buildWaveform: pocas muestras o silencio total → onda pareja", () => {
  assert.deepEqual(buildWaveform([0.2, 0.3]), flatWaveform());
  assert.deepEqual(buildWaveform(new Array(50).fill(0)), flatWaveform());
  assert.equal(flatWaveform().length, WAVEFORM_BARS);
});

test("buildWaveform: menos muestras que barras también da 32", () => {
  assert.equal(buildWaveform([0.1, 0.5, 0.9, 0.4, 0.2, 0.7]).length, WAVEFORM_BARS);
});
