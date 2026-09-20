/*
 * Navbar resizing and the position indicator.
 */
import { activeSectionIndex } from './lib/geometry.js';

const SCROLLED_CLASS = 'is-scrolled';
const ACTIVE_CLASS = 'is-active';
const SHRINK_AFTER_PX = 40;
const PAGE_BOTTOM_TOLERANCE_PX = 2;

export function initNavbar() {
  const navbar = document.querySelector('[data-navbar]');
  const links = Array.from(document.querySelectorAll('[data-nav-link]'));
  const sections = links.map((link) => document.querySelector(link.getAttribute('href')));
  if (!navbar || links.length === 0 || sections.includes(null)) {
    return;
  }

  let activeIndex = -1;
  let frameRequested = false;

  const setActive = (index) => {
    if (index === activeIndex) {
      return;
    }
    links.forEach((link, linkIndex) => {
      const isActive = linkIndex === index;
      link.classList.toggle(ACTIVE_CLASS, isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    activeIndex = index;
  };

  const update = () => {
    frameRequested = false;
    navbar.classList.toggle(SCROLLED_CLASS, window.scrollY > SHRINK_AFTER_PX);

    // Measure the navbar as it is right now: it may be mid-resize.
    const navBottom = navbar.getBoundingClientRect().bottom;
    const rects = sections.map((section) => section.getBoundingClientRect());
    const pageBottom = document.documentElement.scrollHeight - PAGE_BOTTOM_TOLERANCE_PX;
    const atBottom = window.scrollY + window.innerHeight >= pageBottom;
    setActive(activeSectionIndex(rects, navBottom, atBottom));
  };

  // Scroll and resize fire far more often than the screen repaints, so all of
  // them collapse into one measurement per animation frame.
  const requestUpdate = () => {
    if (!frameRequested) {
      frameRequested = true;
      window.requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  // The navbar's bottom edge keeps moving after the last scroll event while
  // its height transition finishes; measure once more when it settles.
  navbar.addEventListener('transitionend', (event) => {
    if (event.target === navbar && event.propertyName === 'height') {
      requestUpdate();
    }
  });

  update();
}
