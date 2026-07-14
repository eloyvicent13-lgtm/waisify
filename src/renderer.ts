// Declare types for Electron and YouTube APIs
declare global {
  interface Window {
    waisifyAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onGlobalMediaCommand: (callback: (command: 'play-pause' | 'next' | 'prev') => void) => () => void;
      toggleMiniPlayer: (enabled: boolean) => void;
    };
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

// Global Diagnostics Error Handlers
window.addEventListener('error', (event) => {
  console.error("GLOBAL ERROR:", event.error);
  alert("ERROR GLOBAL: " + event.message + "\nArchivo: " + event.filename + "\nLínea: " + event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error("UNHANDLED REJECTION:", event.reason);
  alert("RECHAZO DE PROMESA: " + (event.reason?.message || event.reason));
});

// Config
const API_BASE_URL = 'http://149.202.84.78:8150';
const LIKED_SONGS_PLAYLIST_NAME = 'Canciones que te gustan';

// State
let token = localStorage.getItem('waisify_token') || '';
let username = localStorage.getItem('waisify_username') || '';
let userId = localStorage.getItem('waisify_userid') || '';

interface Track {
  id: string; // YouTube or Spotify ID
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // in seconds
  youtubeId?: string;
  playlistTrackId?: number; // DB primary key inside playlist track
}

interface Playlist {
  id: number;
  name: string;
}

interface SyncedLine {
  time: number; // in seconds
  text: string;
}

let playlists: Playlist[] = [];
let currentPlaylistId: number | null = null;
let currentQueue: Track[] = [];
let currentQueueIndex = -1;
let playQueue: Track[] = []; // Explicit user play queue (Añadir a la cola)
let isPlaying = false;
let isMuted = false;
let isShuffle = false;
let previousVolume = 50; // YT player volume is 0-100
let ytPlayer: any = null;
let progressInterval: any = null;

// History navigation state
let viewHistory: string[] = ['home'];
let historyIndex = 0;

// Active Track Context Menu State
let activeMenuTrack: Track | null = null;

// Synced lyrics state
let lyricsLines: SyncedLine[] = [];
let isSyncedLyrics = false;
let currentLyricsTrackId = '';
let lyricsSyncOffset = 0;

// DOM Elements
const authOverlay = document.getElementById('auth-overlay') as HTMLDivElement;
const appLayout = document.getElementById('app-layout') as HTMLDivElement;
const playerBar = document.getElementById('player-bar') as HTMLDivElement;
const authForm = document.getElementById('auth-form') as HTMLFormElement;
const authTitle = document.getElementById('auth-title') as HTMLHeadingElement;
const authUsername = document.getElementById('auth-username') as HTMLInputElement;
const authPassword = document.getElementById('auth-password') as HTMLInputElement;
const authSubmitBtn = document.getElementById('auth-submit-btn') as HTMLButtonElement;
const authSwitchLink = document.getElementById('auth-switch-link') as HTMLAnchorElement;
const authSwitchText = document.getElementById('auth-switch-text') as HTMLSpanElement;
const authErrorMsg = document.getElementById('auth-error-msg') as HTMLDivElement;

// Navigation Header
const navBackBtn = document.getElementById('nav-back') as HTMLButtonElement;
const navForwardBtn = document.getElementById('nav-forward') as HTMLButtonElement;
const globalSearchInput = document.getElementById('global-search-input') as HTMLInputElement;
const displayUsername = document.getElementById('nav-username') as HTMLSpanElement;
const logoutBtn = document.getElementById('nav-logout-btn') as HTMLButtonElement;
const avatarLetter = document.getElementById('avatar-letter') as HTMLDivElement;

// Titlebar buttons
const minBtn = document.getElementById('min-btn') as HTMLButtonElement;
const maxBtn = document.getElementById('max-btn') as HTMLButtonElement;
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;

// Sidebar
const navHomeLink = document.getElementById('nav-home-link') as HTMLAnchorElement;
const navSearchLink = document.getElementById('nav-search-link') as HTMLAnchorElement;
const navPlaylistsLink = document.getElementById('nav-playlists-link') as HTMLAnchorElement;
const navSettingsLink = document.getElementById('nav-settings-link') as HTMLAnchorElement;
const sidebarPlaylists = document.getElementById('sidebar-playlists') as HTMLDivElement;
const createPlaylistBtn = document.getElementById('create-playlist-btn') as HTMLButtonElement;

// Playlist creation modal elements
const playlistModal = document.getElementById('playlist-modal') as HTMLDivElement;
const newPlaylistNameInput = document.getElementById('new-playlist-name') as HTMLInputElement;
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const modalSubmitBtn = document.getElementById('modal-submit-btn') as HTMLButtonElement;

// View panels
const homeView = document.getElementById('home-view') as HTMLElement;
const searchView = document.getElementById('search-view') as HTMLElement;
const playlistView = document.getElementById('playlist-view') as HTMLElement;
const settingsView = document.getElementById('settings-view') as HTMLElement;
const searchResults = document.getElementById('search-results') as HTMLDivElement;

// Playlist details elements
const playlistTitle = document.getElementById('playlist-title') as HTMLHeadingElement;
const playlistAuthor = document.getElementById('playlist-author') as HTMLSpanElement;
const playlistTrackCount = document.getElementById('playlist-track-count') as HTMLSpanElement;
const playlistTracks = document.getElementById('playlist-tracks') as HTMLDivElement;
const deletePlaylistBtn = document.getElementById('delete-playlist-btn') as HTMLButtonElement;

// Playlist bar action buttons
const playlistPlayBtn = document.getElementById('playlist-play-btn') as HTMLButtonElement;
const playlistShuffleBtn = document.getElementById('playlist-shuffle-btn') as HTMLButtonElement;
const playlistLikeBtn = document.getElementById('playlist-like-btn') as HTMLButtonElement;
const playlistDownloadBtn = document.getElementById('playlist-download-btn') as HTMLButtonElement;
const playlistMenuBtn = document.getElementById('playlist-menu-btn') as HTMLButtonElement;

// Player elements
const playerCover = document.getElementById('player-cover') as HTMLImageElement;
const playerTitle = document.getElementById('player-title') as HTMLDivElement;
const playerArtist = document.getElementById('player-artist') as HTMLDivElement;
const playerLikeBtn = document.getElementById('player-like-btn') as HTMLButtonElement;
const playerMenuBtn = document.getElementById('player-menu-btn') as HTMLButtonElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const shuffleBtn = document.getElementById('shuffle-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const progressBar = document.getElementById('progress-bar') as HTMLInputElement;
const currentTimeLabel = document.getElementById('current-time') as HTMLSpanElement;
const totalTimeLabel = document.getElementById('total-time') as HTMLSpanElement;
const volumeIconBtn = document.getElementById('volume-icon-btn') as HTMLButtonElement;
const volumeBar = document.getElementById('volume-bar') as HTMLInputElement;

// Lyrics panel elements
const playerLyricsBtn = document.getElementById('player-lyrics-btn') as HTMLButtonElement;
const lyricsPanel = document.getElementById('lyrics-panel') as HTMLDivElement;
const closeLyricsBtn = document.getElementById('close-lyrics-btn') as HTMLButtonElement;
const lyricsSongTitle = document.getElementById('lyrics-song-title') as HTMLSpanElement;
const lyricsText = document.getElementById('lyrics-text') as HTMLDivElement;
const lyricsSyncControls = document.getElementById('lyrics-sync-controls') as HTMLDivElement;
const lyricsSyncOffsetLabel = document.getElementById('lyrics-sync-offset-label') as HTMLSpanElement;
const lyricsSyncDelay = document.getElementById('lyrics-sync-delay') as HTMLButtonElement;
const lyricsSyncAdvance = document.getElementById('lyrics-sync-advance') as HTMLButtonElement;
const lyricsSyncReset = document.getElementById('lyrics-sync-reset') as HTMLButtonElement;

// Import Playlist Modal elements
const importPlaylistBtn = document.getElementById('import-playlist-btn') as HTMLButtonElement;
const importModal = document.getElementById('import-modal') as HTMLDivElement;
const importPlaylistUrl = document.getElementById('import-playlist-url') as HTMLInputElement;
const importProgressContainer = document.getElementById('import-progress-container') as HTMLDivElement;
const importStatusText = document.getElementById('import-status-text') as HTMLSpanElement;
const importProgressBarFill = document.getElementById('import-progress-bar-fill') as HTMLDivElement;
const importProgressPercent = document.getElementById('import-progress-percent') as HTMLSpanElement;
const importCancelBtn = document.getElementById('import-cancel-btn') as HTMLButtonElement;
const importSubmitBtn = document.getElementById('import-submit-btn') as HTMLButtonElement;

// Context Menu elements
const contextMenu = document.getElementById('context-menu') as HTMLDivElement;
const menuAddToQueue = document.getElementById('menu-add-to-queue') as HTMLDivElement;
const menuToggleLibrary = document.getElementById('menu-toggle-library') as HTMLDivElement;
const menuLibraryText = document.getElementById('menu-library-text') as HTMLSpanElement;
const menuPlaylistSubmenu = document.getElementById('menu-playlist-submenu') as HTMLDivElement;
const menuDownload = document.getElementById('menu-download') as HTMLDivElement;
const menuShare = document.getElementById('menu-share') as HTMLDivElement;

// Toast Container
const toastContainer = document.getElementById('toast-container') as HTMLDivElement;

// Design custom toggles state
let isAdaptiveBgEnabled = true;
let isVisualizerEnabled = true;
let visualizerBassFactor = 1.0;

// Toast Helper
function showToast(message: string, type: 'success' | 'info' = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Slider hover states
let pgHovered = false;
let volHovered = false;

// Slider background fill updates (Spotify-style)
function updateSliderFill(input: HTMLInputElement) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || 0;
  const percent = ((value - min) / (max - min)) * 100;
  
  const isHovered = (input === progressBar) ? pgHovered : volHovered;
  const fillColor = isHovered ? '#1ed760' : '#ffffff'; // Green on hover, White otherwise!
  
  input.style.background = `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percent}%, rgba(255, 255, 255, 0.15) ${percent}%, rgba(255, 255, 255, 0.15) 100%)`;
}

// Color Thief Canvas Extractor Helper
function getDominantColors(imgEl: HTMLImageElement): { rgb1: string; rgb2: string } {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { rgb1: '#180828', rgb2: '#070709' };
    canvas.width = 10;
    canvas.height = 10;
    ctx.drawImage(imgEl, 0, 0, 10, 10);
    const imgData = ctx.getImageData(0, 0, 10, 10).data;
    
    // Average top half and bottom half to get distinct deep colors
    let r1 = 0, g1 = 0, b1 = 0;
    let r2 = 0, g2 = 0, b2 = 0;
    for (let i = 0; i < 50; i++) {
      r1 += imgData[i * 4];
      g1 += imgData[i * 4 + 1];
      b1 += imgData[i * 4 + 2];
    }
    for (let i = 50; i < 100; i++) {
      r2 += imgData[i * 4];
      g2 += imgData[i * 4 + 1];
      b2 += imgData[i * 4 + 2];
    }
    r1 = Math.floor(r1 / 50); g1 = Math.floor(g1 / 50); b1 = Math.floor(b1 / 50);
    r2 = Math.floor(r2 / 50); g2 = Math.floor(g2 / 50); b2 = Math.floor(b2 / 50);
    
    // Dim the color value to keep text perfectly contrastive
    return {
      rgb1: `rgb(${Math.floor(r1 * 0.4)}, ${Math.floor(g1 * 0.2)}, ${Math.floor(b1 * 0.5)})`,
      rgb2: `rgb(${Math.floor(r2 * 0.2)}, ${Math.floor(g2 * 0.15)}, ${Math.floor(b2 * 0.2)})`
    };
  } catch (e) {
    return { rgb1: '#180828', rgb2: '#070709' };
  }
}

// Adaptive background dynamic color thief trigger
function updateAdaptiveBackground(coverUrl: string) {
  if (!isAdaptiveBgEnabled) {
    document.body.classList.remove('mesh-gradient-bg');
    document.body.style.removeProperty('--mesh-color-1');
    document.body.style.removeProperty('--mesh-color-2');
    lyricsPanel.classList.remove('mesh-gradient-bg');
    lyricsPanel.style.removeProperty('--mesh-color-1');
    lyricsPanel.style.removeProperty('--mesh-color-2');
    return;
  }

  const tempImg = new Image();
  tempImg.crossOrigin = "Anonymous";
  tempImg.onload = () => {
    const colors = getDominantColors(tempImg);
    document.body.classList.add('mesh-gradient-bg');
    document.body.style.setProperty('--mesh-color-1', colors.rgb1);
    document.body.style.setProperty('--mesh-color-2', colors.rgb2);
    
    // Apply matching glowing gradient to lyrics panel
    lyricsPanel.classList.add('mesh-gradient-bg');
    lyricsPanel.style.setProperty('--mesh-color-1', colors.rgb1);
    lyricsPanel.style.setProperty('--mesh-color-2', colors.rgb2);
  };
  tempImg.src = coverUrl;
}

// Visualizer Wave Drawing Engine (AnalyserNode-driven real wave)
let visualizerCanvas: HTMLCanvasElement | null = null;
let visualizerCtx: CanvasRenderingContext2D | null = null;
let visualizerAnimationId = 0;

function startVisualizer() {
  visualizerCanvas = document.getElementById('lyrics-visualizer') as HTMLCanvasElement;
  if (!visualizerCanvas) return;
  visualizerCtx = visualizerCanvas.getContext('2d');
  
  if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
  drawVisualizer();
}

function drawVisualizer() {
  if (!isVisualizerEnabled || !visualizerCanvas || !visualizerCtx) return;
  
  const width = visualizerCanvas.width = visualizerCanvas.parentElement?.clientWidth || 400;
  const height = visualizerCanvas.height = 80;
  
  visualizerCtx.clearRect(0, 0, width, height);
  
  // Real audio levels query
  let musicAmplitude = 4;
  if (analyser && isPlaying) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const avgVol = bufferLength > 0 ? sum / bufferLength : 0;
    
    // Scale 0-255 average to clean height range (max 35px)
    musicAmplitude = (avgVol / 255.0) * 35.0;
    if (musicAmplitude < 4) musicAmplitude = 4; // Flat base
  }
  
  const time = Date.now() * 0.003;
  const amplitude = musicAmplitude * visualizerBassFactor;
  
  // Wave 1: Spotify Green
  visualizerCtx.strokeStyle = 'rgba(30, 215, 96, 0.5)';
  visualizerCtx.lineWidth = 3;
  visualizerCtx.beginPath();
  for (let x = 0; x < width; x++) {
    const y = height / 2 + Math.sin(x * 0.01 + time) * amplitude;
    if (x === 0) visualizerCtx.moveTo(x, y);
    else visualizerCtx.lineTo(x, y);
  }
  visualizerCtx.stroke();
  
  // Wave 2: Subdued White Ripple
  visualizerCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  visualizerCtx.lineWidth = 1.5;
  visualizerCtx.beginPath();
  for (let x = 0; x < width; x++) {
    const y = height / 2 + Math.sin(x * 0.018 - time * 1.2) * (amplitude * 0.6);
    if (x === 0) visualizerCtx.moveTo(x, y);
    else visualizerCtx.lineTo(x, y);
  }
  visualizerCtx.stroke();
  
  visualizerAnimationId = requestAnimationFrame(drawVisualizer);
}

// Equalizer AudioContext State
let audioCtx: AudioContext | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;
let eqFilters: BiquadFilterNode[] = [];
let analyser: AnalyserNode | null = null;

function connectEqualizerToYoutubePlayer() {
  try {
    const iframe = document.querySelector('iframe');
    if (!iframe) return;
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.log('Cannot access YouTube iframe document (CORS/Loading).');
      return;
    }

    const videoEl = iframeDoc.querySelector('video');
    if (!videoEl) {
      console.log('No video element found inside YouTube iframe yet.');
      return;
    }

    if (!audioCtx) {
      console.log('Hooking Web Audio Equalizer up to iframe video player element...');
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioSource = audioCtx.createMediaElementSource(videoEl);
      
      const frequencies = [60, 230, 910, 4000, 14000];
      let lastNode: AudioNode = audioSource;

      eqFilters = [];

      frequencies.forEach((freq, index) => {
        const filter = audioCtx!.createBiquadFilter();
        if (index === 0) {
          filter.type = 'lowshelf';
        } else if (index === frequencies.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
        }
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        
        // Read current slider values from page elements
        const sliders = document.querySelectorAll('.eq-slider') as NodeListOf<HTMLInputElement>;
        filter.gain.value = sliders[index] ? Number(sliders[index].value) : 0;

        lastNode.connect(filter);
        eqFilters.push(filter);
        lastNode = filter;
      });

      // Initialize real-time wave analyzer node
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;

      lastNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      console.log('Equalizer & Analyser connected and routing audio correctly.');
    }
  } catch (err) {
    console.error('Error connecting Equalizer to YouTube video frame:', err);
  }
}

function setEqBandGain(bandIndex: number, gainDb: number) {
  if (eqFilters[bandIndex]) {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    eqFilters[bandIndex].gain.setValueAtTime(gainDb, audioCtx!.currentTime);
  }
}

// Initialize YouTube Player API
function initYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag && firstScriptTag.parentNode) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new window.YT.Player('yt-player', {
      height: '0',
      width: '0',
      videoId: '',
      playerVars: {
        'playsinline': 1,
        'controls': 0,
        'disablekb': 1
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
  };
}

function onPlayerReady() {
  console.log('YouTube IFrame Player ready.');
  const vol = Number(volumeBar.value);
  ytPlayer.setVolume(vol);
}

function onPlayerStateChange(event: any) {
  const state = event.data;
  if (state === 1) { // PLAYING
    isPlaying = true;
    updatePlayButtonUI();
    startProgressTimer();
    
    // Attempt connecting EQ node with a small delay to ensure video node mounts
    setTimeout(connectEqualizerToYoutubePlayer, 600);
  } else if (state === 2 || state === -1 || state === 3) { // PAUSED, UNSTARTED, BUFFERING
    isPlaying = false;
    updatePlayButtonUI();
    stopProgressTimer();
  } else if (state === 0) { // ENDED
    isPlaying = false;
    updatePlayButtonUI();
    stopProgressTimer();
    playNext();
  }
}

// Progress Timer sync
function startProgressTimer() {
  stopProgressTimer();
  progressInterval = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
    
    const curTime = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration() || currentQueue[currentQueueIndex]?.duration || 0;
    
    currentTimeLabel.textContent = formatTime(curTime);
    if (duration > 0) {
      progressBar.max = duration.toString();
      progressBar.value = curTime.toString();
      totalTimeLabel.textContent = formatTime(duration);
      updateSliderFill(progressBar);
    }

    // Dynamic Lyrics Tracker scroll
    updateActiveLyricsLine(curTime);
  }, 250);
}

// History navigation handler
function triggerHistoryNavigation(view: string) {
  homeView.classList.add('hidden');
  searchView.classList.add('hidden');
  playlistView.classList.add('hidden');
  settingsView.classList.add('hidden');

  navHomeLink.classList.remove('active');
  navSearchLink.classList.remove('active');
  navPlaylistsLink.classList.remove('active');
  navSettingsLink.classList.remove('active');

  if (view === 'home') {
    homeView.classList.remove('hidden');
    navHomeLink.classList.add('active');
    renderHomeView(); // Refresh dynamic recommendations
  } else if (view === 'search') {
    searchView.classList.remove('hidden');
    navSearchLink.classList.add('active');
  } else if (view === 'settings') {
    settingsView.classList.remove('hidden');
    navSettingsLink.classList.add('active');
  } else if (view.startsWith('playlist-')) {
    playlistView.classList.remove('hidden');
    navPlaylistsLink.classList.add('active');
    const plId = Number(view.replace('playlist-', ''));
    loadPlaylist(plId, false);
  }
}

function navigateToView(view: string) {
  viewHistory = viewHistory.slice(0, historyIndex + 1);
  if (viewHistory[viewHistory.length - 1] !== view) {
    viewHistory.push(view);
    historyIndex = viewHistory.length - 1;
  }
  triggerHistoryNavigation(view);
}

// Save Listening history
function saveToHistory(track: Track) {
  if (!track || track.id === 'playlist-mix') return;

  let history: Track[] = [];
  try {
    history = JSON.parse(localStorage.getItem(`waisify_history_${userId}`) || '[]');
  } catch (e) {}

  history = history.filter(t => !(t.title === track.title && t.artist === track.artist));
  history.unshift(track);
  history = history.slice(0, 50);
  localStorage.setItem(`waisify_history_${userId}`, JSON.stringify(history));

  let stats: Record<string, number> = {};
  try {
    stats = JSON.parse(localStorage.getItem(`waisify_stats_${userId}`) || '{}');
  } catch (e) {}

  stats[track.artist] = (stats[track.artist] || 0) + 1;
  localStorage.setItem(`waisify_stats_${userId}`, JSON.stringify(stats));

  renderHomeView();
}

// Smart Genre-based Recommendations
const GENRE_MAPS = {
  phonk: {
    heroTitle: "Especial de Phonk",
    heroDesc: "Bajos distorsionados y drift brasileño a todo volumen.",
    cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800",
    shortcuts: [
      { title: 'Brazilian Phonk BR', query: 'Brazilian Phonk', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=150' },
      { title: 'PHONK MANIA', query: 'Kordhell Phonk Hits', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=150' },
      { title: 'Drift Phonk Classics', query: 'DVRST Phonk Mix', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=150' },
      { title: 'Cyberpunk Drift', query: 'Phonk Cyberpunk Beat', img: 'https://images.unsplash.com/photo-1487180142328-0c4e37023af5?q=80&w=150' }
    ],
    carousel: [
      { name: 'Kordhell', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=200' },
      { name: 'DVRST', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=200' },
      { name: 'Brazilian Phonk', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200' },
      { name: 'Phonk Nation', img: 'https://images.unsplash.com/photo-1487180142328-0c4e37023af5?q=80&w=200' }
    ]
  },
  urban: {
    heroTitle: "Mix Urbano Latino",
    heroDesc: "Las mejores sesiones, trap argentino y reggaetón del momento.",
    cover: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Milo_J_%28cropped%29.jpg/960px-Milo_J_%28cropped%29.jpg",
    shortcuts: [
      { title: 'Milo J Mix', query: 'Milo J éxitos', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Milo_J_%28cropped%29.jpg/960px-Milo_J_%28cropped%29.jpg' },
      { title: 'Trueno Hits', query: 'Trueno hits', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Trueno_%28Repero%29_2021.jpg/960px-Trueno_%28Repero%29_2021.jpg' },
      { title: 'Bizarrap Music Sessions', query: 'Bizarrap sessions', img: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/2023-11-16_Gala_de_los_Latin_Grammy%2C_04_%28cropped%29_%282%29.jpg' },
      { title: 'Duki Trap Classics', query: 'Duki éxitos mix', img: 'https://upload.wikimedia.org/wikipedia/commons/d/da/El_Duki.png' }
    ],
    carousel: [
      { name: 'Milo J', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Milo_J_%28cropped%29.jpg/960px-Milo_J_%28cropped%29.jpg' },
      { name: 'Trueno', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Trueno_%28Repero%29_2021.jpg/960px-Trueno_%28Repero%29_2021.jpg' },
      { name: 'Bizarrap', img: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/2023-11-16_Gala_de_los_Latin_Grammy%2C_04_%28cropped%29_%282%29.jpg' },
      { name: 'Duki', img: 'https://upload.wikimedia.org/wikipedia/commons/d/da/El_Duki.png' }
    ]
  },
  dance: {
    heroTitle: "Festival Dance Anthems",
    heroDesc: "EDM festivalero, techno melódico y house ibicenco.",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800",
    shortcuts: [
      { title: 'David Guetta Live Ushuaia', query: 'David Guetta Live Ushuaia Ibiza 2026', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=150' },
      { title: 'Martin Garrix Best Of', query: 'Martin Garrix Hits', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=150' },
      { title: 'Tiësto EDM Clubbing', query: 'Tiesto club mix', img: 'https://images.unsplash.com/photo-1487180142328-0c4e37023af5?q=80&w=150' },
      { title: 'Tomorrowland Mix', query: 'EDM Tomorrowland hits', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=150' }
    ],
    carousel: [
      { name: 'David Guetta', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200' },
      { name: 'Martin Garrix', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=200' },
      { name: 'Tiësto', img: 'https://images.unsplash.com/photo-1487180142328-0c4e37023af5?q=80&w=200' },
      { name: 'Calvin Harris', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=200' }
    ]
  },
  pop: {
    heroTitle: "Pop Essentials",
    heroDesc: "Las mejores baladas, pop melódico y éxitos internacionales.",
    cover: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800",
    shortcuts: [
      { title: 'Gracie Abrams Selected', query: 'Gracie Abrams The Secret of Us', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150' },
      { title: 'Taylor Swift Eras Tour Mix', query: 'Taylor Swift hits', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150' },
      { title: 'Olivia Rodrigo Guts/Sour', query: 'Olivia Rodrigo mix', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150' },
      { title: 'Billie Eilish Hits', query: 'Billie Eilish hits', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150' }
    ],
    carousel: [
      { name: 'Gracie Abrams', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200' },
      { name: 'Taylor Swift', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200' },
      { name: 'Olivia Rodrigo', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200' },
      { name: 'Billie Eilish', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200' }
    ]
  }
};

// Render dynamic Home page based on Listening History and Genre mapping
function renderHomeView() {
  let history: Track[] = [];
  let stats: Record<string, number> = {};
  try {
    history = JSON.parse(localStorage.getItem(`waisify_history_${userId}`) || '[]');
    stats = JSON.parse(localStorage.getItem(`waisify_stats_${userId}`) || '{}');
  } catch (e) {}

  const shortcutsGrid = document.getElementById('home-shortcuts-grid') as HTMLDivElement;
  const artistsCarousel = document.getElementById('home-artists-carousel') as HTMLDivElement;
  const heroBanner = document.getElementById('home-hero-banner') as HTMLDivElement;

  if (!shortcutsGrid || !artistsCarousel || !heroBanner) return;

  // Determine user taste genre by scanning history
  let genreTaste: 'urban' | 'dance' | 'phonk' | 'pop' = 'urban'; // Default fallback
  let phonkScore = 0;
  let urbanScore = 0;
  let danceScore = 0;
  let popScore = 0;

  history.forEach(t => {
    const text = (t.title + ' ' + t.artist).toLowerCase();
    if (text.includes('phonk') || text.includes('drift') || text.includes('kordhell') || text.includes('dvrst') || text.includes('br')) {
      phonkScore++;
    } else if (text.includes('guetta') || text.includes('garrix') || text.includes('tiesto') || text.includes('dance') || text.includes('edm') || text.includes('remix')) {
      danceScore++;
    } else if (text.includes('abrams') || text.includes('swift') || text.includes('pop') || text.includes('rodrigo') || text.includes('eilish')) {
      popScore++;
    } else {
      urbanScore++; // Default bucket
    }
  });

  const maxScore = Math.max(phonkScore, urbanScore, danceScore, popScore);
  if (maxScore > 0) {
    if (maxScore === phonkScore) genreTaste = 'phonk';
    else if (maxScore === danceScore) genreTaste = 'dance';
    else if (maxScore === popScore) genreTaste = 'pop';
    else genreTaste = 'urban';
  }

  // Load appropriate dynamic layout config matching user's taste
  const config = GENRE_MAPS[genreTaste];

  // 1. HERO BANNER
  if (history.length > 0) {
    const lastPlayed = history[0];
    heroBanner.innerHTML = `
      <div class="hero-left">
        <span class="hero-badge">RECOMENDADO SEGÚN TU GUSTO</span>
        <h1 class="hero-title">${config.heroTitle}</h1>
        <p class="hero-artist">${config.heroDesc} Basado en tu última pista: <strong>${lastPlayed.title}</strong></p>
        <div class="hero-buttons">
          <button id="hero-play-btn" class="btn-spotify-play">Escuchar ahora</button>
          <button id="hero-save-btn" class="btn-spotify-outline">Caché Offline</button>
        </div>
      </div>
      <div class="hero-right">
        <img src="${lastPlayed.thumbnail || config.cover}" class="hero-img" alt="Featured Cover">
      </div>
    `;

    document.getElementById('hero-play-btn')?.addEventListener('click', () => {
      playByQuery(config.heroTitle + ' hits');
    });
    document.getElementById('hero-save-btn')?.addEventListener('click', () => {
      showToast('Guardado en la biblioteca local');
    });
  } else {
    // Default fallback hero (Gracie Abrams)
    heroBanner.innerHTML = `
      <div class="hero-left">
        <span class="hero-badge">RECOMENDADO</span>
        <h1 class="hero-title">The Secret of Us</h1>
        <p class="hero-artist">Gracie Abrams &bull; Escúchalo ahora</p>
        <div class="hero-buttons">
          <button id="hero-play-btn" class="btn-spotify-play">Escuchar ahora</button>
          <button id="hero-save-btn" class="btn-spotify-outline">Guardar</button>
        </div>
      </div>
      <div class="hero-right">
        <img src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800&auto=format&fit=crop" class="hero-img" alt="Featured Album Cover">
      </div>
    `;
    document.getElementById('hero-play-btn')?.addEventListener('click', () => {
      playByQuery('Gracie Abrams The Secret of Us');
    });
    document.getElementById('hero-save-btn')?.addEventListener('click', () => {
      showToast('Álbum guardado en tu biblioteca');
    });
  }

  // 2. SHORTCUTS GRID
  shortcutsGrid.innerHTML = '';
  let cardItems: { title: string; query: string; img: string }[] = [];

  config.shortcuts.forEach(item => cardItems.push(item));

  history.slice(0, 4).forEach(track => {
    cardItems.push({
      title: track.title,
      query: `${track.title} ${track.artist}`,
      img: track.thumbnail
    });
  });

  cardItems = cardItems.slice(0, 8);

  cardItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'shortcut-card';
    card.innerHTML = `
      <img src="${item.img}" alt="Cover">
      <span class="shortcut-title">${item.title}</span>
      <button class="shortcut-play-btn" title="Reproducir">
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
      </button>
    `;

    card.querySelector('.shortcut-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      playByQuery(item.query);
    });

    card.addEventListener('click', () => {
      playByQuery(item.query);
    });

    shortcutsGrid.appendChild(card);
  });

  // 3. ARTISTS CAROUSEL
  artistsCarousel.innerHTML = '';
  config.carousel.forEach(artist => {
    const card = document.createElement('div');
    card.className = 'artist-circle-card';
    card.innerHTML = `
      <div class="avatar-wrap">
        <img src="${artist.img}" alt="${artist.name}">
        <button class="carousel-play-btn" title="Reproducir">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <span class="artist-card-name">${artist.name} Radio</span>
    `;

    card.querySelector('.carousel-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      playByQuery(`${artist.name} Radio`);
    });

    card.addEventListener('click', () => {
      playByQuery(`${artist.name} Radio`);
    });

    artistsCarousel.appendChild(card);
  });
}

// Synced lyrics checker: update active line scrolling highlight
function updateActiveLyricsLine(currentTime: number) {
  if (lyricsLines.length === 0) return;
  
  // Apply manual sync adjustment offset
  const adjustedTime = currentTime + lyricsSyncOffset;
  
  let activeIndex = -1;
  for (let i = 0; i < lyricsLines.length; i++) {
    if (adjustedTime >= lyricsLines[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }
  
  if (activeIndex !== -1) {
    const linesElements = document.querySelectorAll('.lyrics-line');
    linesElements.forEach((el, index) => {
      if (index === activeIndex) {
        if (!el.classList.contains('active')) {
          el.classList.add('active');
          // Smooth scroll to the center of container viewport
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        el.classList.remove('active');
      }
    });
  }
}

// Parse LRC synced lyrics text: e.g. "[00:12.34] Hello World"
function parseSyncedLyrics(lrcText: string): SyncedLine[] {
  const lines = lrcText.split('\n');
  const result: SyncedLine[] = [];
  
  // Detect global offset: [offset:500] (milliseconds to add/subtract)
  let globalOffset = 0;
  const offsetMatch = /\[offset:\s*([-+]?\d+)\s*\]/i.exec(lrcText);
  if (offsetMatch) {
    globalOffset = parseInt(offsetMatch[1]) / 1000; // convert to seconds
  }
  
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/;
  
  lines.forEach(line => {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const msStr = match[3] || '';
      const ms = msStr ? parseInt(msStr) : 0;
      
      const decimalOffset = msStr ? (ms / Math.pow(10, msStr.length)) : 0;
      const timeInSec = min * 60 + sec + decimalOffset + globalOffset;
      
      const text = line.replace(timeRegex, '').trim();
      // Filter out meta tags or empty strings
      if (text && !text.startsWith('[al:') && !text.startsWith('[ar:') && !text.startsWith('[ti:')) {
        result.push({ time: timeInSec, text });
      }
    }
  });
  
  return result.sort((a, b) => a.time - b.time);
}

// Fetch with strict Timeout helper to prevent hanging requests
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Fetch official YouTube subtitles / closed captions track directly
async function fetchYouTubeSubtitles(videoId: string): Promise<SyncedLine[] | null> {
  try {
    // 1. List available languages
    const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
    const listRes = await fetchWithTimeout(listUrl, {}, 2500);
    if (!listRes.ok) return null;
    const xmlText = await listRes.text();
    
    // Parse lang_code properties from XML
    const langCodes: string[] = [];
    const matches = xmlText.matchAll(/lang_code="([^"]+)"/g);
    for (const match of matches) {
      langCodes.push(match[1]);
    }
    
    if (langCodes.length === 0) {
      console.log('[Lyrics System] No subtitles found on YouTube for video:', videoId);
      return null;
    }
    
    // Prioritize Spanish, then English, then whatever is first
    let selectedLang = langCodes.find(c => c.toLowerCase() === 'es') 
      || langCodes.find(c => c.toLowerCase().startsWith('es'))
      || langCodes.find(c => c.toLowerCase() === 'en')
      || langCodes.find(c => c.toLowerCase().startsWith('en'))
      || langCodes[0];
      
    console.log(`[Lyrics System] Loading YouTube subtitles for lang: "${selectedLang}"`);
    
    // 2. Fetch subtitle JSON3
    const subUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${selectedLang}&fmt=json3`;
    const subRes = await fetchWithTimeout(subUrl, {}, 2500);
    if (!subRes.ok) return null;
    const subData = await subRes.json();
    
    if (subData && Array.isArray(subData.events)) {
      const parsed: SyncedLine[] = [];
      subData.events.forEach((evt: any) => {
        if (evt.segs && Array.isArray(evt.segs)) {
          const text = evt.segs.map((s: any) => s.utf8).join('').trim();
          // Filter out music notations or brackets
          if (text && text !== '♪' && text !== '[[Música]]') {
            const time = (evt.tStartMs || 0) / 1000;
            parsed.push({ time, text });
          }
        }
      });
      
      if (parsed.length > 0) {
        console.log(`[Lyrics System] Successfully parsed ${parsed.length} lines of YouTube captions.`);
        return parsed.sort((a, b) => a.time - b.time);
      }
    }
    return null;
  } catch (err) {
    console.error('[Lyrics System] Error fetching YouTube timed text:', err);
    return null;
  }
}

// Fetch Lyrics dynamically using optimized search queries and official subtitles
async function fetchLyrics(artist: string, title: string) {
  const currentTrack = currentQueue[currentQueueIndex];
  if (!currentTrack) return;

  // Clean Topic channel suffix from artist name
  const cleanArtist = artist.replace(/-\s*Topic/gi, '').replace(/Topic/gi, '').trim();

  // Grab active YouTube video ID
  let videoId = currentTrack.youtubeId;
  if (!videoId) {
    const activeIframe = document.querySelector('iframe');
    const match = activeIframe?.src.match(/\/embed\/([^?]+)/);
    if (match) {
      videoId = match[1];
    }
  }

  const requestTrackKey = `${cleanArtist} - ${title}`;
  currentLyricsTrackId = requestTrackKey;

  // Reset sync adjustments on new track fetch
  lyricsSyncOffset = 0;
  if (lyricsSyncOffsetLabel) lyricsSyncOffsetLabel.textContent = '0.0s';
  if (lyricsSyncControls) lyricsSyncControls.style.display = 'none';

  lyricsText.textContent = 'Buscando letra...';
  lyricsLines = [];
  isSyncedLyrics = false;

  let loaded = false;

  // Try 1: YouTube official subtitles track (Exact match, zero offset delay)
  if (videoId) {
    console.log(`[Lyrics System] Attempting YouTube Subtitles for Video ID: ${videoId}`);
    const ytLines = await fetchYouTubeSubtitles(videoId);
    if (currentLyricsTrackId !== requestTrackKey) return;
    
    if (ytLines && ytLines.length > 0) {
      lyricsLines = ytLines;
      isSyncedLyrics = true;
      renderLyricsLines(lyricsLines);
      loaded = true;
      console.log('[Lyrics System] Lyrics loaded successfully from YouTube captions.');
    }
  }

  // Try 2: LRCLIB search fallback (if YT captions aren't available)
  if (!loaded) {
    console.log('[Lyrics System] YouTube captions unavailable. Falling back to LRCLIB Search...');
    
    // Clean helper
    const cleanStr = (s: string) => s
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/official video/gi, '')
      .replace(/video oficial/gi, '')
      .replace(/lyrics/gi, '')
      .replace(/letra/gi, '')
      .replace(/hd/gi, '')
      .replace(/4k/gi, '')
      .replace(/&/g, '')
      .replace(/,/g, '')
      .replace(/feat\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    let cleanArtist = cleanStr(artist);
    let cleanTitle = cleanStr(title);

    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      const part1 = cleanStr(parts[0]);
      const part2 = cleanStr(parts[1]);

      if (part1.toLowerCase().includes(artist.toLowerCase()) || artist.toLowerCase().includes(part1.toLowerCase())) {
        cleanTitle = part2;
        cleanArtist = part1;
      } else {
        cleanTitle = part1;
        cleanArtist = part2;
      }
    }

    const query = `${cleanArtist} ${cleanTitle}`.trim();
    
    try {
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const response = await fetchWithTimeout(url, {}, 2500);
      
      if (currentLyricsTrackId === requestTrackKey && response.ok) {
        const results = await response.json();
        if (currentLyricsTrackId === requestTrackKey && Array.isArray(results) && results.length > 0) {
          const lyricResults = results.filter(r => r.syncedLyrics || r.plainLyrics);
          if (lyricResults.length > 0) {
            // Find target duration
            const ytDuration = ytPlayer && typeof ytPlayer.getDuration === 'function' 
              ? ytPlayer.getDuration() 
              : (currentQueue[currentQueueIndex]?.duration || 0);

            lyricResults.sort((a, b) => {
              const diffA = Math.abs((a.duration || 0) - ytDuration);
              const diffB = Math.abs((b.duration || 0) - ytDuration);
              return diffA - diffB;
            });

            const match = lyricResults[0];
            if (match.syncedLyrics) {
              lyricsLines = parseSyncedLyrics(match.syncedLyrics);
              if (lyricsLines.length > 0) {
                isSyncedLyrics = true;
                renderLyricsLines(lyricsLines);
                loaded = true;
              }
            } else if (match.plainLyrics) {
              const lines = match.plainLyrics.split('\n');
              renderPlainLyrics(lines);
              loaded = true;
            }
          }
        }
      }
    } catch (err) {
      console.error('[Lyrics System] LRCLIB fallback search failed:', err);
    }
  }

  if (currentLyricsTrackId !== requestTrackKey) return;

  // Try 3: api.lyrics.ovh fallback (Plain) - Timeout 2s
  if (!loaded) {
    const cleanStr = (s: string) => s
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/official video/gi, '')
      .replace(/video oficial/gi, '')
      .replace(/lyrics/gi, '')
      .replace(/letra/gi, '')
      .replace(/hd/gi, '')
      .replace(/4k/gi, '')
      .replace(/&/g, '')
      .replace(/,/g, '')
      .replace(/feat\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanArtist = cleanStr(artist);
    const cleanTitle = cleanStr(title);
    
    try {
      console.log(`[Lyrics System] Falling back to api.lyrics.ovh for: "${cleanArtist}" - "${cleanTitle}"`);
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
      const response = await fetchWithTimeout(url, {}, 2000);
      
      if (currentLyricsTrackId === requestTrackKey && response.ok) {
        const data = await response.json();
        if (currentLyricsTrackId === requestTrackKey && data.lyrics) {
          const lines = data.lyrics.split('\n');
          renderPlainLyrics(lines);
          loaded = true;
          console.log('[Lyrics System] Plain lyrics fallback loaded successfully.');
        }
      }
    } catch (err) {
      console.error('[Lyrics System] Fallback lyrics fetch failed or timed out:', err);
    }
  }

  if (currentLyricsTrackId !== requestTrackKey) return;

  // Final placeholder if all failed
  if (!loaded) {
    lyricsText.innerHTML = `
      <div class="lyrics-line active">[Letra Instrumental / No disponible en red]</div>
      <div class="lyrics-line">Reproduciendo "${title}" de ${artist}</div>
      <div class="lyrics-line">Disfruta de la música en Waisify</div>
    `;
  }

  // Toggle sync controls depending on state
  if (isSyncedLyrics) {
    if (lyricsSyncControls) lyricsSyncControls.style.display = 'flex';
  } else {
    if (lyricsSyncControls) lyricsSyncControls.style.display = 'none';
  }
}

function renderLyricsLines(lines: SyncedLine[]) {
  lyricsText.innerHTML = lines.map((line) => {
    return `<div class="lyrics-line" data-time="${line.time}">${line.text}</div>`;
  }).join('');
  
  // Bind click-to-seek action
  document.querySelectorAll('.lyrics-line').forEach(el => {
    el.addEventListener('click', () => {
      const seekTime = Number(el.getAttribute('data-time'));
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(seekTime, true);
        updateActiveLyricsLine(seekTime);
      }
    });
  });

  // Sync scroll positions immediately to current playback time on finish load
  if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
    const curTime = ytPlayer.getCurrentTime() || 0;
    updateActiveLyricsLine(curTime);
  }
}

function renderPlainLyrics(lines: string[]) {
  lyricsLines = []; // Keep empty so updateActiveLyricsLine does nothing
  isSyncedLyrics = false;
  
  lyricsText.innerHTML = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    return `<div class="lyrics-line-static">${trimmed}</div>`;
  }).join('');
}

// YouTube playlist metadata extractor
async function importYouTubePlaylist(playlistId: string): Promise<{ name: string; tracks: Track[] }> {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const response = await fetchWithTimeout(url, {}, 5000);
  if (!response.ok) throw new Error('No se pudo acceder a la playlist de YouTube. Asegúrate de que sea pública y que el ID sea correcto.');
  const xmlText = await response.text();
  
  // Extract playlist name: <title>(.*)</title> before <entry>
  let playlistName = 'Imported YouTube Playlist';
  const feedTitleMatch = xmlText.match(/<feed[^>]*>[\s\S]*?<title>([^<]+)<\/title>/i);
  if (feedTitleMatch) {
    playlistName = feedTitleMatch[1];
  }

  const tracks: Track[] = [];
  // Parse <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;
  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    const entryXml = entryMatch[1];
    
    const idMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i) 
                 || entryXml.match(/<id>yt:video:([^<]+)<\/id>/i);
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/i);
    const authorMatch = entryXml.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/i);
    
    if (idMatch && titleMatch) {
      const videoId = idMatch[1].trim();
      const title = titleMatch[1].trim();
      const artist = authorMatch ? authorMatch[1].trim() : 'Artista Desconocido';
      const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      
      tracks.push({
        id: videoId,
        title,
        artist,
        duration: 180, // default placeholder
        thumbnail,
        youtubeId: videoId
      });
    }
  }
  
  if (tracks.length === 0) {
    throw new Error('No se encontraron canciones en el canal RSS de la playlist de YouTube. ¿Es pública?');
  }
  
  return { name: playlistName, tracks };
}

// Spotify playlist metadata extractor
async function importSpotifyPlaylist(playlistId: string): Promise<{ name: string; tracks: Track[] }> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const response = await fetchWithTimeout(url, {}, 5000);
  if (!response.ok) throw new Error('No se pudo acceder a la playlist de Spotify. Asegúrate de que sea pública.');
  const html = await response.text();

  const match = html.match(/<script\s+id="resource"\s+type="application\/json">([^<]+)<\/script>/)
             || html.match(/<script\s+id="session"\s+type="application\/json">([^<]+)<\/script>/);
  if (!match) throw new Error('No se pudieron extraer los metadatos de la playlist de Spotify.');

  const data = JSON.parse(match[1]);
  
  let playlistName = 'Imported Spotify Playlist';
  const tracks: Track[] = [];
  
  try {
    playlistName = data.name || playlistName;
    const items = data.tracks?.items || [];
    items.forEach((item: any) => {
      const track = item.track;
      if (track) {
        const title = track.name;
        const artist = track.artists?.map((a: any) => a.name).join(', ') || 'Artista Desconocido';
        const duration = Math.floor((track.duration_ms || 180000) / 1000);
        const thumbnail = track.album?.images?.[0]?.url || '';
        
        tracks.push({
          id: track.id,
          title,
          artist,
          duration,
          thumbnail
        });
      }
    });
  } catch (e) {
    console.error('Error parsing Spotify embed contents:', e);
    throw new Error('Error al analizar los metadatos de la playlist de Spotify.');
  }

  return { name: playlistName, tracks };
}

function init() {
  initYouTubeAPI();

  // Wire titlebar window controls
  minBtn.addEventListener('click', () => window.waisifyAPI.minimize());
  maxBtn.addEventListener('click', () => window.waisifyAPI.maximize());
  closeBtn.addEventListener('click', () => window.waisifyAPI.close());

  // Listen to Global Media Keys
  window.waisifyAPI.onGlobalMediaCommand((command) => {
    if (command === 'play-pause') {
      togglePlay();
    } else if (command === 'next') {
      playNext();
    } else if (command === 'prev') {
      playPrev();
    }
  });

  // History Arrow Buttons
  navBackBtn.addEventListener('click', () => {
    if (historyIndex > 0) {
      historyIndex--;
      triggerHistoryNavigation(viewHistory[historyIndex]);
    }
  });

  navForwardBtn.addEventListener('click', () => {
    if (historyIndex < viewHistory.length - 1) {
      historyIndex++;
      triggerHistoryNavigation(viewHistory[historyIndex]);
    }
  });

  // Check auth state
  if (token) {
    showApp();
  } else {
    showLogin();
  }

  // Setup Form switching
  let isRegisterMode = false;
  authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    authErrorMsg.classList.add('hidden');
    if (isRegisterMode) {
      authTitle.textContent = 'Registrarse en Waisify';
      authSubmitBtn.textContent = 'Crear Cuenta';
      authSwitchText.textContent = '¿Ya tienes cuenta?';
      authSwitchLink.textContent = 'Inicia sesión';
    } else {
      authTitle.textContent = 'Iniciar Sesión en Waisify';
      authSubmitBtn.textContent = 'Entrar';
      authSwitchText.textContent = '¿No tienes cuenta?';
      authSwitchLink.textContent = 'Regístrate gratis';
    }
  });

  // Setup Auth Submission
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = authUsername.value.trim();
    const pass = authPassword.value;
    
    authErrorMsg.classList.add('hidden');
    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error en el servidor');
      }
      
      token = data.token;
      username = data.username;
      userId = data.userId;
      localStorage.setItem('waisify_token', token);
      localStorage.setItem('waisify_username', username);
      localStorage.setItem('waisify_userid', userId);
      
      showApp();
    } catch (err: any) {
      authErrorMsg.textContent = err.message;
      authErrorMsg.classList.remove('hidden');
    }
  });

  // Logout actions
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('waisify_token');
    localStorage.removeItem('waisify_username');
    localStorage.removeItem('waisify_userid');
    token = '';
    username = '';
    userId = '';
    
    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
      ytPlayer.stopVideo();
    }
    isPlaying = false;
    stopProgressTimer();
    showLogin();
  });

  // Sidebar navigation switching
  navHomeLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToView('home');
  });

  navSearchLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToView('search');
    globalSearchInput.focus();
  });

  navSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToView('settings');
  });
  
  navPlaylistsLink.addEventListener('click', (e) => {
    e.preventDefault();
    const liked = playlists.find(p => p.name === LIKED_SONGS_PLAYLIST_NAME);
    if (liked) {
      navigateToView(`playlist-${liked.id}`);
    } else if (playlists.length > 0) {
      navigateToView(`playlist-${playlists[0].id}`);
    } else {
      navigateToView('search');
    }
  });

  // Category Pills filters
  document.querySelectorAll('.category-pills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.category-pills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      showToast(`Filtrado por: ${pill.textContent}`);
    });
  });

  // Create Playlist
  createPlaylistBtn.addEventListener('click', () => {
    newPlaylistNameInput.value = '';
    playlistModal.classList.remove('hidden');
    newPlaylistNameInput.focus();
  });

  modalCancelBtn.addEventListener('click', () => {
    playlistModal.classList.add('hidden');
  });

  async function submitNewPlaylist() {
    const name = newPlaylistNameInput.value.trim();
    if (!name) return;

    playlistModal.classList.add('hidden');

    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) throw new Error('Error al crear lista');
      
      const newPlaylist = await response.json();
      playlists.push(newPlaylist);
      renderSidebarPlaylists();
      navigateToView(`playlist-${newPlaylist.id}`);
      showToast(`Lista "${newPlaylist.name}" creada con éxito`);
    } catch (err) {
      console.error(err);
      showToast('Error creando la lista de reproducción', 'info');
    }
  }

  modalSubmitBtn.addEventListener('click', submitNewPlaylist);
  newPlaylistNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitNewPlaylist();
  });

  // Import Playlist Modal setup
  importPlaylistBtn.addEventListener('click', () => {
    importPlaylistUrl.value = '';
    importProgressContainer.classList.add('hidden');
    importModal.classList.remove('hidden');
    importPlaylistUrl.focus();
  });

  importCancelBtn.addEventListener('click', () => {
    importModal.classList.add('hidden');
  });

  async function startPlaylistImport() {
    const url = importPlaylistUrl.value.trim();
    if (!url) return;

    // Show progress bar
    importProgressContainer.classList.remove('hidden');
    importStatusText.textContent = 'Analizando enlace...';
    importProgressBarFill.style.width = '0%';
    importProgressPercent.textContent = '0%';

    try {
      let result: { name: string; tracks: Track[] };
      
      const spotifyMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
      const youtubeMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);

      if (spotifyMatch) {
        importStatusText.textContent = 'Obteniendo canciones de Spotify...';
        result = await importSpotifyPlaylist(spotifyMatch[1]);
      } else if (youtubeMatch) {
        importStatusText.textContent = 'Obteniendo canciones de YouTube...';
        result = await importYouTubePlaylist(youtubeMatch[1]);
      } else {
        throw new Error('Formato de enlace no reconocido. Debe ser una playlist de Spotify o YouTube.');
      }

      if (!result.tracks || result.tracks.length === 0) {
        throw new Error('La playlist no contiene ninguna canción o es privada.');
      }

      importStatusText.textContent = `Creando "${result.name}"...`;
      // Create new playlist on backend database
      const playlistRes = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: result.name })
      });

      if (!playlistRes.ok) throw new Error('Error al crear la playlist de destino.');
      const newPlaylist = await playlistRes.json();

      // Sequentially add tracks to database
      const total = result.tracks.length;
      for (let i = 0; i < total; i++) {
        const track = result.tracks[i];
        importStatusText.textContent = `Añadiendo (${i + 1}/${total}): ${track.title}`;
        
        await fetch(`${API_BASE_URL}/api/playlists/${newPlaylist.id}/tracks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            thumbnail: track.thumbnail,
            youtubeId: track.youtubeId || ''
          })
        });

        // Update progress bar
        const pct = Math.round(((i + 1) / total) * 100);
        importProgressBarFill.style.width = `${pct}%`;
        importProgressPercent.textContent = `${pct}%`;
      }

      // Success
      playlists.push(newPlaylist);
      renderSidebarPlaylists();
      importModal.classList.add('hidden');
      navigateToView(`playlist-${newPlaylist.id}`);
      showToast(`¡Playlist "${result.name}" importada con éxito!`);
      
    } catch (err: any) {
      console.error(err);
      importProgressContainer.classList.add('hidden');
      alert(`Error al importar: ${err.message}`);
    }
  }

  importSubmitBtn.addEventListener('click', startPlaylistImport);
  importPlaylistUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startPlaylistImport();
  });

  // Delete Playlist
  deletePlaylistBtn.addEventListener('click', async () => {
    if (!currentPlaylistId) return;
    const pl = playlists.find(p => p.id === currentPlaylistId);
    if (pl && pl.name === LIKED_SONGS_PLAYLIST_NAME) {
      showToast('No puedes eliminar la lista de canciones que te gustan', 'info');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar esta lista?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists/${currentPlaylistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error deleting');

      playlists = playlists.filter(p => p.id !== currentPlaylistId);
      renderSidebarPlaylists();
      navigateToView('home');
      showToast('Lista eliminada');
    } catch (err) {
      console.error(err);
      showToast('Error al borrar la lista', 'info');
    }
  });

  // Global Search Input
  let searchTimeout: any;
  globalSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = globalSearchInput.value.trim();
    
    const activeView = viewHistory[historyIndex];
    if (activeView !== 'search' && query !== '') {
      navigateToView('search');
    }

    if (!query) {
      searchResults.innerHTML = '<p class="empty-state">Escribe en el buscador superior para comenzar.</p>';
      return;
    }

    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 500);
  });

  // Playback Control bar items
  playBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', playNext);
  prevBtn.addEventListener('click', playPrev);
  
  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    playlistShuffleBtn.classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Modo aleatorio activado' : 'Modo aleatorio desactivado');
  });

  downloadBtn.addEventListener('click', () => {
    triggerTrackDownload(currentQueue[currentQueueIndex]);
  });

  // Player Like heart button
  playerLikeBtn.addEventListener('click', () => {
    toggleLikedStatus(currentQueue[currentQueueIndex]);
  });

  // Player three dots menu button
  playerMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const track = currentQueue[currentQueueIndex];
    if (!track) return;
    const rect = playerMenuBtn.getBoundingClientRect();
    openFloatingContextMenu(track, rect.left - 180, window.innerHeight - rect.bottom + 40);
  });

  // Lyrics toggle trigger
  playerLyricsBtn.addEventListener('click', () => {
    const isHidden = lyricsPanel.classList.toggle('hidden');
    if (!isHidden) {
      startVisualizer();
      const track = currentQueue[currentQueueIndex];
      if (track) {
        // Clean Topic channel suffix in the lyrics header title
        const cleanArtistName = track.artist.replace(/-\s*Topic/gi, '').replace(/Topic/gi, '').trim();
        lyricsSongTitle.textContent = `${track.title} - ${cleanArtistName}`;
        
        // Prevent redundant parallel fetch requests
        const trackKey = `${cleanArtistName} - ${track.title}`;
        if (currentLyricsTrackId !== trackKey) {
          fetchLyrics(track.artist, track.title);
        }
      } else {
        lyricsSongTitle.textContent = 'Ninguna canción';
        lyricsText.innerHTML = '<div class="lyrics-line active">Reproduce una canción para ver su letra aquí.</div>';
      }
    }
  });

  closeLyricsBtn.addEventListener('click', () => {
    lyricsPanel.classList.add('hidden');
  });

  // Manual lyrics sync adjustments
  lyricsSyncDelay.addEventListener('click', (e) => {
    e.stopPropagation();
    lyricsSyncOffset -= 0.5;
    lyricsSyncOffsetLabel.textContent = `${lyricsSyncOffset > 0 ? '+' : ''}${lyricsSyncOffset.toFixed(1)}s`;
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      updateActiveLyricsLine(ytPlayer.getCurrentTime());
    }
  });

  lyricsSyncAdvance.addEventListener('click', (e) => {
    e.stopPropagation();
    lyricsSyncOffset += 0.5;
    lyricsSyncOffsetLabel.textContent = `${lyricsSyncOffset > 0 ? '+' : ''}${lyricsSyncOffset.toFixed(1)}s`;
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      updateActiveLyricsLine(ytPlayer.getCurrentTime());
    }
  });

  lyricsSyncReset.addEventListener('click', (e) => {
    e.stopPropagation();
    lyricsSyncOffset = 0;
    lyricsSyncOffsetLabel.textContent = '0.0s';
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      updateActiveLyricsLine(ytPlayer.getCurrentTime());
    }
  });

  // Equalizer Slider controls
  const eqPresets = document.querySelectorAll('.eq-presets .pill');
  const eqSliders = document.querySelectorAll('.eq-slider') as NodeListOf<HTMLInputElement>;
  
  eqSliders.forEach((slider, idx) => {
    slider.addEventListener('input', () => {
      const valEl = slider.parentElement?.querySelector('.eq-value');
      if (valEl) valEl.textContent = `${slider.value}dB`;
      updateSliderFill(slider);
      
      // Update BiquadFilter gains dynamically
      setEqBandGain(idx, Number(slider.value));

      // Calculate bass visualizer factor
      const bassVal = Number(eqSliders[0].value);
      visualizerBassFactor = 1.0 + (bassVal / 12.0) * 1.2;
    });
    updateSliderFill(slider);
  });

  eqPresets.forEach((preset) => {
    preset.addEventListener('click', () => {
      eqPresets.forEach(p => p.classList.remove('active'));
      preset.classList.add('active');
      const presetName = preset.getAttribute('data-preset');
      
      let values = [0, 0, 0, 0, 0];
      if (presetName === 'bass') values = [8, 5, 1, 0, -2];
      else if (presetName === 'vocal') values = [-2, 0, 4, 6, 2];
      else if (presetName === 'electronic') values = [6, 3, -1, 4, 3];
      
      eqSliders.forEach((slider, idx) => {
        slider.value = values[idx].toString();
        const valEl = slider.parentElement?.querySelector('.eq-value');
        if (valEl) valEl.textContent = `${values[idx]}dB`;
        updateSliderFill(slider);
        
        // Push preset values directly to audio graph
        setEqBandGain(idx, values[idx]);
      });
      
      const bassVal = values[0];
      visualizerBassFactor = 1.0 + (bassVal / 12.0) * 1.2;
      
      showToast(`Preset de ecualizador cambiado a: ${preset.textContent}`);
    });
  });

  // Interface Settings switches
  const toggleAdaptiveBg = document.getElementById('toggle-adaptive-bg') as HTMLInputElement;
  const toggleVisualizerInput = document.getElementById('toggle-visualizer') as HTMLInputElement;
  const toggleMiniPlayer = document.getElementById('toggle-mini-player') as HTMLInputElement;

  toggleAdaptiveBg.addEventListener('change', () => {
    isAdaptiveBgEnabled = toggleAdaptiveBg.checked;
    const currentTrack = currentQueue[currentQueueIndex];
    if (currentTrack) updateAdaptiveBackground(currentTrack.thumbnail);
    else updateAdaptiveBackground('');
    showToast(isAdaptiveBgEnabled ? 'Fondo adaptativo activado' : 'Fondo adaptativo desactivado');
  });

  toggleVisualizerInput.addEventListener('change', () => {
    isVisualizerEnabled = toggleVisualizerInput.checked;
    showToast(isVisualizerEnabled ? 'Visualizador de ondas activado' : 'Visualizador desactivado');
    if (isVisualizerEnabled) startVisualizer();
  });

  toggleMiniPlayer.addEventListener('change', () => {
    const enabled = toggleMiniPlayer.checked;
    window.waisifyAPI.toggleMiniPlayer(enabled);
    if (enabled) {
      document.body.classList.add('mini-player-mode');
      showToast('Modo Minirreproductor activado');
    } else {
      document.body.classList.remove('mini-player-mode');
      showToast('Modo estándar restaurado');
    }
  });

  // Playlist view play button
  playlistPlayBtn.addEventListener('click', () => {
    const listTracks = Array.from(playlistTracks.querySelectorAll('.track-row'))
      .map(row => (row as any)._trackData);
    if (listTracks.length > 0) {
      playTrack(listTracks[0], 0, listTracks);
      showToast('Reproduciendo lista');
    } else {
      showToast('La lista está vacía', 'info');
    }
  });

  // Playlist view shuffle button
  playlistShuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    playlistShuffleBtn.classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Modo aleatorio activado' : 'Modo aleatorio desactivado');
  });

  // Playlist view Like button
  playlistLikeBtn.addEventListener('click', () => {
    showToast('Lista guardada en tu biblioteca');
    playlistLikeBtn.classList.toggle('active');
  });

  // Playlist view Download button
  playlistDownloadBtn.addEventListener('click', () => {
    showToast('Iniciando descarga de la lista...');
    setTimeout(() => {
      showToast('Lista de reproducción descargada para modo offline');
    }, 1500);
  });

  // Playlist view three dots button
  playlistMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = playlistMenuBtn.getBoundingClientRect();
    const dummyTrack: Track = {
      id: 'playlist-mix',
      title: playlistTitle.textContent || 'Playlist',
      artist: 'Waisify Mix',
      duration: 3600,
      thumbnail: ''
    };
    openFloatingContextMenu(dummyTrack, rect.left, rect.bottom + 10);
  });

  // Seek timeline
  progressBar.addEventListener('input', () => {
    updateSliderFill(progressBar);
    if (!ytPlayer || typeof ytPlayer.seekTo !== 'function') return;
    const seekSeconds = Number(progressBar.value);
    ytPlayer.seekTo(seekSeconds, true);
    currentTimeLabel.textContent = formatTime(seekSeconds);
    updateActiveLyricsLine(seekSeconds);
  });

  // Volume Bar
  volumeBar.addEventListener('input', () => {
    updateSliderFill(volumeBar);
    if (!ytPlayer || typeof ytPlayer.setVolume !== 'function') return;
    const val = Number(volumeBar.value);
    ytPlayer.setVolume(val);
    isMuted = val === 0;
    updateVolumeIcon(val / 100);
  });

  volumeIconBtn.addEventListener('click', () => {
    if (!ytPlayer || typeof ytPlayer.mute !== 'function') return;
    if (isMuted) {
      ytPlayer.unmute();
      ytPlayer.setVolume(previousVolume);
      volumeBar.value = previousVolume.toString();
      updateSliderFill(volumeBar);
      isMuted = false;
      updateVolumeIcon(previousVolume / 100);
    } else {
      previousVolume = ytPlayer.getVolume();
      ytPlayer.mute();
      volumeBar.value = '0';
      updateSliderFill(volumeBar);
      isMuted = true;
      updateVolumeIcon(0);
    }
  });

  // Mouse hover detection to toggle green track fill
  const pgWrapper = document.querySelector('.progress-bar-wrapper') as HTMLDivElement;
  const volContainer = document.querySelector('.volume-container') as HTMLDivElement;
  if (pgWrapper) {
    pgWrapper.addEventListener('mouseenter', () => { pgHovered = true; updateSliderFill(progressBar); });
    pgWrapper.addEventListener('mouseleave', () => { pgHovered = false; updateSliderFill(progressBar); });
  }
  if (volContainer) {
    volContainer.addEventListener('mouseenter', () => { volHovered = true; updateSliderFill(volumeBar); });
    volContainer.addEventListener('mouseleave', () => { volHovered = false; updateSliderFill(volumeBar); });
  }

  // Initial range fills
  updateSliderFill(progressBar);
  updateSliderFill(volumeBar);

  // Close context menu on clicking anywhere else
  document.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
  });

  // Wire Context Menu functions
  menuAddToQueue.addEventListener('click', () => {
    if (activeMenuTrack) {
      playQueue.push(activeMenuTrack);
      showToast(`"${activeMenuTrack.title}" añadida a la cola`);
    }
  });

  // Library Toggle
  menuToggleLibrary.addEventListener('click', () => {
    if (activeMenuTrack) {
      toggleLikedStatus(activeMenuTrack);
    }
  });

  menuDownload.addEventListener('click', () => {
    if (activeMenuTrack) {
      triggerTrackDownload(activeMenuTrack);
    }
  });

  menuShare.addEventListener('click', () => {
    if (activeMenuTrack) {
      const shareUrl = `https://waisify.app/track/${activeMenuTrack.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Enlace copiado al portapapeles');
      }).catch(err => {
        console.error(err);
        showToast('No se pudo copiar el enlace', 'info');
      });
    }
  });
}

// Play by Query helper
async function playByQuery(query: string) {
  showToast(`Cargando mix: "${query}"...`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    const tracks: Track[] = await response.json();
    if (tracks.length > 0) {
      playTrack(tracks[0], 0, tracks);
    } else {
      showToast('No se encontraron canciones para el mix', 'info');
    }
  } catch (err: any) {
    showToast(`Error al reproducir mix: ${err.message}`, 'info');
  }
}

// Download action simulator
function triggerTrackDownload(track: Track | null) {
  if (!track) return;
  showToast(`Descargando "${track.title}"...`);
  setTimeout(() => {
    showToast(`Descarga de "${track.title}" completada. Guardada en caché offline.`);
  }, 1800);
}

// Context Menu populator
function openFloatingContextMenu(track: Track, x: number, y: number) {
  activeMenuTrack = track;
  contextMenu.classList.remove('hidden');
  
  contextMenu.style.left = `${Math.min(x, window.innerWidth - 240)}px`;
  contextMenu.style.top = `${Math.min(y, window.innerHeight - 300)}px`;

  const isLiked = checkIfTrackIsLiked(track);
  menuLibraryText.textContent = isLiked ? 'Quitar de Tu biblioteca' : 'Añadir a Tu biblioteca';

  menuPlaylistSubmenu.innerHTML = '';
  if (playlists.length === 0) {
    menuPlaylistSubmenu.innerHTML = '<div class="context-menu-item">Sin listas de reproducción</div>';
    return;
  }

  playlists.forEach(playlist => {
    if (playlist.name === LIKED_SONGS_PLAYLIST_NAME) return;

    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.innerHTML = `
      <svg class="menu-item-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
      <span>${playlist.name}</span>
    `;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      contextMenu.classList.add('hidden');
      addTrackToPlaylist(track, playlist.id, playlist.name);
    });
    menuPlaylistSubmenu.appendChild(item);
  });
}

// Add Track to Playlist API binder
async function addTrackToPlaylist(track: Track, playlistId: number, playlistName: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        thumbnail: track.thumbnail,
        youtubeId: track.youtubeId || ''
      })
    });

    if (!response.ok) throw new Error('Failed to add track');
    showToast(`Añadida "${track.title}" a "${playlistName}"`);

    if (currentPlaylistId === playlistId) {
      loadPlaylist(playlistId, false);
    }
  } catch (err) {
    console.error(err);
    showToast('Error al añadir canción a la lista', 'info');
  }
}

// Auth UI transitions
function showLogin() {
  authOverlay.classList.remove('hidden');
  appLayout.classList.add('hidden');
  playerBar.classList.add('hidden');
}

async function showApp() {
  authOverlay.classList.add('hidden');
  appLayout.classList.remove('hidden');
  playerBar.classList.remove('hidden');
  
  displayUsername.textContent = username;
  avatarLetter.textContent = username.charAt(0).toUpperCase();

  // Redirect to Home view
  navigateToView('home');

  // Load User Playlists
  await fetchPlaylists();

  // Auto-create Liked Songs playlist if missing
  await verifyAndCreateLikedSongsPlaylist();
}

// Playlists Library verification
async function verifyAndCreateLikedSongsPlaylist() {
  const hasLiked = playlists.some(p => p.name === LIKED_SONGS_PLAYLIST_NAME);
  if (!hasLiked) {
    console.log('Liked Songs playlist missing. Auto-creating...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: LIKED_SONGS_PLAYLIST_NAME })
      });
      if (response.ok) {
        const newPl = await response.json();
        playlists.push(newPl);
        renderSidebarPlaylists();
        console.log('Liked Songs playlist successfully auto-created.');
      }
    } catch (err) {
      console.error('Failed to auto-create Liked Songs playlist:', err);
    }
  }
}

// Playlists Loading API binders
async function fetchPlaylists() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/playlists`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load playlists');
    playlists = await response.json();
    renderSidebarPlaylists();
  } catch (err) {
    console.error('Error fetching playlists:', err);
  }
}

async function performSearch(query: string) {
  searchResults.innerHTML = '<p class="empty-state">Buscando...</p>';
  try {
    const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    const tracks: Track[] = await response.json();
    
    if (tracks.length === 0) {
      searchResults.innerHTML = '<p class="empty-state">No se encontraron resultados.</p>';
      return;
    }

    searchResults.innerHTML = '';
    tracks.forEach((track, index) => {
      const row = createTrackRow(track, index, tracks);
      searchResults.appendChild(row);
    });
  } catch (err: any) {
    searchResults.innerHTML = `<p class="empty-state" style="color: #ff5252;">Error: ${err.message}</p>`;
  }
}

// Check Liked track status helper
let likedTrackTitles = new Set<string>();

function checkIfTrackIsLiked(track: Track): boolean {
  return likedTrackTitles.has(track.title);
}

// Toggle Liked status
async function toggleLikedStatus(track: Track | null) {
  if (!track) return;
  
  const likedPlaylist = playlists.find(p => p.name === LIKED_SONGS_PLAYLIST_NAME);
  if (!likedPlaylist) {
    showToast('Lista de favoritos no inicializada', 'info');
    return;
  }

  const isLiked = checkIfTrackIsLiked(track);
  if (isLiked) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${likedPlaylist.id}/tracks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tracks = await res.json();
      const match = tracks.find((t: any) => t.title === track.title);
      if (match) {
        await fetch(`${API_BASE_URL}/api/playlists/${likedPlaylist.id}/tracks/${match.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        likedTrackTitles.delete(track.title);
        showToast('Eliminada de tus canciones favoritas');
        updateLikeButtonsUI(track);
        
        if (currentPlaylistId === likedPlaylist.id) {
          loadPlaylist(likedPlaylist.id, false);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error al quitar de biblioteca', 'info');
    }
  } else {
    try {
      await addTrackToPlaylist(track, likedPlaylist.id, LIKED_SONGS_PLAYLIST_NAME);
      likedTrackTitles.add(track.title);
      showToast('Guardada en tu biblioteca');
      updateLikeButtonsUI(track);
      
      if (currentPlaylistId === likedPlaylist.id) {
        loadPlaylist(likedPlaylist.id, false);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

// UI Checkmark/Heart synchronizers
function updateLikeButtonsUI(currentTrack: Track | null) {
  if (!currentTrack) {
    playerLikeBtn.classList.add('hidden');
    return;
  }

  playerLikeBtn.classList.remove('hidden');
  const isLiked = checkIfTrackIsLiked(currentTrack);

  if (isLiked) {
    playerLikeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="player-icon" style="color: var(--accent-color);">
        <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    `;
    playerLikeBtn.title = 'Quitar de Tu biblioteca';
  } else {
    playerLikeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="player-icon">
        <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    `;
    playerLikeBtn.title = 'Añadir a Tu biblioteca';
  }
}

// Load Playlist Details
async function loadPlaylist(id: number, trackHistory = true) {
  currentPlaylistId = id;
  const playlist = playlists.find(p => p.id === id);
  if (!playlist) return;

  if (trackHistory) {
    navigateToView(`playlist-${id}`);
  }
  
  document.querySelectorAll('.playlist-item').forEach(item => {
    if (Number(item.getAttribute('data-id')) === id) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  playlistTitle.textContent = playlist.name;
  playlistAuthor.textContent = username;
  playlistTracks.innerHTML = '<p class="empty-state">Cargando canciones...</p>';

  try {
    const response = await fetch(`${API_BASE_URL}/api/playlists/${id}/tracks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch playlist tracks');
    
    const tracks: Track[] = await response.json();
    playlistTrackCount.textContent = `${tracks.length} canciones`;

    if (playlist.name === LIKED_SONGS_PLAYLIST_NAME) {
      likedTrackTitles.clear();
      tracks.forEach(t => likedTrackTitles.add(t.title));
      
      if (currentQueue[currentQueueIndex]) {
        updateLikeButtonsUI(currentQueue[currentQueueIndex]);
      }
    }

    if (tracks.length === 0) {
      playlistTracks.innerHTML = '<p class="empty-state">Esta lista está vacía. Busca canciones y añádelas aquí.</p>';
      return;
    }

    playlistTracks.innerHTML = '';
    tracks.forEach((track, index) => {
      const mappedTrack: Track = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        thumbnail: track.thumbnail,
        youtubeId: (track as any).youtube_id,
        playlistTrackId: (track as any).id
      };
      
      const row = createTrackRow(mappedTrack, index, tracks, true);
      playlistTracks.appendChild(row);
    });
  } catch (err: any) {
    playlistTracks.innerHTML = `<p class="empty-state" style="color: #ff5252;">Error: ${err.message}</p>`;
  }
}

// Rendering Helpers
function renderSidebarPlaylists() {
  sidebarPlaylists.innerHTML = '';
  playlists.forEach(playlist => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.setAttribute('data-id', playlist.id.toString());
    item.textContent = playlist.name;
    item.addEventListener('click', () => navigateToView(`playlist-${playlist.id}`));
    sidebarPlaylists.appendChild(item);
  });
}

function createTrackRow(track: Track, index: number, queueContext: Track[], isPlaylistView = false): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'track-row';
  (row as any)._trackData = track;

  if (currentQueue[currentQueueIndex] && currentQueue[currentQueueIndex].title === track.title) {
    row.classList.add('active');
  }

  row.innerHTML = `
    <img class="track-row-cover" src="${track.thumbnail || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='}" alt="Cover">
    <div class="track-row-details">
      <div class="track-row-title">${track.title}</div>
      <div class="track-row-artist">${track.artist}</div>
    </div>
    <div class="track-row-right">
      <div class="track-row-duration">${formatTime(track.duration)}</div>
      <button class="track-action-btn row-three-dots-btn" title="Opciones">
        <svg class="track-action-icon" viewBox="0 0 24 24" style="width:18px; height:18px;"><path fill="currentColor" d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/></svg>
      </button>
    </div>
  `;

  row.addEventListener('click', () => {
    playTrack(track, index, queueContext);
  });

  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFloatingContextMenu(track, e.clientX, e.clientY);
  });

  const dotsBtn = row.querySelector('.row-three-dots-btn') as HTMLButtonElement;
  dotsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = dotsBtn.getBoundingClientRect();
    openFloatingContextMenu(track, rect.left - 180, rect.bottom + 5);
  });

  return row;
}

// Playback Logic
async function playTrack(track: Track, index: number, queue: Track[]) {
  currentQueue = queue;
  currentQueueIndex = index;
  
  playerCover.src = track.thumbnail || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  playerTitle.textContent = track.title;
  playerArtist.textContent = track.artist;
  playerMenuBtn.classList.remove('hidden');

  updateLikeButtonsUI(track);

  if (!ytPlayer) {
    console.error('YouTube Player API not loaded yet.');
    return;
  }

  totalTimeLabel.textContent = formatTime(track.duration);
  progressBar.max = track.duration.toString();
  progressBar.value = '0';
  currentTimeLabel.textContent = '0:00';
  updateSliderFill(progressBar);

  updateAdaptiveBackground(track.thumbnail);

  try {
    let videoId = track.youtubeId;
    if (!videoId) {
      console.log(`Resolving Spotify track metadata to YouTube ID for: "${track.title}"`);
      const response = await fetch(`${API_BASE_URL}/api/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
      if (!response.ok) throw new Error('Could not resolve track');
      const data = await response.json();
      videoId = data.youtubeId;
      track.youtubeId = videoId; // Cache resolved youtubeId
    }

    if (!videoId) throw new Error('Track has no valid YouTube ID.');

    // Fetch lyrics now that we have a resolved videoId
    if (!lyricsPanel.classList.contains('hidden')) {
      const cleanArtistName = track.artist.replace(/-\s*Topic/gi, '').replace(/Topic/gi, '').trim();
      lyricsSongTitle.textContent = `${track.title} - ${cleanArtistName}`;
      fetchLyrics(track.artist, track.title);
    } else {
      fetchLyrics(track.artist, track.title);
    }

    console.log(`Loading YouTube Video ID: ${videoId}`);
    ytPlayer.loadVideoById(videoId);
    isPlaying = true;
    updatePlayButtonUI();
    highlightActiveTrackInLists();

    // Start wave visualizer if settings say yes
    if (isVisualizerEnabled) startVisualizer();

    saveToHistory(track);

  } catch (err: any) {
    console.error('Playback setup failed:', err);
    showToast(`No se pudo reproducir la canción: ${err.message}`, 'info');
    isPlaying = false;
    updatePlayButtonUI();
  }
}

function togglePlay() {
  if (!ytPlayer || !currentQueue[currentQueueIndex]) return;

  const playerState = ytPlayer.getPlayerState();
  if (playerState === 1) { // playing
    ytPlayer.pauseVideo();
    isPlaying = false;
  } else {
    ytPlayer.playVideo();
    isPlaying = true;
    if (isVisualizerEnabled) startVisualizer();
  }
  updatePlayButtonUI();
}

function playNext() {
  if (playQueue.length > 0) {
    const nextQueuedTrack = playQueue.shift();
    if (nextQueuedTrack) {
      currentQueue.splice(currentQueueIndex + 1, 0, nextQueuedTrack);
      playTrack(nextQueuedTrack, currentQueueIndex + 1, currentQueue);
      return;
    }
  }

  if (currentQueue.length === 0 || currentQueueIndex === -1) return;
  
  let nextIndex = currentQueueIndex + 1;
  if (isShuffle) {
    nextIndex = Math.floor(Math.random() * currentQueue.length);
  } else if (nextIndex >= currentQueue.length) {
    nextIndex = 0; // Loop queue
  }
  
  const mappedTrack = mapContextTrack(currentQueue[nextIndex]);
  playTrack(mappedTrack, nextIndex, currentQueue);
}

function playPrev() {
  if (currentQueue.length === 0 || currentQueueIndex === -1) return;

  let prevIndex = currentQueueIndex - 1;
  if (prevIndex < 0) {
    prevIndex = currentQueue.length - 1; // Go to end
  }

  const mappedTrack = mapContextTrack(currentQueue[prevIndex]);
  playTrack(mappedTrack, prevIndex, currentQueue);
}

// Mappers
function mapContextTrack(track: any): Track {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    thumbnail: track.thumbnail,
    youtubeId: track.youtubeId || track.youtube_id,
    playlistTrackId: track.playlistTrackId || track.id
  };
}

function highlightActiveTrackInLists() {
  const currentTitle = currentQueue[currentQueueIndex]?.title;
  document.querySelectorAll('.track-row').forEach(row => {
    const titleEl = row.querySelector('.track-row-title');
    if (titleEl && titleEl.textContent === currentTitle) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
}

// UI updates
function updatePlayButtonUI() {
  if (isPlaying) {
    playBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="player-icon-main">
        <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    `;
  } else {
    playBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="player-icon-main">
        <path fill="currentColor" d="M8 5v14l11-7z"/>
      </svg>
    `;
  }
}

function updateVolumeIcon(vol: number) {
  let path = '';
  if (vol === 0) {
    path = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
  } else if (vol < 0.4) {
    path = 'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z';
  } else {
    path = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
  }
  
  volumeIconBtn.innerHTML = `
    <svg viewBox="0 0 24 24" class="player-icon">
      <path fill="currentColor" d="${path}"/>
    </svg>
  `;
}

// Utility Formatters
function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function stopProgressTimer() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

// Run init on DOM load
window.addEventListener('DOMContentLoaded', init);
