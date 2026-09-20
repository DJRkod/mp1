# MP1 Submission Checklist

Due **Tuesday, Sep 22, 2026, 11:59 PM CT**. An undeployed site is capped at 80%, and the first deploy can take 10 to 30 minutes to go live, so do step 2 with time to spare.

## 1. Swap in your real content

Everything below is placeholder. The page is built to be submitted as-is if you run out of time, but these are the things a grader would notice. All edits are in `src/index.html` unless noted; no SCSS or JavaScript changes are needed.

- [ ] **Photo.** Put your photo at `src/assets/avatar.jpg` (square, about 800x800) and change the `src` of the `about__photo` image from `assets/avatar.svg` to `assets/avatar.jpg`.
- [ ] **Bio.** Rewrite the three paragraphs in the About section. The current copy was inferred from your GitHub profile: check the claim that your CS 410 group fine-tuned BERT models, and the three fact lines under the bio.
- [ ] **Hero tagline.** One sentence under your name.
- [ ] **Skills.** Three cards in the Skills section: adjust the blurbs and tags to what you actually use.
- [ ] **Project 1, "Illini Course Planner", and project 2, "Prairie Roasters".** Both are invented stand-ins for your two website projects. For each one, update the carousel slide (title, kind, summary, tags, image `alt`), the matching `dialog` near the bottom of the file (description, bullet points, link `href`), and replace `src/assets/project-site-1.svg` / `project-site-2.svg` with a screenshot. If you use a `.png` or `.jpg` screenshot, change the `src` in the slide to match.
- [ ] **Project 3, Jukeplox.** The link already points at `https://github.com/DJRkod/jukeplox`. Check the description and bullets against the real project.
- [ ] **Reel.** Replace `src/assets/reel.mp4` with your own clip, keeping the file name. There is no ffmpeg on this machine, so the clip must already be H.264/AAC `.mp4`, short, and small: aim for under 10 MB (GitHub rejects files over 100 MB). To regenerate the placeholder instead, run `python scripts/make_placeholder_reel.py`.
- [ ] After any change: `npm run build` must succeed, and `npm start` should look right at 1920x1080, 1366x768, 1280x720, 1024x768, and 768x1024.

## 2. Deploy

- [ ] Commit and push to `main`.
- [ ] On GitHub: **Settings > Pages > Build and deployment > Source > GitHub Actions**. Until this is set, the workflow's build job passes and its deploy job fails with a 404. That is expected.
- [ ] Re-run the failed workflow (Actions tab) or push again, then open `https://djrkod.github.io/cs409-mp1` and check that the hero background, icons, fonts, project images, and the video all load.
- [ ] **Decide about the repo name.** The README says to name the repo `mp1`, which would make the URL `https://djrkod.github.io/mp1`. Yours is `cs409-mp1`. Renaming it (Settings > General) needs no code change because every asset path is relative. If you rename, update your local remote with `git remote set-url origin https://github.com/DJRkod/mp1.git`.

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

Everything else is original to this repo: the SVG artwork in `src/assets/`, and the reel, which `scripts/make_placeholder_reel.py` renders with OpenCV. Build tooling (webpack, Babel, Sass, and the rest of `package.json`) came with the course template.

## Worth asking on Piazza (rule 7)

These are judgment calls the build made. None is likely to be a problem, but rule 7 says to ask when unsure.

1. Are the FontAwesome and Google Fonts stylesheet links acceptable under rule 3 (no libraries)? The requirements name FontAwesome and webfonts, and no JavaScript library is loaded.
2. Does the submission form, or the graders' tooling, expect the deployed URL to end in `/mp1`? See the repo-name item above.
3. Are chat logs submitted as the `llm_logs.csv` committed in the repo, or as a separate upload?

## How the build was verified

- `npm run build` succeeds, and `npm test` passes (11 tests of the scroll, position-indicator, and carousel math).
- `python -m unittest discover -s scripts -p "test_*.py"` passes (25 tests of the log exporter).
- The page was driven in headless Chrome at the graded sizes: no horizontal scrollbar, navbar on one line, three Skills columns, About side-by-side at 1024 and up and stacked at 768, every nav item lands flush under the navbar and ends highlighted, Contact highlights at the page bottom, the carousel wraps and ignores mid-transition clicks, and the modal traps focus, returns it, locks scroll without shifting the page, and closes by X, Escape, and outside click.
- The built site was served from a `/cs409-mp1/` subdirectory with no failed or out-of-path requests, and the reel played.
- `src/index.html` contains no `style` attribute, no inline script, and no `table`; the running page has no element with a `style` attribute either.
