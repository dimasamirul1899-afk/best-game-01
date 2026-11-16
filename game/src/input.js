// Keyboard and pointer input for a twin-stick shooter. Held keys give a move vector; the mouse
// gives an aim point (converted to field coordinates by the caller); one-shot presses (start or
// restart, pause, mute) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. Firing is held, not pressed: mouse down or Space.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const FIRE = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target, toField) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let firing = false;
  let mouse = { x: 0, y: 0 };
  let aim = { x: 640, y: 200 };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (FIRE.has(event.code)) {
      firing = true;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (FIRE.has(event.code)) firing = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    firing = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouse = { x: event.clientX, y: event.clientY };
    aim = toField(mouse.x, mouse.y);
  });
  target.addEventListener('pointerdown', (event) => {
    mouse = { x: event.clientX, y: event.clientY };
    aim = toField(mouse.x, mouse.y);
    if (event.button === 0) firing = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised move vector from the held keys, as {x, y}. */
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    /** The aim point in field coordinates, from the last mouse position. */
    aim() {
      return aim;
    },
    /** True while the fire button or Space is held. */
    firing() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
