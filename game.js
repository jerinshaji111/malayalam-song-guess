const STORE_KEY = 'paatu-songs-v1';
const LEGACY_AUDIO_KEY = 'paatu-audio-songs-v2';
const SEARCH_IMPORT_CLEANUP_KEY = 'paatu-old-search-imports-cleared-v1';
const YOUTUBE_API_KEY_STORE = 'paatu-youtube-data-api-key-v1';
const CLIP_STEPS = [0.5, 1, 2, 5];
const CLIP_POINTS = [100, 80, 60, 40];
const STARTER = [
  { id: 'malare', title: 'Malare', artist: 'Vijay Yesudas', film: 'Premam', year: 2015, genre: 'Melody', video: '0G2VxhV_gXM', aliases: ['Malare ninne kaanathirunnal'] },
  { id: 'parayuvaan', title: 'Parayuvaan', artist: 'Sid Sriram & Neha S. Nair', film: 'Ishq', year: 2019, genre: 'Melody', video: 'OvNBm3Lpu-Q', aliases: ['Parayuvan'] },
  { id: 'manyamaha-janangale', title: 'Manyamaha Janangale', artist: 'Vineeth Sreenivasan, Sachin Warrier & ensemble', film: 'Malarvaadi Arts Club', year: 2010, genre: 'Folk', video: 'Vj4brDhyFtM', aliases: ['Manyamaha Janangale Oru Sahayam Cheyyu'] },
  { id: 'kaathu-kaathu', title: 'Kaathu Kaathu', artist: 'Shaan Rahman', film: 'Malarvaadi Arts Club', year: 2010, genre: 'Melody', video: '8wP-0pdkX04', aliases: [] },
  { id: 'innoree-mazhayil', title: 'Innoree Mazhayil', artist: 'Vineeth Sreenivasan & Rahul Nambiar', film: 'Malarvaadi Arts Club', year: 2010, genre: 'Melody', video: 'QTjxyl-WmRE', aliases: ['Innoru Mazhayil'] },
  { id: 'changaayi', title: 'Changaayi', artist: 'Vineeth Sreenivasan & Sujatha Mohan', film: 'Malarvaadi Arts Club', year: 2010, genre: 'Melody', video: 'VgKKRQqr8fA', aliases: ['Changayi'] },
  { id: 'neeyam-thanalinu', title: 'Neeyam Thanalinu', artist: 'Vijay Yesudas & Thulasi Yatheendran', film: 'Cocktail', year: 2010, genre: 'Melody', video: '61I8mDlMP2U', aliases: ['Neeyaam Thanalinu'] }
];
const $ = id => document.getElementById(id);
let songs = loadSongs(), deck = [], activeSong = null, round = 0, score = 0, streak = 0, clueIndex = 0, locked = false;
let player = null, clipTimer = null, toastTimer;
let youtubeSearchResults = [];

// Cover layer over the YouTube video (hides the picture while the clue plays)
function coverVideo() { const m = $('videoMask'); if (m) m.hidden = false; }
function revealVideo() { const m = $('videoMask'); if (m) m.hidden = true; }

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0D00-\u0D7F]/g, '');
}
function youtubeVideoId(value) {
  try {
    const url = new URL(value), host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
    let id = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (!id) id = url.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
function isYouTubeShortUrl(value) {
  try {
    const url = new URL(value), host = url.hostname.replace(/^www\./, '').toLowerCase();
    return ['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host) && /^\/shorts\//i.test(url.pathname);
  } catch { return false; }
}
function videoFor(song) { return song.video || youtubeVideoId(song.sourceUrl || song.youtubeUrl || ''); }
function mergeStarterSongs(saved) {
  const knownVideos = new Set(saved.map(videoFor).filter(Boolean));
  const knownIds = new Set(saved.map(song => song.id));
  const missing = STARTER.filter(song => !knownVideos.has(videoFor(song)) && !knownIds.has(song.id));
  return missing.length ? [...saved, ...missing] : saved;
}
function loadSongs() {
  try {
    const cleanupDone = localStorage.getItem(SEARCH_IMPORT_CLEANUP_KEY) === '1';
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(saved)) {
      const retained = cleanupDone ? saved : saved.filter(song => !String(song.id || '').startsWith('youtube-'));
      const merged = mergeStarterSongs(retained);
      if (!cleanupDone || merged !== saved) localStorage.setItem(STORE_KEY, JSON.stringify(merged));
      if (!cleanupDone) localStorage.setItem(SEARCH_IMPORT_CLEANUP_KEY, '1');
      return merged;
    }
    const audioSaved = JSON.parse(localStorage.getItem(LEGACY_AUDIO_KEY));
    if (Array.isArray(audioSaved)) {
      const migrated = audioSaved.filter(s => videoFor(s) && (cleanupDone || !String(s.id || '').startsWith('youtube-'))).map(s => ({ ...s, video: videoFor(s) }));
      if (!cleanupDone) localStorage.setItem(SEARCH_IMPORT_CLEANUP_KEY, '1');
      if (migrated.length) return mergeStarterSongs(migrated);
    }
    if (!cleanupDone) localStorage.setItem(SEARCH_IMPORT_CLEANUP_KEY, '1');
  } catch {}
  return STARTER.slice();
}
function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(songs)); updateShelf(); }
function eraOf(year) { return Math.floor(Number(year) / 10) * 10; }
function getFilters() {
  return { era: $('eraSelect').value, year: $('yearSelect').value, genre: document.querySelector('.genre-chip.selected')?.dataset.genre || 'all' };
}
function filteredSongs() {
  const f = getFilters();
  return songs.filter(s => Boolean(videoFor(s)) && (f.era === 'all' || String(eraOf(s.year)) === f.era) && (f.year === 'all' || String(s.year) === f.year) && (f.genre === 'all' || s.genre === f.genre));
}
function shuffle(list) { return list.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(pair => pair[1]); }
function resetGame() {
  clearPlayer(); deck = shuffle(filteredSongs()); round = 0; streak = 0; locked = false; activeSong = null; score = 0;
  $('scoreValue').textContent = '000'; $('feedback').className = 'feedback';
  $('feedback').textContent = deck.length ? 'You can replay the clue as often as you need.' : 'Add Malayalam songs with YouTube links to start your shelf.';
  $('reveal').classList.remove('show'); $('nextBtn').style.display = 'none'; $('skipBtn').style.display = 'inline-block';
  updateStreak(); nextSong(true); updateFilterNote();
}
function nextSong(first = false) {
  clearPlayer(); if (!first && activeSong) round++;
  if (round >= 10 || round >= deck.length) {
    activeSong = null; $('roundText').textContent = deck.length ? 'Playlist complete' : 'Ready when you are'; $('clueTime').textContent = 'All done';
    $('playerPlaceholder').classList.remove('hidden');
    $('playerPlaceholder').innerHTML = '<div class="record"></div><b>' + (deck.length ? 'That’s the playlist!' : 'Add your first song') + '</b><p>' + (deck.length ? 'You scored ' + score + ' points.' : 'Add a YouTube song link to your shelf.') + '</p>';
    $('playBtn').disabled = true; $('replayBtn').disabled = true; $('guessInput').disabled = true; $('submitBtn').disabled = true; updateListenOptions();
    $('skipBtn').style.display = 'none'; $('nextBtn').style.display = 'none'; return;
  }
  activeSong = deck[round]; clueIndex = 0; locked = false;
  $('roundText').textContent = 'Round ' + String(round + 1).padStart(2, '0') + ' / ' + String(Math.min(10, deck.length)).padStart(2, '0');
  $('playerShell').classList.remove('has-player'); $('playerPlaceholder').classList.remove('hidden');
  $('playerPlaceholder').innerHTML = '<div class="record"></div><b>Your clue is ready</b><p>Press play to hear a Malayalam song</p>';
  $('clueTime').textContent = clueLabel(clueIndex) + ' clue · ' + CLIP_POINTS[clueIndex] + ' pts available'; $('guessInput').value = ''; $('guessInput').disabled = false; $('submitBtn').disabled = false;
  $('playBtn').disabled = false; $('playBtn').textContent = '▶  Play clue'; $('replayBtn').disabled = true;
  $('feedback').className = 'feedback'; $('feedback').textContent = 'You can replay the clue as often as you need.';
  $('reveal').classList.remove('show'); $('skipBtn').style.display = 'inline-block'; $('nextBtn').style.display = 'none';
  paintProgress(); updateListenOptions(); suggestions('');
}
function clueLabel(index) { return CLIP_STEPS[index] + ' sec'; }
function paintProgress() {
  [...$('progress').children].forEach((el, i) => el.classList.toggle('on', i <= clueIndex));
  $('clueTime').textContent = clueLabel(clueIndex) + ' clue · ' + CLIP_POINTS[clueIndex] + ' pts available';
  updateListenOptions();
}
function updateListenOptions() {
  document.querySelectorAll('.clue-option').forEach(button => {
    const index = Number(button.dataset.clueIndex), used = clueIndex >= index;
    button.disabled = !activeSong || locked || used;
    button.textContent = used ? clueLabel(index) + ' clue used' : 'Play ' + clueLabel(index) + ' · ' + CLIP_POINTS[index] + ' pts';
  });
}
function chooseLongerClue(event) {
  const button = event.target.closest('.clue-option');
  if (!button || button.disabled || !activeSong || locked) return;
  clueIndex = Number(button.dataset.clueIndex);
  paintProgress();
  $('feedback').className = 'feedback';
  $('feedback').textContent = 'Playing the ' + clueLabel(clueIndex) + ' clue. A correct answer is worth up to ' + CLIP_POINTS[clueIndex] + ' points.';
  playClue();
}
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (window._paatuYTReady) return window._paatuYTReady;
  window._paatuYTReady = new Promise(resolve => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prior) prior(); resolve(); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true; document.head.appendChild(script);
  });
  return window._paatuYTReady;
}
function stopPlayer() { if (clipTimer) clearTimeout(clipTimer); clipTimer = null; if (player?.pauseVideo) try { player.pauseVideo(); } catch {} }
function clearPlayer() {
  stopPlayer(); if (player?.destroy) try { player.destroy(); } catch {} player = null;
  const mount = document.getElementById('yt-player'); if (mount) mount.remove();
  $('playerShell').classList.remove('has-player'); $('playerPlaceholder').classList.remove('hidden');
  revealVideo();
}
function schedulePause(target) {
  if (clipTimer) clearTimeout(clipTimer);
  clipTimer = setTimeout(() => { try { target.pauseVideo(); } catch {} }, CLIP_STEPS[clueIndex] * 1000);
}
async function playClue() {
  if (!activeSong || locked) return;
  const video = videoFor(activeSong); if (!video) { toast('This track has no YouTube link yet.'); return; }
  clearPlayer(); $('playerShell').classList.add('has-player'); $('playerPlaceholder').classList.add('hidden');
  coverVideo();
  $('replayBtn').disabled = false; $('playBtn').textContent = '♫  Playing clue…';
  try {
    await loadYouTubeAPI();
    const mount = document.createElement('div'); mount.id = 'yt-player'; $('playerShell').insertBefore(mount, $('playerPlaceholder'));
    player = new YT.Player('yt-player', {
      height: '260', width: '100%', videoId: video,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: event => {
          event.target.seekTo(0, true); event.target.playVideo();
          // Mobile autoplay fallback: if playback didn't start, uncover the video so the user can tap play.
          setTimeout(() => {
            try { if (player === event.target && event.target.getPlayerState() !== YT.PlayerState.PLAYING) revealVideo(); } catch {}
          }, 1500);
        },
        onStateChange: event => {
          if (event.data === YT.PlayerState.PLAYING) { coverVideo(); $('playBtn').textContent = '♫  Playing clue…'; schedulePause(event.target); }
          if (event.data === YT.PlayerState.PAUSED) { if (clipTimer) clearTimeout(clipTimer); clipTimer = null; $('playBtn').textContent = '▶  Play ' + CLIP_STEPS[clueIndex] + ' sec clue'; }
          if (event.data === YT.PlayerState.ENDED) { if (clipTimer) clearTimeout(clipTimer); clipTimer = null; $('playBtn').textContent = '▶  Replay clue'; }
        },
        onError: () => { revealVideo(); $('feedback').className = 'feedback bad'; $('feedback').textContent = 'This video can’t be played here. Try another link from the song shelf.'; $('playBtn').textContent = '▶  Try again'; }
      }
    });
  } catch {
    revealVideo();
    $('feedback').className = 'feedback bad'; $('feedback').textContent = 'Could not load the YouTube player. Check your connection and try again.'; $('playBtn').textContent = '▶  Play clue';
  }
}
function replay() {
  if (!player) { playClue(); return; }
  try { if (clipTimer) clearTimeout(clipTimer); clipTimer = null; coverVideo(); player.seekTo(0, true); player.playVideo(); } catch { playClue(); }
}
function revealSong() {
  if (!activeSong) return;
  revealVideo();
  $('revealTitle').textContent = activeSong.title;
  $('revealMeta').textContent = [activeSong.artist, activeSong.film, activeSong.year, activeSong.genre].filter(Boolean).join(' · ');
  $('reveal').classList.add('show');
}
function submitGuess() {
  if (!activeSong || locked) return;
  const raw = $('guessInput').value.trim();
  if (!raw) { $('feedback').className = 'feedback bad'; $('feedback').textContent = 'Type a title first — trust your ears.'; $('guessInput').focus(); return; }
  const accepted = [activeSong.title, ...(activeSong.aliases || [])].map(norm);
  if (accepted.includes(norm(raw))) {
    locked = true; stopPlayer(); const points = CLIP_POINTS[clueIndex] || CLIP_POINTS[CLIP_POINTS.length - 1]; score += points; streak++;
    $('scoreValue').textContent = String(score).padStart(3, '0'); $('feedback').className = 'feedback good'; $('feedback').textContent = 'That’s it! +' + points + ' points';
    revealSong(); finishRound();
  } else {
    streak = 0; updateStreak();
    if (clueIndex < CLIP_STEPS.length - 1) { clueIndex++; paintProgress(); $('feedback').className = 'feedback bad'; $('feedback').textContent = 'Not quite. A longer clue is unlocked — listen again.'; replay(); }
    else { $('feedback').className = 'feedback bad'; $('feedback').textContent = 'That was the last clue. Skip to reveal the answer.'; }
  }
}
function finishRound() {
  $('guessInput').disabled = true; $('submitBtn').disabled = true; updateListenOptions(); $('skipBtn').style.display = 'none'; $('nextBtn').style.display = 'inline-block';
  $('nextBtn').textContent = round + 1 >= Math.min(10, deck.length) ? 'Finish playlist →' : 'Next song →'; updateStreak();
}
function skip() { if (!activeSong) return; stopPlayer(); locked = true; streak = 0; updateStreak(); $('feedback').className = 'feedback'; $('feedback').textContent = 'Skipped — here’s the answer.'; revealSong(); finishRound(); }
function updateStreak() { $('streakText').textContent = streak + ' in a row ✦'; }
function updateFilterNote() { const n = filteredSongs().length; $('filterNote').textContent = n ? `${n} ${n === 1 ? 'song' : 'songs'} in this lane. The playlist shuffles each time you change a filter.` : 'No tracks in this lane yet. Add a song that fits your filters.'; }
function populateYears() {
  const select = $('yearSelect'), old = select.value, years = [...new Set(songs.map(s => Number(s.year)).filter(Boolean))].sort((a, b) => b - a);
  select.innerHTML = '<option value="all">Any year</option>' + years.map(y => `<option value="${y}">${y}</option>`).join(''); if (years.map(String).includes(old)) select.value = old;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function updateShelf() {
  const count = songs.length; $('trackCount').textContent = count; $('shelfCount').textContent = '(' + count + ')';
  $('songList').innerHTML = songs.map(s => `<div>♪ ${escapeHtml(s.title)} <span style="color:#aabbb2">· ${s.year} · ${escapeHtml(s.genre)}</span></div>`).join('') || 'No songs saved yet.';
  populateYears(); updateFilterNote();
}
function suggestions(q) {
  const box = $('suggestions'), query = norm(q);
  if (!query || !activeSong || locked) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const matches = songs.filter(s => norm(s.title).includes(query)).slice(0, 5); if (!matches.length) { box.classList.remove('show'); return; }
  box.innerHTML = matches.map(s => `<div class="suggestion" role="option" data-title="${escapeHtml(s.title)}">${escapeHtml(s.title)} <span style="color:#7b8983">· ${s.year}</span></div>`).join('');
  box.classList.add('show'); box.querySelectorAll('.suggestion').forEach(el => el.addEventListener('click', () => { $('guessInput').value = el.dataset.title; box.classList.remove('show'); $('guessInput').focus(); }));
}
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400); }
async function importYoutubeDetails() {
  const form = $('addSongForm'), url = String(new FormData(form).get('youtubeUrl') || '').trim(), id = youtubeVideoId(url), status = $('youtubeImportStatus'), button = $('importYoutubeBtn');
  if (isYouTubeShortUrl(url)) { status.textContent = 'YouTube Shorts are not accepted. Use a full movie song video instead.'; return; }
  if (!id) { status.textContent = 'Paste a valid full YouTube video or Music link.'; return; }
  button.disabled = true; button.textContent = 'Fetching details…'; status.textContent = 'Looking up the video title and channel…';
  try {
    const endpoint = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id);
    const response = await fetch(endpoint, { mode: 'cors' }); if (!response.ok) throw new Error('Lookup failed');
    const metadata = await response.json(); if (!metadata.title) throw new Error('No title returned');
    form.elements.title.value = metadata.title.slice(0, 80); form.elements.artist.value = (metadata.author_name || '').slice(0, 60);
    form.elements.youtubeUrl.value = 'https://www.youtube.com/watch?v=' + id; status.textContent = 'Imported title and channel. Add the release year and genre, then save the song.';
  } catch { status.textContent = 'Could not fetch details for that link. Fill in the title and artist manually, then save the song link.'; }
  finally { button.disabled = false; button.textContent = '↳ Import song details'; }
}
function addSong(event) {
  event.preventDefault(); const form = event.currentTarget, data = new FormData(form), url = String(data.get('youtubeUrl') || '').trim();
  const video = youtubeVideoId(url), title = String(data.get('title') || '').trim(), year = Number(data.get('year'));
  if (isYouTubeShortUrl(url)) { toast('YouTube Shorts are not accepted. Add a full movie song video.'); return; }
  if (!video) { toast('Add a valid YouTube video link.'); return; }
  if (year < 1950 || year > 2029) { toast('Choose a release year between 1950 and 2029.'); return; }
  if (songs.some(s => norm(s.title) === norm(title))) { toast('That title is already on your shelf.'); return; }
  songs.push({ id: 'song-' + Date.now(), title, artist: String(data.get('artist') || '').trim(), film: '', year, genre: String(data.get('genre')), video, sourceUrl: url, aliases: [] });
  persist(); form.reset(); $('youtubeImportStatus').textContent = 'Paste a YouTube link to fill in the title and channel.'; toast('Added to your shelf!'); resetGame();
}
function savedYouTubeApiKey() {
  try { return localStorage.getItem(YOUTUBE_API_KEY_STORE) || ''; } catch { return ''; }
}
function saveYouTubeApiKey() {
  const key = $('ytApiKey').value.trim();
  if (!key) { $('apiKeyStatus').textContent = 'Paste a YouTube Data API key first.'; return; }
  try {
    localStorage.setItem(YOUTUBE_API_KEY_STORE, key);
    $('apiKeyStatus').textContent = 'Key saved in this browser. Restrict it to YouTube Data API v3 and this Site’s web address in Google Cloud.';
  } catch { $('apiKeyStatus').textContent = 'This browser could not save the key. Check its storage settings and try again.'; }
}
function isMalayalamMovieSongResult(item) {
  const snippet = item?.snippet || {}, title = String(snippet.title || ''), description = String(snippet.description || ''), channel = String(snippet.channelTitle || '');
  const searchable = `${title} ${description}`;
  if (/\b(trailer|teaser|review|interview|making|behind the scenes|full movie|full film|jukebox|reaction|explained|movie scene|comedy scene|status video|shorts)\b|#shorts?\b/i.test(searchable)) return false;
  const songCue = /\b(song|songs|audio|lyric(?:al)?|music video|soundtrack|ost)\b|പാട്ട്|ഗാനം|ഗാനങ്ങൾ|സോങ്/i.test(searchable);
  const movieCue = /\b(movie|film|cinema|soundtrack|ost)\b|\b(?:movie|film)\s*:/i.test(searchable) || /സിനിമ|ചിത്രം|മൂവി/i.test(searchable);
  const malayalamCue = /\b(malayalam|mollywood)\b|മലയാള/i.test(`${searchable} ${channel}`) || /manorama music|muzik247|satyam audios|millennium audios|east coast audio|t-series malayalam|sony music malayalam|think music malayalam|goodwill entertainments/i.test(channel);
  return songCue && movieCue && malayalamCue;
}
function searchQueryForYear(year) {
  return `Malayalam movie songs ${year} official -trailer -teaser -review -interview -jukebox -fullmovie -reaction -shorts -#shorts`;
}
function durationSeconds(value) {
  const match = String(value || '').match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}
async function longFormVideoIds(items, key) {
  const ids = [...new Set(items.map(item => item.id?.videoId).filter(id => /^[A-Za-z0-9_-]{11}$/.test(id || '')))];
  if (!ids.length) return new Set();
  const params = new URLSearchParams({ part: 'contentDetails', id: ids.join(','), key });
  const response = await fetch('https://www.googleapis.com/youtube/v3/videos?' + params.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Could not verify video lengths to filter Shorts.');
  return new Set((data.items || []).filter(video => durationSeconds(video.contentDetails?.duration) > 180).map(video => video.id));
}
function resultFilm(snippet) {
  return String(snippet?.description || '').match(/(?:movie|film)\s*:\s*([^\n|]+)/i)?.[1]?.trim().slice(0, 80) || '';
}
function resultSinger(snippet) {
  return String(snippet?.description || '').match(/singer(?:\s*\(s\))?s?\s*:\s*([^\n|]+)/i)?.[1]?.trim().slice(0, 80) || '';
}
function renderYouTubeSearchResults(year) {
  const host = $('discoverResults');
  if (!youtubeSearchResults.length) { host.innerHTML = '<div class="local-note">No likely Malayalam movie songs found for this year. Try another year or inspect the search terms.</div>'; return; }
  host.innerHTML = '<div class="yt-results-label">Search results from YouTube · review each result before adding</div>' + youtubeSearchResults.map(item => {
    const videoId = item.id?.videoId, snippet = item.snippet || {}, title = escapeHtml(cleanSearchTitle(snippet.title || 'Untitled video')), channel = escapeHtml(snippet.channelTitle || 'YouTube channel');
    const uploaded = snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Upload date unavailable';
    const alreadyAdded = songs.some(song => videoFor(song) === videoId);
    return `<article class="yt-result"><div class="yt-result-copy"><a class="yt-result-title" href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">${title}</a><div class="yt-result-meta">${channel} · uploaded ${uploaded}</div><label class="yt-year-label">Song release year<input class="yt-result-year" type="number" min="1950" max="2029" value="${year}" aria-label="Song release year for ${title}"></label></div><button class="yt-add-result" type="button" data-video-id="${videoId}" ${alreadyAdded ? 'disabled' : ''}>${alreadyAdded ? 'Added' : '＋ Add'}</button></article>`;
  }).join('');
}
async function searchYouTubeByYear() {
  const year = Number($('discoverYear').value), key = $('ytApiKey').value.trim() || savedYouTubeApiKey(), button = $('discoverBtn'), host = $('discoverResults');
  if (!Number.isInteger(year) || year < 1950 || year > 2029) { $('apiKeyStatus').textContent = 'Enter a release year between 1950 and 2029.'; return; }
  if (!key) { $('apiKeyStatus').textContent = 'Add a YouTube Data API key first. See the setup guide below.'; $('ytApiKey').focus(); return; }
  if ($('ytApiKey').value.trim()) { try { localStorage.setItem(YOUTUBE_API_KEY_STORE, key); } catch {} }
  button.disabled = true; host.innerHTML = '<div class="local-note">Searching for Malayalam movie songs from ' + year + '…</div>';
  const params = new URLSearchParams({ part: 'snippet', type: 'video', q: searchQueryForYear(year), maxResults: '50', videoEmbeddable: 'true', regionCode: 'IN', relevanceLanguage: 'ml', key });
  try {
    const response = await fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'YouTube search failed. Check the API key and quota.');
    const results = data.items || [], longFormIds = await longFormVideoIds(results, key);
    youtubeSearchResults = results.filter(item => longFormIds.has(item.id?.videoId) && isMalayalamMovieSongResult(item));
    renderYouTubeSearchResults(year);
    $('apiKeyStatus').textContent = 'Found ' + youtubeSearchResults.length + ' likely Malayalam movie songs for ' + year + '. Results are filtered by song, film, and Malayalam clues; confirm the release year before adding.';
  } catch (error) {
    youtubeSearchResults = [];
    host.innerHTML = '';
    $('apiKeyStatus').textContent = 'Search failed: ' + String(error.message || error).slice(0, 220) + ' Check that YouTube Data API v3 is enabled, the key allows this Site, and quota remains.';
  } finally { button.disabled = false; button.textContent = 'Find Malayalam movie songs'; }
}
function cleanSearchTitle(rawTitle) {
  return String(rawTitle || '').split('|')[0].replace(/\s*[-–—]\s*(official\s+)?(music\s+)?(video|lyric\s+video|lyrics)\s*$/i, '').trim().slice(0, 80);
}
async function loadSongsForYear() {
  const year = Number($('discoverYear').value);
  const key = $('ytApiKey').value.trim() || savedYouTubeApiKey();
  const button = $('bulkLoadBtn'), status = $('bulkLoadStatus');
  if (!Number.isInteger(year) || year < 1950 || year > 2029) { $('apiKeyStatus').textContent = 'Enter a release year between 1950 and 2029.'; return; }
  if (!key) { $('apiKeyStatus').textContent = 'Add a YouTube Data API key first. See the setup guide below.'; $('ytApiKey').focus(); return; }
  if ($('ytApiKey').value.trim()) { try { localStorage.setItem(YOUTUBE_API_KEY_STORE, key); } catch {} }
  button.disabled = true; $('discoverBtn').disabled = true;
  const knownVideos = new Set(songs.map(videoFor).filter(Boolean));
  let fetched = 0, qualified = 0, added = 0, page = 0;
  try {
    let pageToken = '';
    do {
      status.textContent = `Searching ${year}, page ${page + 1}… ${added} songs added so far.`;
      const params = new URLSearchParams({ part: 'snippet', type: 'video', q: searchQueryForYear(year), maxResults: '50', videoEmbeddable: 'true', regionCode: 'IN', relevanceLanguage: 'ml', key });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `YouTube search failed for ${year}.`);
      const results = (data.items || []).filter(item => /^[A-Za-z0-9_-]{11}$/.test(item.id?.videoId || ''));
      fetched += results.length; page++;
      const longFormIds = await longFormVideoIds(results, key);
      const songResults = results.filter(item => longFormIds.has(item.id.videoId) && isMalayalamMovieSongResult(item));
      qualified += songResults.length;
      for (const item of songResults) {
        const video = item.id.videoId;
        if (knownVideos.has(video)) continue;
        const rawTitle = String(item.snippet?.title || '').trim();
        const title = cleanSearchTitle(rawTitle);
        if (!title) continue;
        const duplicateTitle = songs.some(song => norm(song.title) === norm(title));
        if (duplicateTitle) { knownVideos.add(video); continue; }
        songs.push({ id: 'youtube-' + video, title, artist: resultSinger(item.snippet), film: resultFilm(item.snippet), year, genre: $('discoverGenre').value, video, sourceUrl: 'https://www.youtube.com/watch?v=' + video, aliases: rawTitle && norm(rawTitle) !== norm(title) ? [rawTitle] : [] });
        knownVideos.add(video); added++;
      }
      persist();
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    status.textContent = `Finished ${year}: checked ${fetched} results, kept ${qualified} likely Malayalam movie songs, and added ${added} new tracks.`;
    $('apiKeyStatus').textContent = 'Search filters reduce unrelated videos, but YouTube metadata cannot guarantee the actual release year. Review imported titles and years.';
    resetGame();
  } catch (error) {
    status.textContent = `Stopped on ${year} after ${page} pages: added ${added} songs before the error. ${String(error.message || error).slice(0, 180)} Earlier additions are saved.`;
  } finally { button.disabled = false; $('discoverBtn').disabled = false; }
}
function addYouTubeSearchResult(event) {
  const button = event.target.closest('.yt-add-result'); if (!button || button.disabled) return;
  const item = youtubeSearchResults.find(result => result.id?.videoId === button.dataset.videoId); if (!item) return;
  const row = button.closest('.yt-result'), year = Number(row.querySelector('.yt-result-year').value), video = item.id.videoId;
  if (!Number.isInteger(year) || year < 1950 || year > 2029) { toast('Confirm a release year between 1950 and 2029.'); return; }
  if (songs.some(song => videoFor(song) === video)) { button.textContent = 'Added'; button.disabled = true; toast('That video is already on your shelf.'); return; }
  const rawTitle = String(item.snippet?.title || '').trim(), title = cleanSearchTitle(rawTitle);
  if (songs.some(song => norm(song.title) === norm(title))) { toast('That title is already on your shelf.'); return; }
  songs.push({ id: 'song-' + Date.now(), title, artist: resultSinger(item.snippet), film: resultFilm(item.snippet), year, genre: $('discoverGenre').value, video, sourceUrl: 'https://www.youtube.com/watch?v=' + video, aliases: rawTitle && norm(rawTitle) !== norm(title) ? [rawTitle] : [] });
  persist(); button.textContent = 'Added'; button.disabled = true; toast('Added to your shelf!');
}

$('playBtn').addEventListener('click', playClue); $('replayBtn').addEventListener('click', replay); $('submitBtn').addEventListener('click', submitGuess);
$('guessInput').addEventListener('input', e => suggestions(e.target.value));
$('guessInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('suggestions').classList.remove('show'); submitGuess(); } if (e.key === 'Escape') $('suggestions').classList.remove('show'); });
document.addEventListener('click', e => { if (!e.target.closest('.guess-wrap')) $('suggestions').classList.remove('show'); });
$('skipBtn').addEventListener('click', skip); $('nextBtn').addEventListener('click', () => nextSong());
$('eraSelect').addEventListener('change', () => { resetGame(); populateYears(); }); $('yearSelect').addEventListener('change', resetGame);
$('clueOptions').addEventListener('click', chooseLongerClue);
$('genreList').addEventListener('click', e => { const chip = e.target.closest('.genre-chip'); if (!chip) return; document.querySelectorAll('.genre-chip').forEach(b => b.classList.toggle('selected', b === chip)); resetGame(); });
$('resetFilters').addEventListener('click', () => { $('eraSelect').value = 'all'; $('yearSelect').value = 'all'; document.querySelectorAll('.genre-chip').forEach(b => b.classList.toggle('selected', b.dataset.genre === 'all')); resetGame(); });
$('openAddBtn').addEventListener('click', () => { $('shelf').classList.add('show'); $('addDetails').open = true; $('song-shelf').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
$('showSongsBtn').addEventListener('click', () => { $('shelf').classList.toggle('show'); if ($('shelf').classList.contains('show')) $('song-shelf').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
$('importYoutubeBtn').addEventListener('click', importYoutubeDetails); $('addSongForm').addEventListener('submit', addSong);
if ($('ytApiKey')) { $('ytApiKey').value = savedYouTubeApiKey(); $('ytApiKey').addEventListener('change', saveYouTubeApiKey); }
if ($('saveApiKeyBtn')) $('saveApiKeyBtn').addEventListener('click', saveYouTubeApiKey);
if ($('discoverBtn')) $('discoverBtn').addEventListener('click', searchYouTubeByYear);
if ($('bulkLoadBtn')) $('bulkLoadBtn').addEventListener('click', loadSongsForYear);
if ($('discoverResults')) $('discoverResults').addEventListener('click', addYouTubeSearchResult);
updateShelf(); resetGame();
