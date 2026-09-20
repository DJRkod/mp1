#!/usr/bin/env python3
"""Render the placeholder demo reel for the portfolio page.

The clip is synthesized frame by frame with OpenCV so the repo carries no
third-party footage. Replace src/assets/reel.mp4 with a real reel when one
exists; nothing else needs to change.

Usage:
    python scripts/make_placeholder_reel.py
"""
import math
import sys
from pathlib import Path

import cv2
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "src" / "assets"
WIDTH, HEIGHT, FPS, SECONDS = 1280, 720, 24, 9
# Frames are drawn at 1280x720 and written at this size to keep the file small.
OUTPUT_SIZE = (960, 540)

# Colors are BGR. They mirror the design tokens in src/css/_tokens.scss.
BG = (18, 13, 10)
GRID = (73, 45, 29)
BLUE = (75, 41, 19)
ORANGE = (5, 95, 255)
TEXT = (239, 233, 230)
MUTED = (184, 166, 154)

SCENES = [
    ("illini course planner", "drag courses, watch the credit load update"),
    ("prairie roasters", "a fast single-page site for a local roaster"),
    ("jukeplox", "a self-hosted party jukebox for plex"),
]
# Browsers play H.264 in .mp4 everywhere; VP9 in .webm is the fallback.
CODECS = [("avc1", "reel.mp4"), ("VP90", "reel.webm")]


def background():
    frame = np.full((HEIGHT, WIDTH, 3), BG, dtype=np.uint8)
    cv2.circle(frame, (WIDTH // 2, HEIGHT // 2), 520, BLUE, -1)
    frame = cv2.GaussianBlur(frame, (0, 0), 120)
    for x in range(0, WIDTH, 40):
        cv2.line(frame, (x, 0), (x, HEIGHT), GRID, 1)
    for y in range(0, HEIGHT, 40):
        cv2.line(frame, (0, y), (WIDTH, y), GRID, 1)
    return frame


def centered(frame, text, y, scale, color, thickness):
    font = cv2.FONT_HERSHEY_DUPLEX
    (width, _), _ = cv2.getTextSize(text, font, scale, thickness)
    cv2.putText(frame, text, ((WIDTH - width) // 2, y), font, scale, color, thickness, cv2.LINE_AA)


def render(base, index):
    t = index / FPS
    frame = base.copy()
    scene_length = SECONDS / len(SCENES)
    scene = min(int(t // scene_length), len(SCENES) - 1)
    local = (t - scene * scene_length) / scene_length  # 0..1 within the scene
    title, subtitle = SCENES[scene]

    # Scan line sweeping down the frame.
    scan_y = int((t / SECONDS) * HEIGHT * 2) % HEIGHT
    cv2.line(frame, (0, scan_y), (WIDTH, scan_y), ORANGE, 2)

    # Title types itself in, with a blinking cursor.
    shown = title[: max(1, int(len(title) * min(local * 3, 1)))]
    cursor = "_" if int(t * 3) % 2 == 0 else " "
    centered(frame, f"> {shown}{cursor}", 300, 1.7, TEXT, 2)
    if local > 0.35:
        centered(frame, subtitle, 360, 0.85, MUTED, 1)

    # Equalizer-style bars, animated with offset sine waves.
    bars, bar_width, gap = 24, 22, 12
    left = (WIDTH - (bars * bar_width + (bars - 1) * gap)) // 2
    for bar in range(bars):
        level = 0.5 + 0.5 * math.sin(t * 4 + bar * 0.55 + scene)
        height = int(30 + 130 * level)
        x = left + bar * (bar_width + gap)
        cv2.rectangle(frame, (x, 600 - height), (x + bar_width, 600), ORANGE, -1)

    centered(frame, "raymond burt / demo reel", 670, 0.7, MUTED, 1)
    cv2.putText(frame, f"0{scene + 1} / 0{len(SCENES)}", (48, 64),
                cv2.FONT_HERSHEY_DUPLEX, 0.8, ORANGE, 1, cv2.LINE_AA)

    # Fade in from and out to the background color.
    fade = min(t / 0.6, (SECONDS - t) / 0.6, 1)
    if fade < 1:
        frame = cv2.addWeighted(frame, max(fade, 0), np.full_like(frame, BG), 1 - max(fade, 0), 0)
    return frame


def write(codec, name):
    path = ASSETS / name
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*codec), FPS, OUTPUT_SIZE)
    if not writer.isOpened():
        return None
    base = background()
    for index in range(FPS * SECONDS):
        writer.write(cv2.resize(render(base, index), OUTPUT_SIZE, interpolation=cv2.INTER_AREA))
    writer.release()
    if not path.exists() or path.stat().st_size < 10_000:
        path.unlink(missing_ok=True)
        return None
    return path


def main():
    for codec, name in CODECS:
        path = write(codec, name)
        if path:
            print(f"wrote {path.relative_to(REPO_ROOT)} ({path.stat().st_size / 1e6:.2f} MB, {codec})")
            return 0
        print(f"codec {codec} unavailable, trying the next one", file=sys.stderr)
    print("no browser-playable codec could be written", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
