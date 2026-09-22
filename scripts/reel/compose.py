#!/usr/bin/env python3
"""Edit the footage recorded by scripts/reel/capture.mjs into src/assets/reel.mp4.

Each project plays in a window over the site's background, next to a caption.
The recordings are screenshots with timestamps, so they are resampled onto a
steady frame rate here. OpenCV writes the H.264 file; there is no ffmpeg step.

Usage:
    node scripts/reel/capture.mjs
    python scripts/reel/compose.py
"""
import bisect
import json
import os
import sys
import tempfile
import textwrap
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS = REPO_ROOT / "src" / "assets"
FRAMES_DIR = Path(os.environ.get("REEL_FRAMES") or Path(tempfile.gettempdir()) / "mp1-reel-frames")
# The recordings hold 7 to 13 screenshots a second, so a higher frame rate would
# only repeat frames, and the Windows encoder spends bits in proportion to it.
WIDTH, HEIGHT, FPS = 960, 540, 12
# H.264 in .mp4 plays in every browser, and src/index.html references exactly
# this file, so there is no fallback format: a different name would go unused.
CODEC, OUTPUT_NAME = "avc1", "reel.mp4"
CARD_SECONDS, FADE_SECONDS = 1.8, 0.35

# Colors are RGB. They mirror the design tokens in src/css/_tokens.scss.
BG = (10, 13, 18)
GRID = (29, 45, 73)
BLUE = (19, 41, 75)
ORANGE = (255, 95, 5)
TEXT = (230, 233, 239)
MUTED = (154, 166, 184)

# crop is (left, top, width, height) in the recording; speed > 1 plays it faster.
SEGMENTS = [
    {
        "folder": "rockpapercheater",
        "title": "rock, paper, cheater",
        "caption": "Rock-paper-scissors against a computer that cheats at the rate you choose.",
        "link": "rockpapercheater.com",
        "crop": (470, 12, 660, 876),
        "speed": 1.5,
    },
    {
        "folder": "mowkoban",
        "title": "mowkoban",
        "caption": "A daily lawn-mowing puzzle. This is the tutorial board, solved in the optimal nine moves.",
        "link": "mowkoban.com",
        "crop": (470, 56, 660, 800),
        "speed": 1.1,
    },
    {
        "folder": "jukeplox",
        "title": "jukeplox",
        "caption": "A self-hosted party jukebox for Plex. Browse by artist or album, in the color scheme you like.",
        "link": "github.com/DJRkod/jukeplox",
        "crop": None,
        "speed": 1.25,
    },
]


def font(name, size):
    """Windows system fonts stand in for the site's webfonts, which are not installed."""
    try:
        return ImageFont.truetype(name, size)
    except OSError:
        return ImageFont.load_default()


def MONO_BOLD(size):
    return font("consolab.ttf", size)


def MONO(size):
    return font("consola.ttf", size)


def SANS(size):
    return font("segoeui.ttf", size)


def background():
    frame = np.full((HEIGHT, WIDTH, 3), BG, dtype=np.uint8)
    cv2.circle(frame, (WIDTH // 2, HEIGHT // 2), 390, BLUE, -1)
    frame = cv2.GaussianBlur(frame, (0, 0), 90)
    for x in range(0, WIDTH, 30):
        cv2.line(frame, (x, 0), (x, HEIGHT), GRID, 1)
    for y in range(0, HEIGHT, 30):
        cv2.line(frame, (0, y), (WIDTH, y), GRID, 1)
    return frame


def card(base, lines):
    """A title card: (text, font, color) lines centered on the background."""
    image = Image.fromarray(base)
    draw = ImageDraw.Draw(image)
    heights = [draw.textbbox((0, 0), text, font=face)[3] + 14 for text, face, _ in lines]
    y = (HEIGHT - sum(heights)) // 2
    for (text, face, color), height in zip(lines, heights):
        width = draw.textlength(text, font=face)
        draw.text(((WIDTH - width) // 2, y), text, font=face, fill=color)
        y += height
    return np.array(image)


def window_box(segment, source_size):
    """Where the footage sits: tall crops on the right, wide footage on top."""
    crop = segment["crop"] or (0, 0) + source_size
    if crop[3] > crop[2]:
        height = HEIGHT - 48
        width = round(height * crop[2] / crop[3])
        return crop, (WIDTH - 56 - width, 24, width, height)
    width = 800
    height = round(width * crop[3] / crop[2])
    return crop, ((WIDTH - width) // 2, 18, width, height)


def captioned(base, segment, index, box):
    """The background with this project's caption drawn beside or below the window."""
    image = Image.fromarray(base)
    draw = ImageDraw.Draw(image)
    left, top, width, height = box
    draw.rectangle((left - 2, top - 2, left + width + 1, top + height + 1), outline=GRID, width=2)
    counter = "0%d / 0%d" % (index + 1, len(SEGMENTS))
    if height > width:
        x, y = 56, 150
        draw.text((x, y), counter, font=MONO(18), fill=ORANGE)
        draw.text((x, y + 34), segment["title"], font=MONO_BOLD(32), fill=TEXT)
        y += 92
        for line in textwrap.wrap(segment["caption"], 38):
            draw.text((x, y), line, font=SANS(19), fill=MUTED)
            y += 28
        draw.text((x, y + 16), segment["link"], font=MONO(17), fill=ORANGE)
    else:
        y = top + height + 12
        draw.text((left, y), counter, font=MONO(16), fill=ORANGE)
        draw.text((left + 86, y - 4), segment["title"], font=MONO_BOLD(22), fill=TEXT)
        link_width = draw.textlength(segment["link"], font=MONO(16))
        draw.text((left + width - link_width, y), segment["link"], font=MONO(16), fill=ORANGE)
        draw.text((left, y + 26), segment["caption"], font=SANS(16), fill=MUTED)
    return np.array(image)


def faded(frame, base, seconds_in, seconds_left):
    """Every scene fades in from, and out to, the bare background."""
    alpha = min(seconds_in / FADE_SECONDS, seconds_left / FADE_SECONDS, 1)
    if alpha >= 1:
        return frame
    return cv2.addWeighted(frame, max(alpha, 0), base, 1 - max(alpha, 0), 0)


def scenes(base):
    """Yields (seconds, render) pairs; render(t) returns the RGB frame at t seconds."""
    intro = card(base, [
        ("raymond burt", MONO_BOLD(44), TEXT),
        ("demo reel", MONO(26), ORANGE),
        ("three projects, recorded live in the browser", SANS(19), MUTED),
    ])
    yield CARD_SECONDS, lambda t: intro

    for index, segment in enumerate(SEGMENTS):
        folder = FRAMES_DIR / segment["folder"]
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        stamps = [entry["ms"] for entry in manifest]
        first = cv2.imread(str(folder / manifest[0]["file"]))
        crop, box = window_box(segment, (first.shape[1], first.shape[0]))
        plate = captioned(base, segment, index, box)
        loaded = {}

        def render(t, folder=folder, manifest=manifest, stamps=stamps, crop=crop, box=box,
                   plate=plate, speed=segment["speed"], loaded=loaded):
            # The latest screenshot taken at or before this moment of the recording.
            entry = manifest[max(bisect.bisect_right(stamps, t * speed * 1000) - 1, 0)]
            if loaded.get("file") != entry["file"]:
                shot = cv2.cvtColor(cv2.imread(str(folder / entry["file"])), cv2.COLOR_BGR2RGB)
                shot = shot[crop[1]:crop[1] + crop[3], crop[0]:crop[0] + crop[2]]
                loaded["file"] = entry["file"]
                loaded["pixels"] = cv2.resize(shot, (box[2], box[3]), interpolation=cv2.INTER_AREA)
            frame = plate.copy()
            frame[box[1]:box[1] + box[3], box[0]:box[0] + box[2]] = loaded["pixels"]
            return frame

        yield stamps[-1] / 1000 / segment["speed"], render

    outro = card(base, [
        ("raymond burt", MONO_BOLD(40), TEXT),
        ("github.com/DJRkod", MONO(24), ORANGE),
    ])
    yield CARD_SECONDS, lambda t: outro


def write():
    """Render to a scratch file and only then replace the real clip, so a failed
    encode never destroys a reel that was already there."""
    path = ASSETS / OUTPUT_NAME
    scratch = ASSETS / ("rendering-" + OUTPUT_NAME)
    # On Windows, ask for Media Foundation directly: OpenCV's bundled FFmpeg has no
    # H.264 encoder there and only prints errors before falling back to it.
    backend = cv2.CAP_MSMF if sys.platform == "win32" else cv2.CAP_ANY
    writer = cv2.VideoWriter(str(scratch), backend, cv2.VideoWriter_fourcc(*CODEC), FPS, (WIDTH, HEIGHT))
    try:
        if not writer.isOpened():
            return None
        base = background()
        timeline = list(scenes(base))
        total = sum(round(seconds * FPS) for seconds, _ in timeline)
        written = 0
        for seconds, render in timeline:
            count = round(seconds * FPS)
            for index in range(count):
                t = index / FPS
                frame = faded(render(t), base, t, (count - 1 - index) / FPS)
                # A thin bar along the bottom edge shows progress through the reel.
                frame[HEIGHT - 3:, :round(WIDTH * (written + 1) / total)] = ORANGE
                writer.write(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
                written += 1
        writer.release()
        if not scratch.exists() or scratch.stat().st_size < 10_000:
            return None
        os.replace(scratch, path)
        return path, written / FPS
    finally:
        writer.release()
        scratch.unlink(missing_ok=True)


def main():
    missing = [s["folder"] for s in SEGMENTS if not (FRAMES_DIR / s["folder"] / "manifest.json").exists()]
    if missing:
        print("no recording for: %s (run node scripts/reel/capture.mjs first)" % ", ".join(missing), file=sys.stderr)
        return 1
    result = write()
    if not result:
        print(f"could not encode {CODEC}; {OUTPUT_NAME} was left untouched", file=sys.stderr)
        return 1
    path, seconds = result
    print(f"wrote {path.relative_to(REPO_ROOT)} ({seconds:.1f}s, {path.stat().st_size / 1e6:.2f} MB, {CODEC})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
