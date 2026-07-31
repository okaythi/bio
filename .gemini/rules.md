# Bio Project Rules & Agent Instructions

Welcome to the `bio` project! As an AI agent working on this repository, you **MUST** read and understand these rules and architectural quirks before making modifications. This is a highly customized React SPA built with Vite, deployed to Cloudflare Pages, and heavily optimized for a premium, Netflix-like experience.

## General Guidelines
- **Zero comments allowed anywhere in the source code.** Do not leave comments explaining your logic in the JS/TS files.
- **Tab Title:** The `document.title` must always remain `> bio`. Never change this to the movie title.
- **Never Commit:** Do not commit `/movies`, `cdn.bio.sudothy.me/`, or `upload.js` to git.

## Infrastructure & Stack
- **Framework:** React + TypeScript + Vite.
- **Backend:** Cloudflare Pages Functions (`functions/api/*.ts`).
- **Storage:** Cloudflare R2 Bucket named `movies`.
- **R2 CDN Base URL:** `https://cdn.bio.sudothy.me` (This is the **ROOT** of the bucket. There is no `/movies/` prefix).

## R2 Bucket Naming & Folder Conventions
All media in the Cloudflare R2 `movies` bucket **MUST** follow this exact folder and filename structure:

### 1. Root Folder Pattern
`[Title] ([Year])`
* Example Movie: `Leviticus (2026)`
* Example TV Series: `Solo Leveling (2024)`

### 2. Movies File Pattern
* **Video:** `[Title] ([Quality] - [Audio]).mp4` *(e.g. `Leviticus (1080p - 5.1).mp4`)*
* **Subtitles:** `[Title] ([Quality] - [Audio]).[lang].srt` *(e.g. `Leviticus (1080p - 5.1).en.srt`)*

### 3. TV Series & Shows File Pattern
* **Video:** `S{Season:2}E{Episode:2}-{EpisodeTitle}.mp4` *(e.g. `S01E01-I'm Used to It.mp4`, `S01E02-If I Had One More Chance.mp4`)*
* **Subtitles:** `S{Season:2}E{Episode:2}-{EpisodeTitle}.[lang].srt` *(e.g. `S01E01-I'm Used to It.en.srt`)*

## How Code Expects & Handles Media Organization

1. **Backend Scanner (`functions/api/movies.ts`)**:
   - Groups R2 objects by root folder `Title (Year)`.
   - Tests file names against regex `/^S(\d{1,2})E(\d{1,2})(?:[-_\s](.*?))?\.(mp4|mkv|srt)$/i`.
   - When `S{Season}E{Episode}` files are detected:
     - Sets `type = 'tv'` for the title.
     - Parses `seasonNumber` and `episodeNumber`, creating sorted `seasons: [{ seasonNumber, episodes: [...] }]` structures.
     - Marks `isAvailable = true` for each episode file present in R2 and attaches its R2 `videoUrl` and per-episode `subtitles`.
   - When no `S{Season}E{Episode}` pattern is present, sets `type = 'movie'` and links `videoUrl` at top-level.

2. **Frontend Availability & Metadata Merging (`TrailerModal.tsx`)**:
   - Queries TMDB for full show details (`getTVDetails` & `getTVSeasonDetails`) to retrieve full episode listings, descriptions, and thumbnail images for all seasons.
   - Merges TMDB episode details with R2 bucket availability (`isAvailable` & `videoUrl`):
     - **Uploaded / Available Episodes:** Rendered at 100% opacity, clickable to launch `/watch/[id]?season=X&episode=Y`.
     - **Unreleased / Missing Episodes:** Rendered with full TMDB title/description/thumbnail, but styled with 55% opacity and a **"Coming Soon"** tag (clicks disabled, no alerts).

## Complex Client-Side Implementations
This project uses several clever client-side tricks to achieve a premium experience without needing an expensive backend encoding server. Do **NOT** break these:

1. **Dynamic Scrubbing Thumbnails (VideoPlayer.tsx)**
   - Because we do not have backend-generated WebVTT spritesheets for thumbnails, `VideoPlayer.tsx` implements a dual-video hack. 
   - A secondary, hidden `<video>` element buffers the MP4. When the user hovers over the progress bar, we seek the hidden video and use `ctx.drawImage()` to instantly paint the exact frame onto a floating `<canvas>`.
   - **Requirement:** The R2 bucket **must** have CORS enabled (`Access-Control-Allow-Origin: *`) and the `<video>` elements must have `crossOrigin="anonymous"`, otherwise the `<canvas>` becomes tainted and throws security errors.

2. **On-the-fly Subtitle Conversion (VideoPlayer.tsx)**
   - The R2 bucket stores subtitles in standard `.srt` format. However, HTML5 `<track>` elements strictly require WebVTT (`.vtt`) format.
   - We fix this via a `useEffect` that fetches the `.srt` text, uses regex to replace the comma timestamps (`00:00:01,000` -> `00:00:01.000`) and injects Netflix-style positioning (`line:85%`), then generates a `blob:` URL for the `<track>` element.
   - **Netflix Styling:** The subtitles are styled globally in `index.css` using the `::cue` pseudo-element (white text, transparent background, heavy multi-layered black `text-shadow`).

3. **Trailer API (TrailerModal.tsx)**
   - Trailers are rendered using `react-youtube` rather than raw iframes. This is required so we can use `player.unMute()` and `player.setVolume()` to dynamically adjust the audio slider without forcing the iframe to reload its `src` and restart the video.

## Error Code Convention
All thrown errors in backend functions and API services must use the `BIO-XXX` prefix format.

| Code | Location | Meaning |
|------|----------|---------|
| BIO-001 | `functions/api/movies.ts` | R2 bucket binding missing from Pages Function environment |
| BIO-002 | `src/services/tmdb.ts` | TMDB movie details fetch failed |
| BIO-003 | `src/services/tmdb.ts` | TMDB video/trailers fetch failed |
| BIO-004 | `src/services/tmdb.ts` | TMDB search fetch failed |
| BIO-005 | `src/config/library.ts` | `/api/movies` backend returned a non-OK response |
| BIO-100 | `src/components/VideoPlayer.tsx` | Video source failed to load (network error or 404) |
| BIO-101 | `src/components/VideoPlayer.tsx` | Video playback error |
| BIO-500 | Any backend function | Unhandled server-side exception |

### Error Rules
- All error messages in `Response` bodies must use: `{ "error": "BIO-XXX: human readable description" }`
- All `throw new Error(...)` in frontend services must use: `throw new Error("BIO-XXX: description")`
- When adding a new BIO code, document it in this file immediately.

## Deployment & Development
- **Build:** `npm run build`
- **Deploy:** `npx wrangler pages deploy dist --project-name bio`
- **Local test:** `npx wrangler pages dev dist` (serves on port 8788). 
  - *Note:* If you modify Vite components while testing against port 8788, you **must** run `npm run build` for Wrangler to serve the updated `dist` bundle.
- **Local mock:** The local Wrangler R2 mock is empty. The fallback in `library.ts` provides a hardcoded `Leviticus` entry when the API returns `[]`.
