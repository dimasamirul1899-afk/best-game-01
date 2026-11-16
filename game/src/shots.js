// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from a
// fresh world for a fixed number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 240;

/** The autopilot: flee what is close, chase what is far, grab a pickup when it is safe. */
export function autopilot(state, calm) {
  const player = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  let move = { x: 0, y: 0 };
  if (calm) {
    const a = state.elapsed * 0.5;
    move = { x: Math.cos(a), y: Math.sin(a) * 0.6 };
  } else if (nearest && nearestD < 150) {
    const d = Math.max(1, nearestD);
    move = { x: (player.x - nearest.x) / d, y: (player.y - nearest.y) / d };
  } else if (nearest) {
    const d = Math.max(1, nearestD);
    move = nearestD > 160
      ? { x: (nearest.x - player.x) / d, y: (nearest.y - player.y) / d }
      : { x: (player.y - nearest.y) / d, y: (nearest.x - player.x) / d };
  }
  // Lead the target: aim where it will be when the bullet gets there.
  let aim = { x: FIELD.width / 2, y: 0 };
  if (nearest) {
    const flight = nearestD / PLAYER.bulletSpeed;
    aim = { x: nearest.x + nearest.vx * flight, y: nearest.y + nearest.vy * flight };
  }
  let firing = !!nearest && nearestD < 560;
  if (!calm && player.shield === false) {
    let pickup = null;
    let pickupD = Infinity;
    for (const p of state.pickups) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < pickupD) {
        pickupD = d;
        pickup = p;
      }
    }
    if (pickup && pickupD < 260 && (!nearest || nearestD > 130)) {
      const d = Math.max(1, pickupD);
      move = { x: (pickup.x - player.x) / d, y: (pickup.y - player.y) / d };
    }
  }
  return { move, aim, firing };
}

/**
 * The end scene's pilot: it plays well for the first seconds, building a score, then stops
 * shooting and rams the nearest enemy, so the waves catch it and the game ends.
 */
function dumbPilot(state) {
  if (state.elapsed < 25) return autopilot(state, false);
  let nearest = null;
  let nearestD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  const d = Math.max(1, nearestD);
  return {
    move: nearest ? { x: (nearest.x - state.player.x) / d, y: (nearest.y - state.player.y) / d } : { x: 0, y: 0 },
    aim: nearest ? { x: nearest.x, y: nearest.y } : { x: FIELD.width / 2, y: 0 },
    firing: false,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      const pilot = autopilot(world.state, true);
      world.step(STEP, pilot.move, pilot.aim, pilot.firing, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const pilotFn = name === 'end' ? dumbPilot : (state) => autopilot(state, false);
  for (let i = 0; i < limit / STEP; i += 1) {
    const pilot = pilotFn(world.state);
    if (world.step(STEP, pilot.move, pilot.aim, pilot.firing, false) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
