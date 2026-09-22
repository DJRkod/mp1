# MP1 Submission Checklist

Due **Tuesday, Sep 22, 2026, 11:59 PM CT**. An undeployed site is capped at 80%, and the first deploy can take 10 to 30 minutes to go live, so do step 2 with time to spare.

## 1. Swap in your real content

Unchecked items below are still placeholder. The page is built to be submitted as-is if you run out of time, but these are the things a grader would notice. All edits are in `src/index.html` unless noted; no SCSS or JavaScript changes are needed.

- [x] **Photo.** Done: `src/assets/profile.jpg`, copied from MP0. It is 300px square, so the About column is capped at 300px to keep it sharp. A larger original would look better on high-density screens.
- [x] **Bio.** Done: your own paragraph, plus the "Specializing in Intelligence and Big Data" fact line. The other two fact lines (the university and Jukeplox) are still mine: check them.
- [x] **Hero tagline.** Done: "Computer science student at UIUC."
- [ ] **Skills.** Three cards in the Skills section: adjust the blurbs and tags to what you actually use.
- [x] **Projects 1 and 2.** Done: Rock, Paper, Cheater (`https://rockpapercheater.com`) and Mowkoban (`https://mowkoban.com`), with screenshots of the live sites. The descriptions were written from what the sites show publicly: check them, especially the tags, since I could not see how either site is built. Mowkoban's modal credits Roger Burt alongside you and mentions The Pudding, as the site's own About page does.
- [ ] **Project 3, Jukeplox.** The image is now a real screenshot of a running deployment (Artists, tiles view, Bloody Pink scheme). The link points at `https://github.com/DJRkod/jukeplox`. The description and bullets are still my wording from the repo's one-line summary: check them against the real project.
- [x] **Reel.** `src/assets/reel.mp4` is real footage of the three projects (30 s, 960x540, H.264, no audio, 9.9 MB). `node scripts/reel/capture.mjs` records them in headless Chrome: three rounds of Rock, Paper, Cheater with no score submitted, the unscored Mowkoban tutorial, and Jukeplox browsed without queueing or playing anything. `python scripts/reel/compose.py` then edits the frames into the clip with OpenCV, since there is no ffmpeg on this machine. Watch it once and check the captions. If you swap in your own clip, keep the file name and keep it small (GitHub rejects files over 100 MB).
- [ ] After any change: `npm run build` must succeed, and `npm start` should look right at 1920x1080, 1366x768, 1280x720, 1024x768, and 768x1024.

## 2. Deploy

- [ ] Commit and push to `main`.
- [ ] On GitHub: **Settings > Pages > Build and deployment > Source > GitHub Actions**. Until this is set, the workflow's build job passes and its deploy job fails with a 404. That is expected.
- [ ] Re-run the failed workflow (Actions tab) or push again, then open `https://djrkod.github.io/mp1` and check that the hero background, icons, fonts, project images, and the video all load.
- [x] **Repo name.** Renamed from `cs409-mp1` to `mp1` on Sep 21, as the README asks, and the local remote now points at `https://github.com/DJRkod/mp1.git`. No code change was needed because every asset path is relative. The site will be at `https://djrkod.github.io/mp1`.

## 3. Demo video (3 minutes maximum)

- [ ] Start by showing the browser address bar so the deployed URL is visible.
- [ ] Show each graded feature, in roughly this order:
  1. Layout: scroll the whole page once, top to bottom, to show the header, the full-width stripes, and the footer (20%).
  2. Navbar resizing: at the top the bar is tall with large text; scroll a little and it shrinks, text included (5%). The bar stays pinned while you scroll (sticky, 1%).
  3. Position indicator: scroll slowly and watch the orange underline move from item to item; scroll to the very bottom to show **Contact** highlighted (5%).
  4. Smooth scrolling: click several nav items, including **Home** from the bottom (10%).
  5. Fixed background image: scroll the hero and point out that the grid stays put while the content moves over it (1%).
  6. Centering: the hero name stays vertically centered when you resize the window's height (2%).
  7. CSS3 animations: reload the page for the hero fade-up, point at the bouncing scroll cue, hover a skill card and a button (5%).
  8. Multi-column layout: the three Skills cards (5%), with their vector icons (1%, together with the social icons in the footer).
  9. Carousel: click the right arrow through all three slides and once more to wrap, then the left arrow (10%).
  10. Modal: open a project's **Details**, close it with the X, open again and press Escape, open again and click outside it (10%).
  11. Video: press play on the reel (2%).
  12. Responsiveness: resize the window, or use the device toolbar, through 1920x1080, 1366x768, 1280x720, 1024x768, and 768x1024 (10%).
- [ ] The Code (12%) and SCSS (1%) lines are graded from the source, not the video.
- [ ] **If the site could not be deployed:** demo locally with `npm start` instead, and run `git status` and `git log` on camera first so your last edits are visible. This path is capped at 80%.
- [ ] Upload the video to Google Drive and share it with `uiuc.web.programming@gmail.com`.

## 4. Final log commit

`llm_logs.csv` is rebuilt from the Claude Code session transcripts on every turn and on every commit, but a commit made from inside a session can never contain the turns that come after it. So, as the very last thing:

- [ ] Close every Claude Code session for this repo.
- [ ] In a plain terminal: `python scripts/export_llm_logs.py`, then `git add llm_logs.csv`, `git commit -m "docs: final LLM chat log"`, and `git push`.
- [ ] If you cloned the repo fresh on another machine, do two things first. Re-enable the commit hook with `git config core.hooksPath .githooks`. Then recreate `.llm_log_redact.txt` in the repo root, because it is gitignored: one term per line for anything that must never appear in the public log, such as the part of your email address before the `@`. It may be empty, but the exporter refuses to run without it.
- [ ] If you used any other LLM tool for this MP (ChatGPT, Copilot chat, and so on), add a row per chat to `llm_logs.csv` by hand. The exporter only sees Claude Code. Leave the header row alone, leave `entry_id` empty, and put the share link or transcript in `content`; the exporter gives the row an id and keeps it on every later run.

## 5. Submission form

- [ ] Fill in the form at `https://forms.gle/jfgQnaTSVmhrt2DH8` with the deployed URL and the Drive share link.
- [ ] Answer the survey questions about your experience using LLMs. This and the chat log are both required by the course's LLM policy.
- [ ] Declare your sources (rule 2). The list below is complete as of the build; add anything you consult afterwards.

## Sources to declare

Code and reading material:

- The assignment `README.md` and the course's example images linked from it.
- Claude Code (Anthropic) generated the code in this repo under your direction. The full conversation is in `llm_logs.csv`.
- No tutorials, Stack Overflow answers, or other outside code were consulted or copied during the build.

Third-party resources loaded by the page:

- **Font Awesome Free 6.5.1**, loaded as a stylesheet from cdnjs (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css`). Icons: CC BY 4.0. Fonts: SIL OFL 1.1. Code: MIT. The assignment names FontAwesome in requirement 15.
- **Inter** and **JetBrains Mono**, loaded from Google Fonts. Both are SIL Open Font License 1.1.

The Jukeplox screenshot shows artist photos and a few album covers from the music library it was browsing. Those images belong to their respective artists and labels and appear only incidentally, as part of a screenshot of your own app; mention that if the form asks about third-party images.

Everything else is yours or original to this repo: your portrait, screenshots of your own two game sites, the SVG artwork in `src/assets/`, and the reel, which `scripts/reel/` records from your own three projects and edits with OpenCV. Like the Jukeplox screenshot, the Jukeplox part of the reel shows artist photos and album covers from the music library incidentally. Build tooling (webpack, Babel, Sass, and the rest of `package.json`) came with the course template.

## Worth asking on Piazza (rule 7)

These are judgment calls the build made. None is likely to be a problem, but rule 7 says to ask when unsure.

1. Are the FontAwesome and Google Fonts stylesheet links acceptable under rule 3 (no libraries)? The requirements name FontAwesome and webfonts, and no JavaScript library is loaded.
2. Does the submission form, or the graders' tooling, expect the deployed URL to end in `/mp1`? See the repo-name item above.
3. Are chat logs submitted as the `llm_logs.csv` committed in the repo, or as a separate upload?

## How the build was verified

- `npm run build` succeeds, and `npm test` passes (13 tests of the scroll, position-indicator, and carousel math).
- `python -m unittest discover -s scripts -p "test_*.py"` passes (25 tests of the log exporter).
- The page was driven in headless Chrome at the graded sizes: no horizontal scrollbar, navbar on one line, three Skills columns, About side-by-side at 1024 and up and stacked at 768, every nav item lands flush under the navbar and ends highlighted, Contact highlights at the page bottom, the carousel wraps and ignores mid-transition clicks, and the modal traps focus, returns it, locks scroll without shifting the page, and closes by X, Escape, and outside click.
- The built site was served from a `/cs409-mp1/` subdirectory with no failed or out-of-path requests, and the reel played.
- `src/index.html` contains no `style` attribute, no inline script, and no `table`; the running page has no element with a `style` attribute either.
