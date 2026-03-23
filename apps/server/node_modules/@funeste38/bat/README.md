# @funeste38/bat 🦇

[![npm version](https://img.shields.io/npm/v/@funeste38/bat.svg)](https://www.npmjs.com/package/@funeste38/bat)
[![CI](https://github.com/jEFFLEZ/bat/actions/workflows/publish.yml/badge.svg)](https://github.com/jEFFLEZ/bat/actions)

Adaptive request controller inspired by bats.

Components:
- `Bat` (sonar): measure RTT, classify signals.
- `Ears`: analyze response quality, origin, noise filtering.
- `Wings`: adapt behavior (speed, retries, abort, cooldown).
- `Fangs`: multi-channel parallel requests (proxy/IP rotation).
- `Inversion`: upside-down fallback, bypass BAT on failure.
- `Heart`: periodic ticks & safety cycle.
- `Memory`: short-term memory.
- `Hormones`: global stress level.
- `Immune`: ban unstable channels.
- `Sleep`: long recovery mode.

Quick usage

```ts
import { Bat, Ears, Wings, Fangs } from '@funeste38/bat';

const bat = new Bat();
const ears = new Ears();
const wings = new Wings();
const fangs = new Fangs({ channels: [] });
```

Docs & demo

See `packages/bat/src/demo.ts` for a local demonstration.

License: MIT
