# Paatu! Malayalam Song Guess

A static Malayalam movie-song guessing game. It uses plain HTML, CSS, and JavaScript; there is no build step or dependency installation.

## Upload to GitHub

1. Extract this ZIP on your computer.
2. Create a new, empty GitHub repository.
3. Upload the extracted files and folders (including `index.html`, `game.js`, and `dist/`) to the repository. Do not upload the ZIP as the only repository file.
4. To use GitHub Pages, open **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`. The root `index.html` is ready to serve.

## Deploy with Cloudflare Pages

Connect the GitHub repository using **Workers & Pages → Create application → Pages → Connect to Git**. Choose **None** as the framework, leave the build command blank, and set the build output directory to `dist`. Cloudflare will deploy on future pushes.

## YouTube API key

The page asks for a YouTube Data API key in the browser when using song discovery. The key is saved in that browser only. Do not paste a key into these files or commit one to Git. After deployment, restrict the key to the deployed website hostname and YouTube Data API v3.

## Data storage

Songs and the API key are stored in each browser's local storage. Visitors have separate song shelves; this static version does not sync song data between people or devices.
