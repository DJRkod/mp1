/*
 * Project carousel: side arrows, seamless wrap-around, and a slide indicator.
 *
 * The track is moved by CSS alone. This module only records state in data
 * attributes, and _carousel.scss maps them to transforms and flex order, so no
 * inline styles are ever written.
 *
 * At rest the current slide sits in the middle position of the track, with the
 * previous slide on its left and the next on its right, whatever their order in
 * the document. Each click therefore animates exactly one slide in the clicked
 * direction, even across the ends of the list; once the transition ends the
 * slides are re-ordered around the new current slide and the track snaps back
 * to the middle with the transition switched off, which the eye cannot see.
 */
import { slideOrder, wrapIndex } from './lib/geometry.js';

// Track positions: the previous slide, the current slide, the next slide.
const REST_POSITION = 1;
// Longer than the CSS transition; settles the slide if transitionend is never
// delivered (for example when the tab is hidden mid-slide).
const SETTLE_FALLBACK_MS = 700;

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
  let pending = 0; // the step in flight: -1, 1, or 0 when at rest
  let fallbackTimer = 0;

  const render = () => {
    slides.forEach((slide, index) => {
      slide.dataset.order = String(slideOrder(index, current, slides.length));
      // Off-screen slides leave the tab order and the accessibility tree.
      slide.inert = index !== current;
    });
    if (status) {
      status.textContent = `Slide ${current + 1} of ${slides.length}`;
    }
  };

  // Makes the slide that just scrolled into view the current one, and
  // re-centres the track around it without animating.
  const settle = () => {
    window.clearTimeout(fallbackTimer);
    if (!pending) {
      return;
    }
    current = wrapIndex(current + pending, slides.length);
    pending = 0;
    track.classList.add('is-snapping');
    render();
    track.dataset.index = String(REST_POSITION);
    // Flush the un-animated move before transitions come back on.
    void track.offsetWidth;
    track.classList.remove('is-snapping');
  };

  const go = (step) => {
    // Clicks that arrive mid-transition are ignored rather than queued.
    if (pending || slides.length < 2) {
      return;
    }
    // With two slides the only other slide waits on the right, so both arrows
    // bring it in from there.
    pending = slides.length === 2 ? 1 : step;
    fallbackTimer = window.setTimeout(settle, SETTLE_FALLBACK_MS);
    track.dataset.index = String(REST_POSITION + pending);
  };

  track.addEventListener('transitionend', (event) => {
    if (event.target === track && event.propertyName === 'transform') {
      settle();
    }
  });
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  render();
  track.dataset.index = String(REST_POSITION);
}

export function initCarousels() {
  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
}
