// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 340,
  accel: 2600,
  drag: 4.2,
  fireInterval: 0.16,
  rapidInterval: 0.085,
  bulletSpeed: 720,
  invulnerable: 2,
  shieldTime: 0,
};

export const LIVES = 3;

/** Seconds of breather between waves, and the wave the spawn counts stop growing at. */
export const WAVE = { breather: 3, max: 12, baseCount: 6, perWave: 3 };

export const ENEMY = {
  chaser: { radius: 15, speed: 118, hp: 1, score: 100, color: '#ff3d81' },
  weaver: { radius: 13, speed: 165, hp: 1, score: 150, color: '#22d3ee' },
  splitter: { radius: 22, speed: 82, hp: 2, score: 200, color: '#fb923c' },
  mini: { radius: 9, speed: 205, hp: 1, score: 50, color: '#fdba74' },
  shooter: { radius: 16, speed: 95, hp: 2, score: 250, color: '#c084fc' },
};

/** Enemy bullets: slow orbs the shooter fires. */
export const ORB = { radius: 6, speed: 230, interval: 2.2 };

export const BULLET = { radius: 4, life: 0.9 };

/** Pickups: how long each effect lasts, and how often one drops from a kill. */
export const PICKUP = { radius: 11, dropChance: 0.14, spreadTime: 12, rapidTime: 8 };

export const COMBO = { window: 3, step: 0.5, max: 5 };

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOL = { enemies: 48, bullets: 128, orbs: 64, particles: 256, pickups: 12, floats: 24 };

export const PALETTE = {
  backdrop: '#05060f',
  grid: '#12142b',
  star: '#8b93c9',
  player: '#facc15',
  playerCore: '#fff7cc',
  bullet: '#fde047',
  orb: '#e879f9',
  shield: '#22d3ee',
  spread: '#4ade80',
  rapid: '#f472b6',
  bomb: '#f8fafc',
  panel: '#0d1024',
  panelEdge: '#2b3160',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#ff3d81',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';
