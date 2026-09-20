/*
 * Project carousel: side arrows, wrap-around, and a slide indicator.
 *
 * The track is moved by CSS alone. This module only records the current slide
 * in a data attribute, and _carousel.scss maps each index to a transform, so
 * no inline styles are ever written.
 */
import { wrapIndex } from './lib/geometry.js';

// Longer than the CSS transition; releases the lock if transitionend is
// never delivered (for example when the tab is hidden mid-slide).
const UNLOCK_FALLBACK_MS = 700;

function initCarousel(root) {
  const track = root.querySelector('[data-carousel-track]');
  const slides = Array.from(root.querySelectorAll('[data-carousel-slide]'));
  const previous = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const status = root.querySelector('[data-carousel-status]');
  if (!track || slides.length === 0 || !previous || !next) {
    return;
  }

  let current = 0;
  let locked = false;
  let fallbackTimer = 0;

  const unlock = () => {
    locked = false;
    window.clearTimeout(fallbackTimer);
  };

  const render = () => {
    track.dataset.index = String(current);
    slides.forEach((slide, index) => {
      // Off-screen slides leave the tab order and the accessibility tree.
      slide.inert = index !== current;
    });
    if (status) {
      status.textContent = `Slide ${current + 1} of ${slides.length}`;
    }
  };

  const go = (step) => {
    // Clicks that arrive mid-transition are ignored rather than queued.
    if (locked) {
      return;
    }
    const target = wrapIndex(current + step, slides.length);
    if (target === current) {
      return;
    }
    locked = true;
    fallbackTimer = window.setTimeout(unlock, UNLOCK_FALLBACK_MS);
    current = target;
    render();
  };

  track.addEventListener('transitionend', (event) => {
    if (event.target === track && event.propertyName === 'transform') {
      unlock();
    }
  });
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  render();
}

export function initCarousels() {
  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
}
