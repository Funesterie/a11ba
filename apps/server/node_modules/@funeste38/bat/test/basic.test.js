const assert = require('assert');
const { EchoRadar, BatWings } = require('../dist');

// Basic tests for EchoRadar and BatWings
(async function() {
  // EchoRadar start/stop
  const radar = new EchoRadar({ baselineMs: 100, alpha: 0.1, maxAttempts: 2 });
  const id = radar.start('test');
  // simulate delay
  await new Promise(r => setTimeout(r, 50));
  const echo = radar.stop(id);
  assert.ok(echo, 'echo should be returned');
  assert.ok(typeof echo.rtt === 'number');
  assert.ok(['short','normal','slow','timeout'].includes(echo.cls));

  // BatWings adjust
  const wings = new BatWings();
  wings.applyProfile('short');
  assert.ok(wings.state.rate >= 1);
  console.log('basic tests passed');
})();
