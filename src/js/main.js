/*
 * Entry point: wires each behavior module to the page once the DOM is ready.
 */
import { initNavbar } from './navbar.js';
import { initSmoothScroll } from './scroll.js';

const init = () => {
  initNavbar();
  initSmoothScroll();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
