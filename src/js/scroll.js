/*
 * Smooth scrolling for in-page links, animated by hand with
 * requestAnimationFrame. CSS scroll-behavior is deliberately left unset so the
 * two never compound.
 */
import { scrollTargetY, scrollDuration, easeInOutCubic } from './lib/geometry.js';

const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'keydown'];
const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
// With reduced motion requested, the trip is still animated, but kept brief.
const REDUCED_MOTION_MS = 150;

export function initSmoothScroll() {
  const links = Array.from(document.querySelectorAll('[data-scroll]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frameId = 0;

  // The navbar is in its small state everywhere except the very top, so the
  // small height is the offset every landing needs. It is defined once, in
  // the SCSS tokens, and read back here.
  const smallNavHeight = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--nav-h-small');
    return parseFloat(value) || 0;
  };

  const stop = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    INTERRUPT_EVENTS.forEach((name) => window.removeEventListener(name, interrupt));
  };

  // The visitor always wins: scroll input of their own ends the animation.
  // Keys that do not scroll, such as Tab, leave it running.
  function interrupt(event) {
    if (event.type !== 'keydown' || SCROLL_KEYS.includes(event.key)) {
      stop();
    }
  }

  const scrollToSection = (section) => {
    stop();

    const startY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const sectionTop = section.getBoundingClientRect().top + startY;
    const endY = scrollTargetY(sectionTop, smallNavHeight(), maxScroll);
    const distance = endY - startY;

    if (distance === 0) {
      return;
    }

    const duration = reducedMotion.matches ? REDUCED_MOTION_MS : scrollDuration(distance);
    const startTime = performance.now();

    const step = (now) => {
      const progress = (now - startTime) / duration;
      window.scrollTo(0, startY + distance * easeInOutCubic(progress));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        stop();
      }
    };

    INTERRUPT_EVENTS.forEach((name) => {
      window.addEventListener(name, interrupt, { passive: true });
    });
    frameId = window.requestAnimationFrame(step);
  };

  links.forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (!section) {
      return;
    }
    link.addEventListener('click', (event) => {
      event.preventDefault();
      scrollToSection(section);
      window.history.replaceState(null, '', link.getAttribute('href'));
    });
  });
}
