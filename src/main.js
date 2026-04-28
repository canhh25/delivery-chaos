import { Game } from './Game.js';
import './style.css'; // Remove this if style.css is already in index.html, but keep to ensure vite bundles it properly. Wait, index.html links to ./style.css outside src, so it's fine.

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game; // for debugging
});
