// The game's rules and state, with no drawing and no browser in it: the player's ship, the
// waves of enemies, bullets, orbs, pickups, particles and score. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react (sound, announcements) without
// the world knowing about screens or audio. Nothing here allocates after createWorld returns.
import { BULLET, COMBO, ENEMY, FIELD, LIVES, ORB, PICKUP, PLAYER, POOL, WAVE } from './config.js';

export const KIND_CHASER = 0;
export const KIND_WEAVER = 1;
export const KIND_SPLITTER = 2;
export const KIND_MINI = 3;
export const KIND_SHOOTER = 4;

export const PICK_SHIELD = 0;
export const PICK_SPREAD = 1;
export const PICK_RAPID = 2;
export const PICK_BOMB = 3;

export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_HIT = 4;
export const EVENT_PICKUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_OVER = 32;

const KIND_PROPS = [ENEMY.chaser, ENEMY.weaver, ENEMY.splitter, ENEMY.mini, ENEMY.shooter];
const KIND_COLORS = [ENEMY.chaser.color, ENEMY.weaver.color, ENEMY.splitter.color, ENEMY.mini.color, ENEMY.shooter.color];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
    fireTimer: 0, invulnerable: 0, shield: false, spreadTime: 0, rapidTime: 0,
  };
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 10, t: 0, fireTimer: 0, phase: 0 });
  }
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const orbs = [];
  for (let i = 0; i < POOL.orbs; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2 });
  }
  const pickups = [];
  for (let i = 0; i < POOL.pickups; i += 1) pickups.push({ active: false, kind: 0, x: 0, y: 0, t: 0 });
  const floats = [];
  for (let i = 0; i < POOL.floats; i += 1) floats.push({ active: false, x: 0, y: 0, text: '', life: 0 });
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, z: 0.3 + random() * 0.7, size: 1 + random() * 2 });
  }
  const state = {
    player, enemies, bullets, orbs, particles, pickups, floats, stars,
    score: 0, lives: LIVES, wave: 1, kills: 0, combo: 0, comboTimer: 0,
    elapsed: 0, shake: 0, waveState: 'breather', waveTimer: 1.2, spawnQueue: 0, spawnTimer: 0,
    bestCombo: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.fireTimer = 0;
    player.invulnerable = 0;
    player.shield = false;
    player.spreadTime = 0;
    player.rapidTime = 0;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const o of orbs) o.active = false;
    for (const p of particles) p.active = false;
    for (const p of pickups) p.active = false;
    for (const f of floats) f.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.waveState = 'breather';
    state.waveTimer = 1.2;
    state.spawnQueue = 0;
    state.spawnTimer = 0;
    state.bestCombo = 0;
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.color = color;
      p.size = 1.5 + random() * 2.5;
    }
  }

  function floatText(x, y, text) {
    const f = free(floats);
    if (!f) return;
    f.active = true;
    f.x = x;
    f.y = y;
    f.text = text;
    f.life = 1.1;
  }

  function pickKind() {
    const w = state.wave;
    const roll = random();
    if (w >= 4 && roll < 0.16) return KIND_SHOOTER;
    if (w >= 3 && roll < 0.38) return KIND_SPLITTER;
    if (w >= 2 && roll < 0.62) return KIND_WEAVER;
    return KIND_CHASER;
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (!e) return;
    const props = KIND_PROPS[kind];
    const edge = Math.floor(random() * 4);
    const m = 30;
    if (edge === 0) { e.x = random() * FIELD.width; e.y = -m; }
    else if (edge === 1) { e.x = FIELD.width + m; e.y = random() * FIELD.height; }
    else if (edge === 2) { e.x = random() * FIELD.width; e.y = FIELD.height + m; }
    else { e.x = -m; e.y = random() * FIELD.height; }
    e.active = true;
    e.kind = kind;
    e.vx = 0;
    e.vy = 0;
    e.hp = props.hp;
    e.radius = props.radius;
    e.t = 0;
    e.phase = random() * Math.PI * 2;
    e.fireTimer = 1 + random() * 1.5;
  }

  function spawnPickup(x, y) {
    const p = free(pickups);
    if (!p) return;
    const roll = random();
    p.active = true;
    p.kind = roll < 0.3 ? PICK_SHIELD : roll < 0.58 ? PICK_SPREAD : roll < 0.86 ? PICK_RAPID : PICK_BOMB;
    p.x = x;
    p.y = y;
    p.t = 0;
  }

  function startWave() {
    state.waveState = 'spawning';
    state.spawnQueue = Math.min(WAVE.baseCount + WAVE.perWave * (state.wave - 1), 34);
    state.spawnTimer = 0.4;
  }

  function killEnemy(e, award) {
    e.active = false;
    state.kills += 1;
    burst(e.x, e.y, KIND_COLORS[e.kind], e.kind === KIND_SPLITTER ? 22 : 14, 260);
    if (e.kind === KIND_SPLITTER) {
      for (let i = 0; i < 2; i += 1) {
        const mini = free(enemies);
        if (!mini) break;
        mini.active = true;
        mini.kind = KIND_MINI;
        mini.x = e.x + (i === 0 ? -14 : 14);
        mini.y = e.y;
        mini.vx = (i === 0 ? -120 : 120);
        mini.vy = -60;
        mini.hp = 1;
        mini.radius = ENEMY.mini.radius;
        mini.t = 0;
        mini.phase = random() * Math.PI * 2;
        mini.fireTimer = 0;
      }
    }
    if (award) {
      state.combo += 1;
      state.comboTimer = COMBO.window;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      const mult = 1 + Math.min(state.combo - 1, 8) * COMBO.step;
      const points = Math.round(KIND_PROPS[e.kind].score * mult);
      state.score += points;
      floatText(e.x, e.y, `+${points}`);
      if (state.combo > 1 && state.combo % 5 === 0) floatText(e.x, e.y - 22, `COMBO x${mult.toFixed(1)}`);
      if (random() < PICKUP.dropChance) spawnPickup(e.x, e.y);
    }
  }

  function damagePlayer(events) {
    if (player.invulnerable > 0) return events;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1;
      burst(player.x, player.y, '#22d3ee', 18, 300);
      state.shake = Math.min(1, state.shake + 0.35);
      return events | EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 1;
    burst(player.x, player.y, '#facc15', 30, 340);
    events |= EVENT_HIT;
    if (state.lives <= 0) events |= EVENT_OVER;
    return events;
  }

  function fireBullet(angle) {
    const b = free(bullets);
    if (!b) return;
    b.active = true;
    b.x = player.x + Math.cos(angle) * (PLAYER.radius + 6);
    b.y = player.y + Math.sin(angle) * (PLAYER.radius + 6);
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed + player.vx * 0.4;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed + player.vy * 0.4;
    b.life = BULLET.life;
  }

  /**
   * One fixed step. `move` is a normalised {x, y} vector, `aim` a field point, `firing` held.
   * With `harmless` set (the title screen's backdrop) enemies drift but nothing scores, nothing
   * hurts the player and the wave never advances: it is scenery, not a game.
   */
  function step(dt, move, aim, firing, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.spreadTime > 0) player.spreadTime = Math.max(0, player.spreadTime - dt);
    if (player.rapidTime > 0) player.rapidTime = Math.max(0, player.rapidTime - dt);

    // The ship: accelerate toward the stick, drag, clamp to the field.
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const drag = Math.max(0, 1 - PLAYER.drag * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = (player.vx / speed) * PLAYER.speed;
      player.vy = (player.vy / speed) * PLAYER.speed;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);

    // Firing: one bullet, or three with the spread pickup.
    player.fireTimer -= dt;
    if (firing && player.fireTimer <= 0 && !harmless) {
      const interval = player.rapidTime > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
      player.fireTimer = interval;
      fireBullet(player.angle);
      if (player.spreadTime > 0) {
        fireBullet(player.angle - 0.22);
        fireBullet(player.angle + 0.22);
      }
      events |= EVENT_SHOOT;
    }

    // Waves: breather, then a spawn queue, then the wave ends when the field is clear.
    if (harmless) {
      // The title screen's backdrop: a few enemies drift in and chase the ship, nothing more.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        let n = 0;
        for (const e of enemies) if (e.active) n += 1;
        if (n < 6) spawnEnemy(pickKind());
        state.spawnTimer = 1.2;
      }
    } else if (state.waveState === 'breather') {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) startWave();
      } else if (state.waveState === 'spawning') {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.spawnQueue > 0) {
          spawnEnemy(pickKind());
          state.spawnQueue -= 1;
          state.spawnTimer = Math.max(0.25, 0.85 - state.wave * 0.04);
        }
        let alive = state.spawnQueue > 0;
        for (const e of enemies) if (e.active) { alive = true; break; }
        if (!alive) {
          const bonus = 250 + state.wave * 100;
          state.score += bonus;
          floatText(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE ${state.wave} CLEAR  +${bonus}`);
          state.wave += 1;
          state.waveState = 'breather';
          state.waveTimer = WAVE.breather;
          events |= EVENT_WAVE;
        }
      }

    // Enemies: each kind steers differently; shooters fire orbs.
    for (const e of enemies) {
      if (!e.active) continue;
      e.t += dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const props = KIND_PROPS[e.kind];
      if (e.kind === KIND_CHASER || e.kind === KIND_MINI) {
        e.vx += (dx / d) * props.speed * 2.4 * dt;
        e.vy += (dy / d) * props.speed * 2.4 * dt;
      } else if (e.kind === KIND_WEAVER) {
        const px = -dy / d;
        const py = dx / d;
        const wob = Math.sin(e.t * 4 + e.phase) * 180;
        e.vx += ((dx / d) * props.speed * 2 + px * wob) * dt;
        e.vy += ((dy / d) * props.speed * 2 + py * wob) * dt;
      } else if (e.kind === KIND_SPLITTER) {
        e.vx += (dx / d) * props.speed * 2 * dt;
        e.vy += (dy / d) * props.speed * 2 * dt;
      } else if (e.kind === KIND_SHOOTER) {
        const want = d > 320 ? 1 : d < 200 ? -1 : 0;
        e.vx += (dx / d) * props.speed * 1.6 * want * dt;
        e.vy += (dy / d) * props.speed * 1.6 * want * dt;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && !harmless && d < 560) {
          e.fireTimer = ORB.interval + random() * 0.8;
          const o = free(orbs);
          if (o) {
            o.active = true;
            o.x = e.x;
            o.y = e.y;
            o.vx = (dx / d) * ORB.speed;
            o.vy = (dy / d) * ORB.speed;
          }
        }
      }
      const es = Math.hypot(e.vx, e.vy);
      if (es > props.speed) {
        e.vx = (e.vx / es) * props.speed;
        e.vy = (e.vy / es) * props.speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < -60 || e.x > FIELD.width + 60 || e.y < -60 || e.y > FIELD.height + 60) {
        e.x = Math.min(FIELD.width + 40, Math.max(-40, e.x));
        e.y = Math.min(FIELD.height + 40, Math.max(-40, e.y));
      }
    }

    // Bullets: fly straight, die on a hit or at the edge.
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + BULLET.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.active = false;
          e.hp -= 1;
          burst(b.x, b.y, KIND_COLORS[e.kind], 4, 160);
          if (e.hp <= 0) {
            killEnemy(e, true);
            events |= EVENT_KILL;
          }
          break;
        }
      }
    }

    // Orbs: drift, die at the edge or on the player.
    for (const o of orbs) {
      if (!o.active) continue;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        o.active = false;
        continue;
      }
      if (!harmless) {
        const rr = PLAYER.radius + ORB.radius;
        if (dist2(o.x, o.y, player.x, player.y) < rr * rr) {
          o.active = false;
          events = damagePlayer(events);
        }
      }
    }

    // Enemies touching the ship.
    if (!harmless) {
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + PLAYER.radius - 2;
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
          killEnemy(e, false);
          events = damagePlayer(events);
          if (events & EVENT_OVER) break;
        }
      }
    }

    // Pickups: drift down slowly, apply on touch.
    for (const p of pickups) {
      if (!p.active) continue;
      p.t += dt;
      p.y += 26 * dt;
      if (p.y > FIELD.height + 20) { p.active = false; continue; }
      if (harmless) continue;
      const rr = PICKUP.radius + PLAYER.radius;
      if (dist2(p.x, p.y, player.x, player.y) < rr * rr) {
        p.active = false;
        if (p.kind === PICK_SHIELD) {
          player.shield = true;
          floatText(player.x, player.y - 26, 'SHIELD!');
        } else if (p.kind === PICK_SPREAD) {
          player.spreadTime = PICKUP.spreadTime;
          floatText(player.x, player.y - 26, 'SPREAD SHOT!');
        } else if (p.kind === PICK_RAPID) {
          player.rapidTime = PICKUP.rapidTime;
          floatText(player.x, player.y - 26, 'RAPID FIRE!');
        } else {
          for (const e of enemies) if (e.active) killEnemy(e, true);
          floatText(player.x, player.y - 26, 'NOVA BOMB!');
          state.shake = 1;
        }
        events |= EVENT_PICKUP;
      }
    }

    // Particles and floating text fade out.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - 2.4 * dt);
      p.vy *= Math.max(0, 1 - 2.4 * dt);
    }
    for (const f of floats) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      f.y -= 34 * dt;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
