# Paatu! Malayalam Song Guess

A static Malayalam movie-song guessing game. It uses plain HTML, CSS, and JavaScript; no build step or dependency installation is needed.

## Upload to GitHub

1. Extract this ZIP.
2. Create an empty GitHub repository.
3. Upload the extracted files and folders (including `index.html`, `game.js`, and `dist/`); do not upload only the ZIP.
4. For GitHub Pages, open **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`.

## Cloudflare Pages

Connect the repository using **Workers & Pages → Create application → Pages → Connect to Git**. Choose **None** as the framework, leave the build command blank, and set the output directory to `dist`.

## Clues and scoring

Each round starts at 0.5 seconds (up to 100 points). Optional clues are 1 second (80 points), 2 seconds (60 points), and a final 5-second clue (40 points). A wrong guess after 5 seconds ends the clue ladder. Replaying a selected clue is free.

## Song discovery and Shorts filtering

Search excludes results labeled Shorts and filters out videos 3 minutes or shorter because the YouTube API does not provide a reliable Shorts flag. This can omit a few unusually short full songs. Direct YouTube `/shorts/` links are rejected when adding songs.

## YouTube API key

Song discovery asks for a YouTube Data API key in the browser and saves it there. Never paste a key into these files or commit one to Git. Restrict your key to your deployed hostname and YouTube Data API v3.

## Data storage

Songs and the API key use each browser's local storage. Visitors have separate song shelves; this static version does not sync songs between people or devices.
