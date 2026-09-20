/*
 * Entry point: wires each behavior module to the page once the DOM is ready.
 */
import { initNavbar } from './navbar.js';
import { initSmoothScroll } from './scroll.js';
import { initCarousels } from './carousel.js';
import { initModals } from './modal.js';

const init = () => {
  initNavbar();
  initSmoothScroll();
  initCarousels();
  initModals();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
