// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Neon glow
// comes from shadowBlur on the shapes that need it; the background grid and vignette are cached
// at resize so a frame allocates nothing.
import { FIELD, FONT, LIVES, PALETTE, PLAYER } from './config.js';
import { KIND_CHASER, KIND_MINI, KIND_SHOOTER, KIND_SPLITTER, KIND_WEAVER, PICK_BOMB, PICK_RAPID, PICK_SHIELD, PICK_SPREAD } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 72 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const killsLabel = cachedLabel('KILLS ');
  const comboLabel = cachedLabel('BEST COMBO x');
  let vignette = null;
  let gridPattern = null;

  const fonts = new Map();
  function text(value, x, y, size, color, align, glow) {
    if (!fonts.has(size)) fonts.set(size, `700 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.shadowColor = glow || 'transparent';
    context.shadowBlur = glow ? 18 : 0;
    context.fillText(value, x, y);
    context.shadowBlur = 0;
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    const grad = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    grad.addColorStop(0, 'rgba(5,6,15,0)');
    grad.addColorStop(1, 'rgba(2,3,8,0.55)');
    vignette = grad;
    const off = document.createElement('canvas');
    off.width = 80;
    off.height = 80;
    const octx = off.getContext('2d');
    octx.strokeStyle = PALETTE.grid;
    octx.lineWidth = 1;
    octx.strokeRect(0.5, 0.5, 80, 80);
    gridPattern = context.createPattern(off, 'repeat');
  }

  function poly(x, y, r, sides, rot) {
    context.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }

  function drawBackground(state) {
    context.fillStyle = '#07081a';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = gridPattern;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const s of state.stars) {
      const tw = 0.5 + 0.5 * Math.sin(state.elapsed * 2 + s.x);
      context.globalAlpha = 0.25 + 0.55 * s.z * tw;
      context.fillStyle = PALETTE.star;
      context.fillRect(s.x, s.y, s.size, s.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(x, y, angle, color, core, radius, flame) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.shadowColor = color;
    context.shadowBlur = 16;
    if (flame > 0) {
      context.fillStyle = '#fb923c';
      context.beginPath();
      context.moveTo(-radius * 0.7, 5);
      context.lineTo(-radius * 0.7 - flame, 0);
      context.lineTo(-radius * 0.7, -5);
      context.closePath();
      context.fill();
    }
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(radius, 0);
    context.lineTo(-radius * 0.85, radius * 0.75);
    context.lineTo(-radius * 0.45, 0);
    context.lineTo(-radius * 0.85, -radius * 0.75);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawEnemy(e) {
    const props = [
      { color: '#ff3d81', sides: 3 }, { color: '#22d3ee', sides: 4 },
      { color: '#fb923c', sides: 6 }, { color: '#fdba74', sides: 3 },
      { color: '#c084fc', sides: 4 },
    ][e.kind];
    context.save();
    context.translate(e.x, e.y);
    context.shadowColor = props.color;
    context.shadowBlur = 14;
    context.strokeStyle = props.color;
    context.lineWidth = 2.5;
    if (e.kind === KIND_WEAVER) context.rotate(e.t * 2 + e.phase);
    else if (e.kind === KIND_SPLITTER) context.rotate(e.t * 0.8);
    else if (e.kind === KIND_SHOOTER) context.rotate(Math.PI / 4);
    else if (e.kind === KIND_MINI) context.rotate(e.t * 5);
    else context.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
    poly(0, 0, e.radius, props.sides, 0);
    context.stroke();
    context.globalAlpha = 0.25;
    context.fillStyle = props.color;
    context.fill();
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    if (e.kind === KIND_SHOOTER) {
      context.fillStyle = '#e879f9';
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (e.hp > 1) {
      context.fillStyle = '#fff';
      context.fillRect(e.x - 10, e.y - e.radius - 10, 20 * (e.hp / 2), 3);
    }
  }

  function drawPickup(p) {
    const pulse = 1 + 0.12 * Math.sin(p.t * 6);
    const r = 11 * pulse;
    context.save();
    context.translate(p.x, p.y);
    context.shadowBlur = 14;
    if (p.kind === PICK_SHIELD) {
      context.shadowColor = PALETTE.shield;
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, r, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.shield;
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.fill();
    } else if (p.kind === PICK_SPREAD) {
      context.shadowColor = PALETTE.spread;
      context.fillStyle = PALETTE.spread;
      for (const dx of [-7, 0, 7]) {
        context.beginPath();
        context.arc(dx, 0, 3.5, 0, Math.PI * 2);
        context.fill();
      }
    } else if (p.kind === PICK_RAPID) {
      context.shadowColor = PALETTE.rapid;
      context.fillStyle = PALETTE.rapid;
      context.beginPath();
      context.moveTo(2, -r);
      context.lineTo(-5, 2);
      context.lineTo(0, 2);
      context.lineTo(-2, r);
      context.lineTo(5, -2);
      context.lineTo(0, -2);
      context.closePath();
      context.fill();
    } else {
      context.shadowColor = PALETTE.bomb;
      context.fillStyle = PALETTE.bomb;
      poly(0, 0, r + 2, 5, -Math.PI / 2);
      context.fill();
    }
    context.restore();
  }

  function drawField(state) {
    drawBackground(state);
    for (const p of state.pickups) {
      if (!p.active) continue;
      drawPickup(p);
    }
    for (const o of state.orbs) {
      if (!o.active) continue;
      const pulse = 1 + 0.15 * Math.sin(state.elapsed * 8 + o.x);
      context.save();
      context.shadowColor = PALETTE.orb;
      context.shadowBlur = 16;
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(o.x, o.y, 6 * pulse, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    for (const e of state.enemies) {
      if (!e.active) continue;
      drawEnemy(e);
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.save();
      context.shadowColor = PALETTE.bullet;
      context.shadowBlur = 10;
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    const player = state.player;
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      const speed = Math.hypot(player.vx, player.vy);
      drawShip(player.x, player.y, player.angle, PALETTE.player, PALETTE.playerCore, PLAYER.radius, speed > 60 ? 10 + speed * 0.03 : 0);
      if (player.shield) {
        context.save();
        context.strokeStyle = PALETTE.shield;
        context.lineWidth = 2;
        context.shadowColor = PALETTE.shield;
        context.shadowBlur = 14;
        context.beginPath();
        context.arc(player.x, player.y, PLAYER.radius + 9 + Math.sin(state.elapsed * 5) * 2, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    context.textBaseline = 'alphabetic';
    for (const f of state.floats) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 20, '#fff', 'center', '#facc15');
    }
    context.globalAlpha = 1;
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state, ui) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 30, PALETTE.text, 'center');
    if (state.combo > 1) {
      const mult = (1 + Math.min(state.combo - 1, 8) * 0.5).toFixed(1);
      text(`COMBO x${mult}`, FIELD.width / 2, 54, 22, '#f472b6', 'center', '#f472b6');
    }
    const firstLife = FIELD.width - 24 - LIVES * 30;
    for (let life = 0; life < LIVES; life += 1) {
      const x = firstLife + life * 30 + 10;
      if (life < state.lives) drawShip(x, 34, -Math.PI / 2, PALETTE.player, PALETTE.playerCore, 9, 0);
      else {
        context.save();
        context.globalAlpha = 0.25;
        drawShip(x, 34, -Math.PI / 2, PALETTE.muted, PALETTE.muted, 9, 0);
        context.restore();
      }
    }
    let barY = FIELD.height - 30;
    const bars = [];
    if (state.player.spreadTime > 0) bars.push({ label: 'SPREAD', left: state.player.spreadTime / 12, color: PALETTE.spread });
    if (state.player.rapidTime > 0) bars.push({ label: 'RAPID', left: state.player.rapidTime / 8, color: PALETTE.rapid });
    if (state.player.shield) bars.push({ label: 'SHIELD', left: 1, color: PALETTE.shield });
    for (const bar of bars) {
      context.fillStyle = 'rgba(255,255,255,0.15)';
      context.fillRect(24, barY, 150, 8);
      context.fillStyle = bar.color;
      context.fillRect(24, barY, 150 * bar.left, 8);
      text(bar.label, 182, barY - 4, 15, bar.color, 'left');
      barY -= 24;
    }
    if (ui.muted) text('MUTED (M)', 24, FIELD.height - 58, 16, PALETTE.muted, 'left');
    if (ui.banner) {
      context.globalAlpha = Math.min(1, ui.bannerT * 2);
      text(ui.banner, FIELD.width / 2, FIELD.height / 2 - 120, 56, '#fff', 'center', '#22d3ee');
      context.globalAlpha = 1;
    }
    if (state.waveState === 'breather' && ui.screen === SCREEN_PLAY) {
      text(`NEXT WAVE IN ${Math.max(1, Math.ceil(state.waveTimer))}`, FIELD.width / 2, FIELD.height / 2 - 60, 26, PALETTE.muted, 'center');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.save();
    context.fillStyle = 'rgba(5,6,15,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.rect(x, y, PANEL.width, height);
    context.fill();
    context.stroke();
    context.restore();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center', accent || '#22d3ee');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.spread, 'center');
  }

  const TITLE_LINES = [
    'WASD or arrows to fly. Mouse to aim. Hold click or Space to fire.',
    'Survive the waves. Chain kills for combo. Grab pickups: shield, spread, rapid, nova.',
    'P pauses. M mutes. Enemies: chasers, weavers, splitters, shooters.',
    '',
  ];
  const PAUSED_LINES = ['The void will wait for you.'];
  const OVER_LINES = ['', '', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake * state.shake * 14;
    const sx = (Math.random() * 2 - 1) * shake;
    const sy = (Math.random() * 2 - 1) * shake;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = bestLabel(best);
      drawPanel('NEON VOID', TITLE_LINES, 'Press Space or click to launch', '#facc15');
      return;
    }
    drawHud(state, { ...ui, screen });
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = killsLabel(state.kills);
      OVER_LINES[3] = comboLabel(state.bestCombo);
      drawPanel('Game over', OVER_LINES, 'Press Space or click to fly again', '#ff3d81');
    }
  }

  /** Convert a window point (client pixels) to a field point. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
