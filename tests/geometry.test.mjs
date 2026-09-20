import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeSectionIndex,
  scrollTargetY,
  scrollDuration,
  easeInOutCubic,
} from '../src/js/lib/geometry.js';

// Three sections, each 900px tall, measured in viewport coordinates.
const sections = (scrollY) => [0, 900, 1800].map((top) => ({
  top: top - scrollY,
  bottom: top + 900 - scrollY,
}));

test('activeSectionIndex picks the section under the navbar bottom edge', () => {
  // Page scrolled 936px with a 64px navbar: the edge sits 1000px down the page.
  assert.equal(activeSectionIndex(sections(936), 64, false), 1);
});

test('activeSectionIndex treats a top within 1px of the edge as current', () => {
  const almost = [{ top: -835.4, bottom: 64.6 }, { top: 64.6, bottom: 964.6 }];
  assert.equal(activeSectionIndex(almost, 64, false), 1);

  const notYet = [{ top: -834, bottom: 66 }, { top: 66, bottom: 966 }];
  assert.equal(activeSectionIndex(notYet, 64, false), 0);
});

test('activeSectionIndex returns the last section at the page bottom', () => {
  // The edge is still inside the second-to-last section, as in AE1.
  assert.equal(activeSectionIndex(sections(936), 64, true), 2);
});

test('activeSectionIndex falls back to the first section at the page top', () => {
  // Large navbar (96px) over the hero, nothing scrolled.
  assert.equal(activeSectionIndex(sections(0), 96, false), 0);
  // Edge above every section top still resolves to the first section.
  assert.equal(activeSectionIndex([{ top: 200, bottom: 1100 }], 96, false), 0);
});

test('activeSectionIndex returns -1 when there are no sections', () => {
  assert.equal(activeSectionIndex([], 64, false), -1);
  assert.equal(activeSectionIndex([], 64, true), -1);
});

test('scrollTargetY lands the section top flush under the small navbar', () => {
  assert.equal(scrollTargetY(1800, 64, 5000), 1736);
});

test('scrollTargetY clamps to the scrollable range', () => {
  assert.equal(scrollTargetY(0, 64, 5000), 0);
  assert.equal(scrollTargetY(4990, 64, 4200), 4200);
});

test('scrollDuration scales with distance between 400 and 900 ms', () => {
  assert.equal(scrollDuration(100), 400);
  assert.equal(scrollDuration(10000), 900);
  assert.equal(scrollDuration(-10000), 900);
  const mid = scrollDuration(2000);
  assert.ok(mid > 400 && mid < 900, `expected a mid-range duration, got ${mid}`);
});

test('easeInOutCubic is anchored, symmetric, monotonic, and clamped', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(-3), 0);
  assert.equal(easeInOutCubic(7), 1);

  let previous = 0;
  for (let step = 1; step <= 100; step += 1) {
    const value = easeInOutCubic(step / 100);
    assert.ok(value >= previous, `not monotonic at ${step / 100}`);
    previous = value;
  }
});
