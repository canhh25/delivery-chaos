import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game; // for debugging
});
