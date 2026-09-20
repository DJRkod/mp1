/*
 * Pure layout math shared by the behavior modules. Nothing here touches the
 * DOM, so it is unit tested directly in tests/geometry.test.mjs.
 */

const EDGE_TOLERANCE = 1;
const MIN_SCROLL_MS = 400;
const MAX_SCROLL_MS = 900;
const MS_PER_PIXEL = 0.25;

/**
 * Index of the section lying directly under the navbar's bottom edge.
 *
 * @param {{top: number}[]} rects section tops in viewport coordinates, in page order
 * @param {number} navBottom the navbar's bottom edge in viewport coordinates
 * @param {boolean} atBottom whether the page is scrolled to its end
 * @returns {number} the active index, or -1 when there are no sections
 */
export function activeSectionIndex(rects, navBottom, atBottom) {
  if (rects.length === 0) {
    return -1;
  }
  // A short last section can never reach the navbar, so the end of the page
  // always belongs to it.
  if (atBottom) {
    return rects.length - 1;
  }
  // The last section whose top has reached the edge wins. Searching from the
  // end matters at a boundary: the previous section's bottom and the next
  // section's top are both within tolerance there, and the next one is current.
  const edge = navBottom + EDGE_TOLERANCE;
  for (let index = rects.length - 1; index > 0; index -= 1) {
    if (rects[index].top <= edge) {
      return index;
    }
  }
  return 0;
}

/**
 * Scroll position that lands a section's top flush under the small navbar.
 */
export function scrollTargetY(sectionTop, smallNavHeight, maxScroll) {
  return Math.min(Math.max(sectionTop - smallNavHeight, 0), maxScroll);
}

/**
 * Animation length for a scroll of the given distance: longer trips take
 * longer, within fixed bounds so no trip feels instant or sluggish.
 */
export function scrollDuration(distance) {
  const scaled = Math.abs(distance) * MS_PER_PIXEL;
  return Math.min(Math.max(scaled, MIN_SCROLL_MS), MAX_SCROLL_MS);
}

/**
 * Cubic ease-in-out over progress 0..1; out-of-range progress is clamped.
 */
export function easeInOutCubic(progress) {
  const t = Math.min(Math.max(progress, 0), 1);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}
