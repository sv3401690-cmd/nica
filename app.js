/* ----------------------------------------------------
   WaveFlow JavaScript - Web Audio & Canvas Visualization
---------------------------------------------------- */

// --- Constants & Config ---
const THEMES = {
    cyberpunk: {
        start: '#ff007f',
        end: '#7f00ff',
        glow: 'rgba(255, 0, 127, 0.45)'
    },
    sunset: {
        start: '#ff4500',
        end: '#ff8c00',
        glow: 'rgba(255, 69, 0, 0.45)'
    },
    ocean: {
        start: '#00c6ff',
        end: '#0072ff',
        glow: 'rgba(0, 198, 255, 0.45)'
    },
    emerald: {
        start: '#00ff87',
        end: '#60efff',
        glow: 'rgba(0, 255, 135, 0.45)'
    }
};

let currentTheme = 'cyberpunk';
let audioContext = null;
let analyser = null;
let dataArray = null;
let source = null; // Can be mediaElementSource or mediaStreamSource
let audioStream = null; // For microphone track cleanup
let isMicActive = false;

// Audio HTML elements
const audioElement = new Audio();
audioElement.crossOrigin = "anonymous";

// DOM Elements
const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');
const screenRippleMap = document.getElementById('screen-ripple-displacement');
let screenRipples = [
    { progress: 0, maxScale: 0 },
    { progress: 0, maxScale: 0 },
    { progress: 0, maxScale: 0 }
];
let nextRippleIndex = 0;
let isWorkspaceActive = false;
let isWorkspaceLocked = false;
let currentCenterX = null;

// Precompute Look-Up Tables (LUT) for radial displacement map (size 128x128)
const DISPLACEMENT_SIZE = 128;
const DISPLACEMENT_HALF = DISPLACEMENT_SIZE / 2;
const rLUT = new Float32Array(DISPLACEMENT_SIZE * DISPLACEMENT_SIZE);
const nxLUT = new Float32Array(DISPLACEMENT_SIZE * DISPLACEMENT_SIZE);
const nyLUT = new Float32Array(DISPLACEMENT_SIZE * DISPLACEMENT_SIZE);

for (let y = 0; y < DISPLACEMENT_SIZE; y++) {
    const dy = y - DISPLACEMENT_HALF;
    for (let x = 0; x < DISPLACEMENT_SIZE; x++) {
        const dx = x - DISPLACEMENT_HALF;
        const r = Math.sqrt(dx * dx + dy * dy);
        const idx = y * DISPLACEMENT_SIZE + x;
        rLUT[idx] = r;
        if (r > 0) {
            nxLUT[idx] = dx / r;
            nyLUT[idx] = dy / r;
        } else {
            nxLUT[idx] = 0;
            nyLUT[idx] = 0;
        }
    }
}

// Create offscreen canvas for rendering the dynamic displacement map
const displacementCanvas = document.createElement('canvas');
displacementCanvas.width = DISPLACEMENT_SIZE;
displacementCanvas.height = DISPLACEMENT_SIZE;
const displacementCtx = displacementCanvas.getContext('2d');

const dashboard = document.getElementById('dashboard');
const collapseBtn = document.getElementById('collapse-btn');

// Tab Selection
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Upload & Drag/Drop
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const playerPanel = document.getElementById('player-panel');
const trackName = document.getElementById('track-name');
const playPauseBtn = document.getElementById('play-pause-btn');
const progressBar = document.getElementById('progress-bar');
const currentTimeLabel = document.getElementById('current-time');
const durationLabel = document.getElementById('duration');
const volumeSlider = document.getElementById('volume-slider');

// Mic elements
const startMicBtn = document.getElementById('start-mic-btn');

// Visual adjust sliders
const sliderSensitivity = document.getElementById('slider-sensitivity');
const sliderWaves = document.getElementById('slider-waves');
const sliderSpeed = document.getElementById('slider-speed');
const toggleWaves = document.getElementById('toggle-waves');
const toggleParticles = document.getElementById('toggle-particles');
const toggleGlow = document.getElementById('toggle-glow');
const selectStyle = document.getElementById('select-style');

// Style-specific sliders and controls
const sliderBarDensity = document.getElementById('slider-bar-density');
const sliderPeakDecay = document.getElementById('slider-peak-decay');
const sliderStarCount = document.getElementById('slider-star-count');
const sliderWarpStretch = document.getElementById('slider-warp-stretch');
const selectWaveStyle = document.getElementById('select-wave-style');
const toggleWaveFill = document.getElementById('toggle-wave-fill');

// Slider Value indicators
const valSensitivity = document.getElementById('val-sensitivity');
const valWaves = document.getElementById('val-waves');
const valSpeed = document.getElementById('val-speed');
const valBarDensity = document.getElementById('val-bar-density');
const valPeakDecay = document.getElementById('val-peak-decay');
const valStarCount = document.getElementById('val-star-count');
const valWarpStretch = document.getElementById('val-warp-stretch');

// Custom Center Image selectors
const customImageBtn = document.getElementById('custom-image-btn');
const customImageInput = document.getElementById('custom-image-input');

// Toggle selectors
const toggleCenterCore = document.getElementById('toggle-center-core');
const toggleRgb = document.getElementById('toggle-rgb');

// Workspace Mode Panel Elements
const btnToggleWorkspace = document.getElementById('btn-toggle-workspace');
const workspacePanel = document.getElementById('workspace-panel');
const closeWorkspaceBtn = document.getElementById('close-workspace-btn');
const workspaceIframe = document.getElementById('workspace-iframe');
const workspaceAddressBar = document.getElementById('workspace-address-bar');
const btnBrowserBack = document.getElementById('btn-browser-back');
const btnBrowserForward = document.getElementById('btn-browser-forward');
const btnBrowserReload = document.getElementById('btn-browser-reload');
const btnBrowserHome = document.getElementById('btn-browser-home');
const btnWorkspaceLock = document.getElementById('btn-workspace-lock');
const workspaceDragOverlay = document.getElementById('workspace-drag-overlay');
const workspacePlaceholder = document.getElementById('workspace-placeholder');
const workspaceSpotifyHelp = document.getElementById('workspace-spotify-help');
const btnSpotifyHelpBack = document.getElementById('btn-spotify-help-back');
const placeholderSearchInput = document.getElementById('placeholder-search-input');
const btnPlaceholderGo = document.getElementById('btn-placeholder-go');

// Theme buttons
const themeButtons = document.querySelectorAll('.theme-btn');

// Zen Mandala Panel Elements
const zenCustomizerPanel = document.getElementById('zen-customizer-panel');
const closeZenBtn = document.getElementById('close-zen-btn');
const zenLooksBtn = document.getElementById('zen-looks-btn');
const zenCustomizerTrigger = document.getElementById('zen-customizer-trigger');
const selectZenTheme = document.getElementById('select-zen-theme');
const sliderZenPetals = document.getElementById('slider-zen-petals');
const valZenPetals = document.getElementById('val-zen-petals');
const sliderZenSpeed = document.getElementById('slider-zen-speed');
const valZenSpeed = document.getElementById('val-zen-speed');
const sliderZenScale = document.getElementById('slider-zen-scale');
const valZenScale = document.getElementById('val-zen-scale');
const sliderZenFireflies = document.getElementById('slider-zen-fireflies');
const valZenFireflies = document.getElementById('val-zen-fireflies');
const toggleZenRing = document.getElementById('toggle-zen-ring');

// Chaos Vortex Panel Elements
const vortexCustomizerPanel = document.getElementById('vortex-customizer-panel');
const closeVortexBtn = document.getElementById('close-vortex-btn');
const vortexLooksBtn = document.getElementById('vortex-looks-btn');
const vortexCustomizerTrigger = document.getElementById('vortex-customizer-trigger');
const selectVortexTheme = document.getElementById('select-vortex-theme');
const sliderVortexArms = document.getElementById('slider-vortex-arms');
const valVortexArms = document.getElementById('val-vortex-arms');
const sliderVortexParticles = document.getElementById('slider-vortex-particles');
const valVortexParticles = document.getElementById('val-vortex-particles');
const sliderVortexSpin = document.getElementById('slider-vortex-spin');
const valVortexSpin = document.getElementById('val-vortex-spin');
const toggleVortexFlare = document.getElementById('toggle-vortex-flare');

// Glitch Storm Panel Elements
const glitchCustomizerPanel = document.getElementById('glitch-customizer-panel');
const closeGlitchBtn = document.getElementById('close-glitch-btn');
const glitchLooksBtn = document.getElementById('glitch-looks-btn');
const glitchCustomizerTrigger = document.getElementById('glitch-customizer-trigger');
const selectGlitchTheme = document.getElementById('select-glitch-theme');
const sliderGlitchIntensity = document.getElementById('slider-glitch-intensity');
const valGlitchIntensity = document.getElementById('val-glitch-intensity');
const sliderGlitchChroma = document.getElementById('slider-glitch-chroma');
const valGlitchChroma = document.getElementById('val-glitch-chroma');
const sliderGlitchScanlines = document.getElementById('slider-glitch-scanlines');
const valGlitchScanlines = document.getElementById('val-glitch-scanlines');
const toggleGlitchLightning = document.getElementById('toggle-glitch-lightning');

// Inferno Tunnel Panel Elements
const infernoCustomizerPanel = document.getElementById('inferno-customizer-panel');
const closeInfernoBtn = document.getElementById('close-inferno-btn');
const infernoLooksBtn = document.getElementById('inferno-looks-btn');
const infernoCustomizerTrigger = document.getElementById('inferno-customizer-trigger');
const selectInfernoTheme = document.getElementById('select-inferno-theme');
const selectInfernoShape = document.getElementById('select-inferno-shape');
const sliderInfernoSpeed = document.getElementById('slider-inferno-speed');
const valInfernoSpeed = document.getElementById('val-inferno-speed');
const sliderInfernoDensity = document.getElementById('slider-inferno-density');
const valInfernoDensity = document.getElementById('val-inferno-density');
const toggleInfernoFire = document.getElementById('toggle-inferno-fire');

// Phonk Global Controls Elements
const phonkmixCustomizerTrigger = document.getElementById('phonkmix-customizer-trigger');
const phonkmixLooksBtn = document.getElementById('phonkmix-looks-btn');
const styleControlsPhonkGlobal = document.getElementById('style-controls-phonk-global');
const sliderPhonkIntensity = document.getElementById('slider-phonk-intensity');
const valPhonkIntensity = document.getElementById('val-phonk-intensity');
const phonkCycleTimeContainer = document.getElementById('phonk-cycle-time-container');
const sliderPhonkCycleTime = document.getElementById('slider-phonk-cycle-time');
const valPhonkCycleTime = document.getElementById('val-phonk-cycle-time');

// Equalizer Extra Controls
const selectBarsLayout = document.getElementById('select-bars-layout');
const togglePeakHold = document.getElementById('toggle-peak-hold');

// Parse URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const iconUrl = urlParams.get('iconUrl');
let logoImg = null;
if (iconUrl) {
    logoImg = new Image();
    logoImg.src = decodeURIComponent(iconUrl);
}

// Radial coordinate displacement to create a realistic physical water-ripple distortion
function displacePoint(x, y) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let dx = x - cx;
    let dy = y - cy;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x, y };

    let shift = 0;
    waveRipples.forEach(ripple => {
        const delta = dist - ripple.radius;
        if (Math.abs(delta) < 180) { // ripple packet width
            // Gaussian envelope to localize the ripple wave packet
            const envelope = Math.exp(-Math.pow(delta / 65, 2));
            // Sinusoidal ripple wave
            shift += Math.sin(delta * 0.08) * ripple.amplitude * envelope;
        }
    });

    if (shift !== 0) {
        const angle = Math.atan2(dy, dx);
        return {
            x: x + Math.cos(angle) * shift,
            y: y + Math.sin(angle) * shift
        };
    }
    return { x, y };
}

// --- Song History IndexedDB Manager ---
let db = null;
const DB_NAME = 'SongHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'songs';
const MAX_SONGS = 8;
let isPlayingFromHistory = false; // Prevents saving loop

function initHistoryDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
            updateHistoryUI();
        };
        request.onerror = (e) => {
            console.error("IndexedDB open failed:", e.target.error);
            reject(e.target.error);
        };
    });
}

function saveSong(file) {
    if (isPlayingFromHistory) return Promise.resolve(); // Don't save it if we loaded it from history!
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        // First, check if song with same name exists, to avoid duplicates
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.getAll();
        
        getRequest.onsuccess = () => {
            const allSongs = getRequest.result;
            const duplicate = allSongs.find(s => s.name === file.name);
            
            if (duplicate) {
                // Update timestamp for existing entry
                duplicate.timestamp = Date.now();
                const updateTransaction = db.transaction([STORE_NAME], 'readwrite');
                const updateStore = updateTransaction.objectStore(STORE_NAME);
                const updateRequest = updateStore.put(duplicate);
                updateRequest.onsuccess = () => {
                    updateHistoryUI();
                    resolve();
                };
                return;
            }

            // Read the file as an ArrayBuffer to force copy the actual file bytes.
            // This is required because modern browsers discard file references on reload/security policy.
            const reader = new FileReader();
            reader.onload = (event) => {
                const arrayBuffer = event.target.result;
                const binaryBlob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });

                // Prepare insert record with actual binary bytes
                const songRecord = {
                    name: file.name,
                    blob: binaryBlob,
                    size: file.size,
                    timestamp: Date.now()
                };

                // Limit songs: if we exceed MAX_SONGS, delete oldest
                // Sort by timestamp ascending
                allSongs.sort((a, b) => a.timestamp - b.timestamp);
                const insertRecord = () => {
                    const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
                    const writeStore = writeTransaction.objectStore(STORE_NAME);
                    const writeRequest = writeStore.add(songRecord);
                    writeRequest.onsuccess = () => {
                        updateHistoryUI();
                        resolve();
                    };
                    writeRequest.onerror = (err) => reject(err.target.error);
                };

                if (allSongs.length >= MAX_SONGS) {
                    const oldest = allSongs[0];
                    const deleteTransaction = db.transaction([STORE_NAME], 'readwrite');
                    const deleteStore = deleteTransaction.objectStore(STORE_NAME);
                    const deleteRequest = deleteStore.delete(oldest.id);
                    deleteRequest.onsuccess = () => {
                        insertRecord();
                    };
                    deleteRequest.onerror = (err) => reject(err.target.error);
                } else {
                    insertRecord();
                }
            };
            
            reader.onerror = (err) => {
                console.error("Failed to read audio file bytes:", err);
                reject(err);
            };
            
            reader.readAsArrayBuffer(file);
        };
    });
}

function deleteSong(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => {
            updateHistoryUI();
            resolve();
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function getSong(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (e) => {
            resolve(e.target.result);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function getHistoryList() {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const list = request.result;
            // Sort newest first
            list.sort((a, b) => b.timestamp - a.timestamp);
            resolve(list);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

// Format time ago (e.g. "Just now", "5m ago")
function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (secs < 60) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// Update History List UI
function updateHistoryUI() {
    const historyListContainer = document.getElementById('history-list');
    const storageInfo = document.getElementById('history-storage-info');
    if (!historyListContainer) return;

    getHistoryList().then(songs => {
        if (songs.length === 0) {
            historyListContainer.innerHTML = `
                <div class="history-empty">
                    <p>No recently played tracks.</p>
                </div>
            `;
            storageInfo.innerText = "Storage: 0 MB / 8 songs max";
            return;
        }

        let totalSize = 0;
        let html = '';
        
        songs.forEach(song => {
            totalSize += song.size || 0;
            const sizeMB = ((song.size || 0) / (1024 * 1024)).toFixed(1);
            const timeAgo = formatTimeAgo(song.timestamp);
            
            // Check if this song is currently loaded
            const isActive = (trackName.innerText === song.name);
            const activeClass = isActive ? 'active' : '';

            html += `
                <div class="history-item ${activeClass}">
                    <div class="history-item-info">
                        <span class="history-item-name" title="${song.name}">${song.name}</span>
                        <span class="history-item-time">${timeAgo} • ${sizeMB} MB</span>
                    </div>
                    <div class="history-item-actions">
                        <button class="history-btn history-btn-play" onclick="playSongFromHistory(${song.id})" title="Sync & Replay Track">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <button class="history-btn history-btn-delete" onclick="removeSongFromHistory(${song.id})" title="Delete from cache">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        historyListContainer.innerHTML = html;
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        storageInfo.innerText = `Storage: ${totalSizeMB} MB / ${songs.length} of ${MAX_SONGS} songs`;
    }).catch(err => {
        console.error("Failed to load history list:", err);
    });
}

// Replay action
window.playSongFromHistory = function(id) {
    getSong(id).then(song => {
        if (!song) return;
        isPlayingFromHistory = true; // Flag to prevent re-saving
        
        // Reconstruct file object and load it
        const file = new File([song.blob], song.name, { type: song.blob.type });
        loadAudioFile(file);
        
        // Update DB timestamp to make it "recently played" again
        song.timestamp = Date.now();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(song).onsuccess = () => {
            isPlayingFromHistory = false;
            updateHistoryUI();
        };
    }).catch(err => {
        isPlayingFromHistory = false;
        console.error("Failed to play song from history:", err);
        alert("Failed to load song from storage.");
    });
};

// Delete action
window.removeSongFromHistory = function(id) {
    deleteSong(id).then(() => {
        updateHistoryUI();
    }).catch(err => {
        console.error("Failed to delete song:", err);
    });
};

// Initialize DB on page load
initHistoryDB().catch(console.error);

// Sync button event listener
setTimeout(() => {
    const btnSyncHistory = document.getElementById('btn-sync-history');
    if (btnSyncHistory) {
        btnSyncHistory.addEventListener('click', () => {
            const icon = btnSyncHistory.querySelector('i');
            if (icon) {
                icon.classList.add('fa-spin');
                setTimeout(() => {
                    icon.classList.remove('fa-spin');
                }, 800);
            }
            updateHistoryUI();
        });
    }
}, 1000);

// GlowOrb class for audio-reactive ambient background
class GlowOrb {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseSize = Math.random() * 18 + 6; // soft large orbs
        this.size = this.baseSize;
        this.speedX = (Math.random() - 0.5) * 0.8;
        this.speedY = (Math.random() - 0.5) * 0.8;
        this.alpha = Math.random() * 0.4 + 0.15; // translucent
    }

    update(smoothBassVal, smoothTrebleVal) {
        this.x += this.speedX * (1 + smoothBassVal * 2.5);
        this.y += this.speedY * (1 + smoothTrebleVal * 2.5);
        
        // Pulse size with bass
        this.size = this.baseSize * (1 + smoothBassVal * 1.6);
        
        // Wrap around screen edges
        if (this.x < -this.size) this.x = canvas.width + this.size;
        if (this.x > canvas.width + this.size) this.x = -this.size;
        if (this.y < -this.size) this.y = canvas.height + this.size;
        if (this.y > canvas.height + this.size) this.y = -this.size;
    }

    draw(ctx, baseColor) {
        // Apply radial displacement ripple distortion
        const p = displacePoint(this.x, this.y);
        
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Create soft radial glow gradient
        const grad = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, this.size
        );
        grad.addColorStop(0, baseColor);
        grad.addColorStop(0.3, baseColor);
        grad.addColorStop(1, 'rgba(7, 8, 13, 0)');
        
        ctx.fillStyle = grad;
        
        if (toggleGlow.checked) {
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = this.size * 0.8;
        }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Shockwave class for beat-reactive concentric ripples expanding from center
class Shockwave {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.maxRadius = Math.max(canvas.width, canvas.height) * 0.65;
        this.alpha = 1;
        this.decay = 0.016; // slightly slower decay for premium look
        this.color = color;
    }

    update() {
        this.radius += 12; // expand rapidly
        this.alpha -= this.decay;
    }

    draw(ctx, toggleGlowVal) {
        ctx.save();
        
        // Draw 3 concentric rings staggered to look like a water ripple
        for (let r = 0; r < 3; r++) {
            const currentRadius = this.radius - r * 45;
            if (currentRadius <= 5) continue;
            
            const ringAlpha = Math.max(0, this.alpha * (1 - currentRadius / this.maxRadius) * (1 - r * 0.3));
            if (ringAlpha <= 0) continue;
            
            ctx.globalAlpha = ringAlpha;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = Math.max(0.5, (1 - currentRadius / this.maxRadius) * 4.5 + 0.5);
            
            if (toggleGlowVal) {
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 18 + (smoothBass * 12);
            }
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// State Variables
let particles = []; // Pool of GlowOrbs
let shockwaves = []; // Active beat shockwaves
let waveRipples = []; // Beat-induced ripples propagating on wave lines

// Pre-populate ambient glow orbs
function initGlowOrbs() {
    particles = [];
    for (let i = 0; i < 25; i++) {
        particles.push(new GlowOrb(
            Math.random() * window.innerWidth,
            Math.random() * window.innerHeight
        ));
    }
}
initGlowOrbs();

let wavePhase = 0;
let logoRotation = 0;
let activeStyle = 'classic';
// Phonk & Auto-Cycle state
let phonkIntensity = 0.7; // 70% default intensity
let phonkSubStyle = 'vortex'; // current active sub-style in autocycle mode
let lastPhonkCycleTime = Date.now();
let phonkTransitionTimer = 0; // frame count for transition screen-glitch flash
const phonkStylesList = ['vortex', 'glitch', 'inferno'];
let stars = [];
let barPeaks = new Array(64).fill(0);
let rgbHue = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;

// Zen Mandala & Firefly state
class Firefly {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * window.innerWidth;
        this.y = initial ? Math.random() * window.innerHeight : window.innerHeight + 20;
        this.size = Math.random() * 3 + 1.5;
        this.speedY = -(Math.random() * 0.8 + 0.4);
        this.amplitude = Math.random() * 1.5 + 0.5;
        this.frequency = Math.random() * 0.02 + 0.005;
        this.phase = Math.random() * Math.PI * 2;
        this.baseAlpha = Math.random() * 0.5 + 0.3;
        this.alpha = 0.05;
        this.fadeSpeed = Math.random() * 0.01 + 0.005;
        this.glowing = true;
        
        const colors = ['rgba(240, 255, 140, ', 'rgba(173, 255, 47, ', 'rgba(152, 251, 152, '];
        this.colorPrefix = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.y += this.speedY;
        this.phase += this.frequency;
        this.x += Math.sin(this.phase) * this.amplitude;

        const pulse = Math.sin(Date.now() * this.frequency * 0.2) * 0.15;
        
        if (this.glowing) {
            this.alpha += this.fadeSpeed;
            if (this.alpha >= this.baseAlpha) {
                this.alpha = this.baseAlpha;
                if (Math.random() < 0.002) this.glowing = false;
            }
        } else {
            this.alpha -= this.fadeSpeed;
            if (this.alpha <= 0.05) {
                this.alpha = 0.05;
                if (Math.random() < 0.01) this.glowing = true;
            }
        }

        const finalAlpha = Math.max(0.1, Math.min(1.0, this.alpha + pulse + (smoothBass * 0.3)));

        if (this.y < -20 || this.x < -20 || this.x > window.innerWidth + 20) {
            this.reset(false);
        }
        
        return finalAlpha;
    }

    draw(ctx) {
        const finalAlpha = this.update();
        ctx.save();
        
        let drawX = this.x;
        let drawY = this.y;
        if (toggleParticles.checked) {
            const displaced = displacePoint(this.x, this.y);
            drawX = displaced.x;
            drawY = displaced.y;
        }

        ctx.beginPath();
        ctx.arc(drawX, drawY, this.size, 0, Math.PI * 2);

        ctx.fillStyle = `${this.colorPrefix}${finalAlpha})`;
        if (toggleGlow.checked) {
            ctx.shadowColor = 'rgba(210, 255, 100, 0.8)';
            ctx.shadowBlur = this.size * 3 + (smoothBass * 15);
        }
        ctx.fill();
        ctx.restore();
    }
}

let fireflies = [];
let zenRotationAngle = 0;

function updateFirefliesCount() {
    const targetCount = parseInt(sliderZenFireflies.value);
    while (fireflies.length < targetCount) {
        fireflies.push(new Firefly());
    }
    while (fireflies.length > targetCount) {
        fireflies.pop();
    }
}

// ---- CHAOS VORTEX ----
class VortexParticle {
    constructor(armIndex, totalArms) {
        this.armIndex = armIndex;
        this.totalArms = totalArms;
        this.reset();
    }
    reset() {
        this.radius = Math.random() * 30 + 5;
        this.maxRadius = Math.random() * (canvas.width * 0.5) + 60;
        this.angle = (this.armIndex / this.totalArms) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        this.angularVelocity = 0;
        this.speed = Math.random() * 2.5 + 0.8;
        this.size = Math.random() * 2.5 + 0.8;
        this.alpha = Math.random() * 0.7 + 0.3;
        this.tail = [];
        this.flingImpulse = 0;
    }
    update(spinSpeed, bassVal, beatFling) {
        const scaledBass = bassVal * phonkIntensity;
        if (beatFling) this.flingImpulse = Math.max(this.flingImpulse, scaledBass * 8);
        if (this.flingImpulse > 0) { this.flingImpulse *= 0.9; }

        const arms = parseInt(sliderVortexArms.value);
        this.angularVelocity = (spinSpeed * 0.015) * (1 + scaledBass * 3);
        this.angle += this.angularVelocity;
        this.radius += this.speed + scaledBass * 4 + this.flingImpulse;

        const x = canvas.width / 2 + Math.cos(this.angle) * this.radius;
        const y = canvas.height / 2 + Math.sin(this.angle) * this.radius;
        this.tail.unshift({ x, y });
        if (this.tail.length > 10) this.tail.pop();

        if (this.radius > this.maxRadius || x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
            this.armIndex = Math.floor(Math.random() * arms);
            this.reset();
        }
    }
    draw(ctx, color1, color2) {
        if (this.tail.length < 2) return;
        ctx.save();
        for (let i = 0; i < this.tail.length - 1; i++) {
            const t = 1 - i / this.tail.length;
            ctx.globalAlpha = this.alpha * t * 0.85;
            ctx.beginPath();
            ctx.arc(this.tail[i].x, this.tail[i].y, this.size * t, 0, Math.PI * 2);
            ctx.fillStyle = i < this.tail.length * 0.5 ? color1 : color2;
            ctx.fill();
        }
        ctx.restore();
    }
}

let vortexParticles = [];
let vortexAngle = 0;
let vortexBeatFling = false;

function initVortexParticles() {
    const count = parseInt(sliderVortexParticles.value);
    const arms = parseInt(sliderVortexArms.value);
    vortexParticles = [];
    for (let i = 0; i < count; i++) {
        vortexParticles.push(new VortexParticle(i % arms, arms));
    }
}

function syncVortexParticleCount() {
    const count = parseInt(sliderVortexParticles.value);
    const arms = parseInt(sliderVortexArms.value);
    while (vortexParticles.length < count) {
        vortexParticles.push(new VortexParticle(vortexParticles.length % arms, arms));
    }
    while (vortexParticles.length > count) { vortexParticles.pop(); }
}

// ---- GLITCH STORM ----
class LightningBolt {
    constructor(x1, y1, x2, y2, color, thickness = 2) {
        this.segments = this._buildSegments(x1, y1, x2, y2, 5);
        this.color = color;
        this.thickness = thickness;
        this.alpha = 1.0;
        this.decay = 0.08 + Math.random() * 0.07;
    }
    _buildSegments(x1, y1, x2, y2, depth) {
        if (depth === 0) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 80;
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 80;
        return [...this._buildSegments(x1, y1, mx, my, depth - 1), ...this._buildSegments(mx, my, x2, y2, depth - 1)];
    }
    update() { this.alpha -= this.decay; return this.alpha > 0; }
    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thickness;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.segments.length; i++) ctx.lineTo(this.segments[i].x, this.segments[i].y);
        ctx.stroke();
        ctx.restore();
    }
}

let lightningBolts = [];
let glitchSlices = [];  // active band-displacement records: {y, h, dx, life}
let glitchFrameTimer = 0;

// ---- INFERNO TUNNEL ----
class InfernoRing {
    constructor(zDepth) {
        this.z = zDepth;  // 0 = far, 1 = close
        this.alpha = 0;
    }
    update(speed, bassVal) {
        this.z += (speed * 0.008) * (1 + (bassVal * phonkIntensity) * 3);
        this.alpha = Math.min(1, this.z * 2.5);
        return this.z < 1.05;
    }
    draw(ctx, cx, cy, maxRadius, color1, color2, shape) {
        const r = this.z * maxRadius;
        const alpha = this.alpha * (1 - this.z * 0.5);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
        grad.addColorStop(0, color1);
        grad.addColorStop(0.5, color2);
        grad.addColorStop(1, color1);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, (1 - this.z) * 5 + 1);
        ctx.shadowColor = color1;
        ctx.shadowBlur = 20 + this.z * 30;
        ctx.beginPath();
        if (shape === 'circle') {
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
        } else if (shape === 'hexagon') {
            for (let i = 0; i <= 6; i++) {
                const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
                i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
        } else { // diamond (rotated square)
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx, cy + r);
            ctx.lineTo(cx - r, cy);
            ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();
    }
}

class InfernoParticle {
    constructor(cx, cy) {
        this.cx = cx; this.cy = cy;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.x = cx; this.y = cy;
        this.life = 1.0;
        this.size = Math.random() * 4 + 1.5;
        this.decay = Math.random() * 0.025 + 0.015;
        this.hue = Math.random() * 40;  // warm fire hues 0-40
    }
    update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.97; this.vy *= 0.97; this.vy -= 0.15; this.life -= this.decay; return this.life > 0; }
    draw(ctx, themeColor) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life * 0.9;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fillStyle = themeColor || `hsl(${this.hue}, 100%, ${40 + this.life * 30}%)`;
        ctx.shadowColor = themeColor || `hsl(${this.hue}, 100%, 60%)`;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }
}

let infernoRings = [];
let infernoParticles = [];

function initInfernoRings() {
    const density = parseInt(sliderInfernoDensity.value);
    infernoRings = [];
    for (let i = 0; i < density; i++) {
        const ring = new InfernoRing(i / density);
        infernoRings.push(ring);
    }
}


// Mouse interaction state
const mouse = { x: null, y: null, radius: 160 };
window.addEventListener('mousemove', (e) => {
    // Only capture coordinates if not interacting inside the dashboard
    if (e.clientX > 420 || dashboard.classList.contains('collapsed')) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    } else {
        mouse.x = null;
        mouse.y = null;
    }
});
window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

// Set initial canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 1. Dashboard UI Event Listeners ---

// Hover to Open / Hover Away to Collapse
let isDashboardLocked = false;

function openDashboard(lock = false) {
    dashboard.classList.remove('collapsed');
    collapseBtn.querySelector('i').className = 'fa-solid fa-chevron-left';
    if (lock) isDashboardLocked = true;
}

function closeDashboard(lock = false) {
    dashboard.classList.add('collapsed');
    collapseBtn.querySelector('i').className = 'fa-solid fa-chevron-right';
    if (lock) isDashboardLocked = false;
}

// Track mouse position to slide dashboard open/closed
window.addEventListener('mousemove', (e) => {
    if (isDashboardLocked) return;

    if (dashboard.classList.contains('collapsed')) {
        // Slide open when hovering within 40px of the left edge
        if (e.clientX < 40) {
            openDashboard(false);
        }
    } else {
        // Slide closed when cursor goes past the dashboard width (420px)
        if (e.clientX > 420) {
            closeDashboard(false);
        }
    }
});

// Manual toggle (clicking locks/unlocks the state)
collapseBtn.addEventListener('click', () => {
    if (dashboard.classList.contains('collapsed')) {
        openDashboard(true); // Manually opening locks it open
    } else {
        closeDashboard(false); // Manually closing hides it and unlocks it
        isDashboardLocked = false;
    }
});

// Dropdown selector for visualizer style
selectStyle.addEventListener('change', (e) => {
    activeStyle = e.target.value;
    
    // Hide all style-specific controls
    document.querySelectorAll('.style-specific-controls').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show the active one
    const activeControl = document.getElementById(`style-controls-${activeStyle}`);
    if (activeControl) {
        activeControl.style.display = 'flex';
    }
    
    // Initialize stars if switching to starfield
    if (activeStyle === 'starfield') {
        updateStarCount();
    }

    // Close all phonk/zen panels and their triggers first
    const allPanels = [zenCustomizerPanel, vortexCustomizerPanel, glitchCustomizerPanel, infernoCustomizerPanel];
    const allTriggers = [zenCustomizerTrigger, vortexCustomizerTrigger, glitchCustomizerTrigger, infernoCustomizerTrigger, phonkmixCustomizerTrigger];
    allPanels.forEach(p => p.classList.add('collapsed'));
    allTriggers.forEach(t => t.style.display = 'none');

    // Manage Phonk Global settings block display
    const isPhonkMode = ['vortex', 'glitch', 'inferno', 'phonkmix'].includes(activeStyle);
    if (isPhonkMode) {
        styleControlsPhonkGlobal.style.display = 'flex';
        if (activeStyle === 'phonkmix') {
            phonkCycleTimeContainer.style.display = 'block';
        } else {
            phonkCycleTimeContainer.style.display = 'none';
        }
    } else {
        styleControlsPhonkGlobal.style.display = 'none';
    }

    // Open the correct panel for the selected style
    if (activeStyle === 'zen') {
        zenCustomizerTrigger.style.display = 'block';
        zenCustomizerPanel.classList.remove('collapsed');
        updateFirefliesCount();
    } else if (activeStyle === 'vortex') {
        vortexCustomizerTrigger.style.display = 'block';
        vortexCustomizerPanel.classList.remove('collapsed');
        initVortexParticles();
    } else if (activeStyle === 'glitch') {
        glitchCustomizerTrigger.style.display = 'block';
        glitchCustomizerPanel.classList.remove('collapsed');
        glitchSlices = []; lightningBolts = [];
    } else if (activeStyle === 'inferno') {
        infernoCustomizerTrigger.style.display = 'block';
        infernoCustomizerPanel.classList.remove('collapsed');
        initInfernoRings();
        infernoParticles = [];
    } else if (activeStyle === 'phonkmix') {
        phonkmixCustomizerTrigger.style.display = 'block';
        phonkSubStyle = 'vortex';
        lastPhonkCycleTime = Date.now();
        initVortexParticles();
        vortexCustomizerPanel.classList.remove('collapsed');
        phonkmixLooksBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Customize: Chaos Vortex`;
    }
});

// Zen Mandala Drawer panel listeners
zenLooksBtn.addEventListener('click', () => { zenCustomizerPanel.classList.toggle('collapsed'); });
closeZenBtn.addEventListener('click', () => { zenCustomizerPanel.classList.add('collapsed'); });
sliderZenPetals.addEventListener('input', (e) => { valZenPetals.innerText = `${e.target.value} petals`; });
sliderZenSpeed.addEventListener('input', (e) => { valZenSpeed.innerText = `${e.target.value}x`; });
sliderZenScale.addEventListener('input', (e) => { valZenScale.innerText = `${e.target.value}x`; });
sliderZenFireflies.addEventListener('input', (e) => { valZenFireflies.innerText = e.target.value; updateFirefliesCount(); });

// Chaos Vortex Drawer listeners
vortexLooksBtn.addEventListener('click', () => { vortexCustomizerPanel.classList.toggle('collapsed'); });
closeVortexBtn.addEventListener('click', () => { vortexCustomizerPanel.classList.add('collapsed'); });
sliderVortexArms.addEventListener('input', (e) => { valVortexArms.innerText = e.target.value; initVortexParticles(); });
sliderVortexParticles.addEventListener('input', (e) => { valVortexParticles.innerText = e.target.value; syncVortexParticleCount(); });
sliderVortexSpin.addEventListener('input', (e) => { valVortexSpin.innerText = `${e.target.value}x`; });

// Glitch Storm Drawer listeners
glitchLooksBtn.addEventListener('click', () => { glitchCustomizerPanel.classList.toggle('collapsed'); });
closeGlitchBtn.addEventListener('click', () => { glitchCustomizerPanel.classList.add('collapsed'); });
sliderGlitchIntensity.addEventListener('input', (e) => { valGlitchIntensity.innerText = e.target.value; });
sliderGlitchChroma.addEventListener('input', (e) => { valGlitchChroma.innerText = `${e.target.value}px`; });
sliderGlitchScanlines.addEventListener('input', (e) => { valGlitchScanlines.innerText = `${e.target.value}%`; });

// Inferno Tunnel Drawer listeners
infernoLooksBtn.addEventListener('click', () => { infernoCustomizerPanel.classList.toggle('collapsed'); });
closeInfernoBtn.addEventListener('click', () => { infernoCustomizerPanel.classList.add('collapsed'); });
sliderInfernoSpeed.addEventListener('input', (e) => { valInfernoSpeed.innerText = `${e.target.value}x`; });
sliderInfernoDensity.addEventListener('input', (e) => { valInfernoDensity.innerText = e.target.value; initInfernoRings(); });

// --- Workspace Mode Panel listeners ---
// Capture the visualizer tab's own audio directly using the tabCapture API inside the extension page (preserves user gesture)
function captureWorkspaceAudio() {
    if (typeof chrome !== 'undefined' && chrome.tabCapture && chrome.tabCapture.capture) {
        chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
            if (chrome.runtime.lastError) {
                console.error("chrome.tabCapture.capture failed:", chrome.runtime.lastError.message);
                return;
            }
            if (stream) {
                initAudio();
                
                // Stop any existing stream tracks first to free up the media capture interface
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }
                
                isMicActive = false;
                audioStream = stream;
                
                if (source && source.disconnect) {
                    try { source.disconnect(); } catch (err) {}
                }
                
                source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.connect(audioContext.destination); // Play back to user speakers
                console.log("Workspace tab audio captured successfully!");
            }
        });
    } else if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // Fallback for Electron / Standalone App: use getDisplayMedia to capture system/window audio
        navigator.mediaDevices.getDisplayMedia({ audio: true, video: true }).then((stream) => {
            initAudio();
            
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
            isMicActive = false;
            audioStream = stream;
            
            if (source && source.disconnect) {
                try { source.disconnect(); } catch (err) {}
            }
            
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.connect(audioContext.destination); // Play back to user speakers
            console.log("Workspace desktop audio captured successfully!");
        }).catch(err => {
            console.error("getDisplayMedia failed:", err);
        });
    }
}

function loadWorkspaceUrl(url) {
    if (!url) return;
    
    // Check if it is a Spotify collection URL (private user Liked Songs / collections)
    if (url.includes('open.spotify.com/collection') || url.startsWith('spotify:collection') || url.includes('/collection/')) {
        workspaceAddressBar.value = url;
        workspacePlaceholder.style.display = 'none';
        workspaceIframe.style.display = 'none';
        if (workspaceSpotifyHelp) {
            workspaceSpotifyHelp.style.display = 'flex';
        }
        return;
    }
    
    const rewrittenUrl = cleanseAndRewriteUrl(url);
    workspaceIframe.src = rewrittenUrl;
    workspaceAddressBar.value = rewrittenUrl;
    
    // Hide placeholder and help screens, show iframe
    workspacePlaceholder.style.display = 'none';
    if (workspaceSpotifyHelp) {
        workspaceSpotifyHelp.style.display = 'none';
    }
    workspaceIframe.style.display = 'block';
    
    // Request own tab audio capture so waves react to this iframe
    captureWorkspaceAudio();
}

function resetWorkspace() {
    workspaceIframe.src = "";
    workspaceAddressBar.value = "";
    workspacePlaceholder.style.display = 'flex';
    if (workspaceSpotifyHelp) {
        workspaceSpotifyHelp.style.display = 'none';
    }
    workspaceIframe.style.display = 'none';
    if (placeholderSearchInput) {
        placeholderSearchInput.value = "";
    }
}

function toggleWorkspaceMode(active) {
    if (active === undefined) {
        isWorkspaceActive = !isWorkspaceActive;
    } else {
        isWorkspaceActive = active;
    }
    
    if (isWorkspaceActive) {
        document.body.classList.add('workspace-active');
        workspacePanel.classList.remove('collapsed');
    } else {
        document.body.classList.remove('workspace-active');
        workspacePanel.classList.add('collapsed');
        // Kept loaded on collapse so music/Spotify keeps playing in the background
    }
}

if (btnToggleWorkspace) {
    btnToggleWorkspace.addEventListener('click', () => { toggleWorkspaceMode(); });
}

if (closeWorkspaceBtn) {
    closeWorkspaceBtn.addEventListener('click', () => { 
        isWorkspaceLocked = false;
        if (btnWorkspaceLock) {
            btnWorkspaceLock.title = "Lock Panel Open";
            btnWorkspaceLock.style.background = "";
            btnWorkspaceLock.style.borderColor = "";
            btnWorkspaceLock.style.color = "";
            const icon = btnWorkspaceLock.querySelector('i');
            if (icon) icon.className = "fa-solid fa-lock-open";
        }
        toggleWorkspaceMode(false); 
        resetWorkspace(); // Explicit close stops the music and resets the iframe
    });
}

if (btnSpotifyHelpBack) {
    btnSpotifyHelpBack.addEventListener('click', () => {
        resetWorkspace();
    });
}

if (btnWorkspaceLock) {
    btnWorkspaceLock.addEventListener('click', () => {
        isWorkspaceLocked = !isWorkspaceLocked;
        const icon = btnWorkspaceLock.querySelector('i');
        if (isWorkspaceLocked) {
            btnWorkspaceLock.title = "Unlock Auto-Collapse";
            btnWorkspaceLock.style.background = "rgba(255, 0, 127, 0.25)";
            btnWorkspaceLock.style.borderColor = "rgba(255, 0, 127, 0.4)";
            btnWorkspaceLock.style.color = "#ff007f";
            if (icon) icon.className = "fa-solid fa-lock";
        } else {
            btnWorkspaceLock.title = "Lock Panel Open";
            btnWorkspaceLock.style.background = "";
            btnWorkspaceLock.style.borderColor = "";
            btnWorkspaceLock.style.color = "";
            if (icon) icon.className = "fa-solid fa-lock-open";
        }
    });
}

// Hover to open/close Workspace panel automatically based on mouse position
window.addEventListener('mousemove', (e) => {
    const width = window.innerWidth;
    if (!isWorkspaceActive) {
        // Slide open if cursor is within 15px of the right screen edge
        if (e.clientX >= width - 15) {
            toggleWorkspaceMode(true);
        }
    } else {
        // Slide closed if NOT locked, and cursor moves left past 50% of the screen width (spacious dead zone)
        if (!isWorkspaceLocked && e.clientX < width * 0.50) {
            toggleWorkspaceMode(false);
        }
    }
});

// Browser navigation logic
if (btnBrowserBack) {
    btnBrowserBack.addEventListener('click', () => {
        try {
            workspaceIframe.contentWindow.history.back();
        } catch(e) {
            console.warn("Back navigation blocked due to cross-origin security context.");
        }
    });
}

if (btnBrowserForward) {
    btnBrowserForward.addEventListener('click', () => {
        try {
            workspaceIframe.contentWindow.history.forward();
        } catch(e) {
            console.warn("Forward navigation blocked due to cross-origin security context.");
        }
    });
}

if (btnBrowserReload) {
    btnBrowserReload.addEventListener('click', () => {
        workspaceIframe.src = workspaceIframe.src;
    });
}

if (btnBrowserHome) {
    btnBrowserHome.addEventListener('click', () => {
        resetWorkspace();
    });
}

// Helper to parse, validate and rewrite Spotify / YouTube URLs to frame-friendly embed equivalents
function cleanseAndRewriteUrl(url) {
    url = url.trim();
    
    // Convert Spotify URI (e.g. spotify:playlist:xxxx) to standard URL format first
    if (/^spotify:[a-z]+:[a-zA-Z0-9]+/i.test(url)) {
        const parts = url.split(':');
        const type = parts[1]; // playlist, album, track, artist, etc.
        const id = parts[2];
        url = `https://open.spotify.com/${type}/${id}`;
    }
    
    // If it doesn't look like a URL (no dots or contains spaces), treat as a Google search query
    if (!url.includes('.') || url.includes(' ')) {
        return `https://www.google.com/search?igu=1&q=${encodeURIComponent(url)}`;
    }
    
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    try {
        const urlObj = new URL(url);
        
        // 1. Spotify Rewrite: open.spotify.com/playlist/... -> open.spotify.com/embed/playlist/...
        if (urlObj.hostname === 'open.spotify.com') {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            const isEmbed = pathParts[0] === 'embed';
            const type = isEmbed ? pathParts[1] : pathParts[0];
            
            // Only rewrite to /embed if it's a type Spotify supports embedding for
            const embeddableTypes = ['playlist', 'album', 'track', 'artist', 'show', 'episode'];
            if (embeddableTypes.includes(type)) {
                if (!isEmbed) {
                    urlObj.pathname = '/embed' + urlObj.pathname;
                    return urlObj.toString();
                }
            }
        }
        
        // 2. YouTube Rewrite: youtube.com/watch?v=... -> youtube.com/embed/...
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com' || urlObj.hostname === 'm.youtube.com') {
            if (urlObj.pathname === '/watch') {
                const videoId = urlObj.searchParams.get('v');
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}`;
                }
            }
        } else if (urlObj.hostname === 'youtu.be') {
            const videoId = urlObj.pathname.substring(1);
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }
        }
    } catch(e) {
        // Parsing failed, fallback to original
    }
    return url;
}

// Address bar input listener
if (workspaceAddressBar) {
    workspaceAddressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadWorkspaceUrl(workspaceAddressBar.value);
        }
    });
    workspaceAddressBar.addEventListener('paste', () => {
        setTimeout(() => {
            loadWorkspaceUrl(workspaceAddressBar.value);
        }, 50);
    });
}

// Placeholder search/URL bar listener
if (placeholderSearchInput) {
    placeholderSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadWorkspaceUrl(placeholderSearchInput.value);
        }
    });
    placeholderSearchInput.addEventListener('paste', () => {
        setTimeout(() => {
            loadWorkspaceUrl(placeholderSearchInput.value);
        }, 50);
    });
}
if (btnPlaceholderGo) {
    btnPlaceholderGo.addEventListener('click', () => {
        loadWorkspaceUrl(placeholderSearchInput.value);
    });
}

// Quick-launch bookmark shortcut buttons
document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        console.log("Quick-launch shortcut clicked, loading URL:", url);
        if (url) {
            loadWorkspaceUrl(url);
        }
    });
});

// Monitor iframe load events to update address bar text (within same-origin checks)
if (workspaceIframe) {
    workspaceIframe.addEventListener('load', () => {
        try {
            const currentUrl = workspaceIframe.contentWindow.location.href;
            if (currentUrl && currentUrl !== 'about:blank') {
                workspaceAddressBar.value = currentUrl;
                workspacePlaceholder.style.display = 'none';
                workspaceIframe.style.display = 'block';
            }
        } catch(e) {
            // Silently swallow cross-origin DOM errors; the address bar will stay at the typed URL
        }
    });
}

// Drag & Drop Tab/Link Listeners on Window
window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
        workspaceDragOverlay.style.display = 'flex';
    }
});

window.addEventListener('dragover', (e) => {
    e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        workspaceDragOverlay.style.display = 'none';
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    workspaceDragOverlay.style.display = 'none';
    
    let droppedText = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (droppedText) {
        droppedText = droppedText.trim();
        
        // If there are multiple lines (common with uri-list), grab the first non-empty line
        if (droppedText.includes('\n')) {
            const lines = droppedText.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    droppedText = line;
                    break;
                }
            }
        }
        
        if (droppedText) {
            toggleWorkspaceMode(true);
            loadWorkspaceUrl(droppedText);
        }
    }
});

// Phonk Global Settings listeners
sliderPhonkIntensity.addEventListener('input', (e) => {
    phonkIntensity = parseInt(e.target.value) / 100;
    valPhonkIntensity.innerText = `${e.target.value}%`;
});
sliderPhonkCycleTime.addEventListener('input', (e) => {
    valPhonkCycleTime.innerText = `${e.target.value}s`;
});
phonkmixLooksBtn.addEventListener('click', () => {
    // Toggle the active sub-style drawer panel
    if (phonkSubStyle === 'vortex') {
        vortexCustomizerPanel.classList.toggle('collapsed');
        glitchCustomizerPanel.classList.add('collapsed');
        infernoCustomizerPanel.classList.add('collapsed');
    } else if (phonkSubStyle === 'glitch') {
        glitchCustomizerPanel.classList.toggle('collapsed');
        vortexCustomizerPanel.classList.add('collapsed');
        infernoCustomizerPanel.classList.add('collapsed');
    } else if (phonkSubStyle === 'inferno') {
        infernoCustomizerPanel.classList.toggle('collapsed');
        vortexCustomizerPanel.classList.add('collapsed');
        glitchCustomizerPanel.classList.add('collapsed');
    }
});

// Style-specific sliders listeners
sliderBarDensity.addEventListener('input', (e) => {
    valBarDensity.innerText = `${e.target.value} bars`;
});
sliderPeakDecay.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    let decayText = 'Medium';
    if (val <= 3) decayText = 'Slow';
    else if (val >= 8) decayText = 'Fast';
    valPeakDecay.innerText = decayText;
});
sliderStarCount.addEventListener('input', (e) => {
    valStarCount.innerText = e.target.value;
    updateStarCount();
});
sliderWarpStretch.addEventListener('input', (e) => {
    valWarpStretch.innerText = `${e.target.value}x`;
});

// Custom Center Image file uploader
customImageBtn.addEventListener('click', () => {
    customImageInput.click();
});
customImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            logoImg = new Image();
            logoImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));

        tab.classList.add('active');
        const activeTabId = tab.getAttribute('data-tab');
        document.getElementById(activeTabId).classList.add('active');

        // Stop mic or music depending on tab transition
        if (activeTabId !== 'mic-tab' && isMicActive) {
            stopMicrophone();
        }
        if (activeTabId !== 'file-tab' && !audioElement.paused) {
            audioElement.pause();
            updatePlayPauseIcon();
        }
    });
});

// Themes selector
themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentTheme = btn.getAttribute('data-theme');
        const theme = THEMES[currentTheme];
        
        // Update CSS Variables dynamically
        document.documentElement.style.setProperty('--primary-color', theme.start);
        document.documentElement.style.setProperty('--secondary-color', theme.end);
        document.documentElement.style.setProperty('--glow-color', theme.glow);
    });
});

// Sliders listener
sliderSensitivity.addEventListener('input', (e) => {
    valSensitivity.innerText = `${e.target.value}x`;
});
sliderWaves.addEventListener('input', (e) => {
    valWaves.innerText = e.target.value;
});
sliderSpeed.addEventListener('input', (e) => {
    valSpeed.innerText = `${e.target.value}x`;
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('audio/')) {
        loadAudioFile(files[0]);
    }
});
dropZone.addEventListener('click', () => {
    fileInput.click();
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadAudioFile(e.target.files[0]);
    }
});

// --- 2. Audio Processing Logic ---

// Init audio analyzer
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; // High enough for detail, low enough for smooth rendering
        analyser.smoothingTimeConstant = 0.82; // Silky smooth audio update transitions
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }
    // Resume context if suspended (browser security autoplay policies)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Load audio file to local player
function loadAudioFile(file) {
    initAudio();
    
    // Stop mic stream if active
    if (isMicActive) stopMicrophone();

    // Extract album art from local file ID3 tags
    getMp3AlbumArt(file).then(artUrl => {
        if (artUrl) {
            logoImg = new Image();
            logoImg.src = artUrl;
        } else {
            logoImg = null; // Clear if no album art found
        }
    }).catch(err => {
        console.error("Failed to load album art:", err);
        logoImg = null;
    });

    const fileURL = URL.createObjectURL(file);
    audioElement.src = fileURL;
    trackName.innerText = file.name;
    playerPanel.style.display = 'flex';
    
    // Disconnect old source if exists
    if (source && source.disconnect) {
        try { source.disconnect(); } catch (err) {}
    }

    // Connect audio element source to analyser
    source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination); // Direct audio to speakers

    // Start playing
    audioElement.play().then(() => {
        updatePlayPauseIcon();
        // Save song to history in IndexedDB
        saveSong(file).catch(console.error);
    }).catch(err => {
        console.log("Play failed: ", err);
        // Save song anyway even if play fails (e.g. requires user interaction)
        saveSong(file).catch(console.error);
    });
}

// Play/Pause button
playPauseBtn.addEventListener('click', () => {
    initAudio();
    if (audioElement.paused) {
        audioElement.play();
    } else {
        audioElement.pause();
    }
    updatePlayPauseIcon();
});

function updatePlayPauseIcon() {
    const icon = playPauseBtn.querySelector('i');
    if (audioElement.paused) {
        icon.className = 'fa-solid fa-play';
    } else {
        icon.className = 'fa-solid fa-pause';
    }
}

// Progress bar slider
audioElement.addEventListener('timeupdate', () => {
    if (audioElement.duration) {
        const pct = (audioElement.currentTime / audioElement.duration) * 100;
        progressBar.value = pct;
        currentTimeLabel.innerText = formatTime(audioElement.currentTime);
        durationLabel.innerText = formatTime(audioElement.duration);
    }
});

progressBar.addEventListener('input', (e) => {
    if (audioElement.duration) {
        audioElement.currentTime = (e.target.value / 100) * audioElement.duration;
    }
});

volumeSlider.addEventListener('input', (e) => {
    audioElement.volume = e.target.value;
});

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// --- 3. Live Microphone Input ---

startMicBtn.addEventListener('click', () => {
    initAudio();
    
    if (isMicActive) {
        stopMicrophone();
    } else {
        startMicrophone();
    }
});

function startMicrophone() {
    // Pause file audio if playing
    if (!audioElement.paused) {
        audioElement.pause();
        updatePlayPauseIcon();
    }

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            audioStream = stream;
            isMicActive = true;
            startMicBtn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Disable Mic Sync';
            startMicBtn.classList.add('recording');
            
            // Disconnect old source
            if (source && source.disconnect) {
                try { source.disconnect(); } catch (err) {}
            }

            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            // NOTE: Do not connect analyser to destination for mic, to avoid feedback loops!


        })
        .catch(err => {
            console.error('Microphone access denied:', err);
            alert('Could not access microphone. Please check your browser permissions.');
        });
}

function stopMicrophone() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    isMicActive = false;
    startMicBtn.innerHTML = '<i class="fa-solid fa-power-off"></i> Enable Mic Sync';
    startMicBtn.classList.remove('recording');
}

// --- 4. Visualizer Rendering & Wave Logic ---

// Helpers
let lastBassEnergy = 0;

function hexToRgba(hex, alpha) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length == 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x' + c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return `rgba(255, 255, 255, ${alpha})`;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height <= 0 || width <= 0) return;
    if (radius > width / 2) radius = width / 2;
    if (radius > height / 2) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function updateStarCount() {
    if (!canvas.width) return;
    const count = parseInt(sliderStarCount.value);
    if (stars.length < count) {
        const toAdd = count - stars.length;
        for (let i = 0; i < toAdd; i++) {
            stars.push({
                x: (Math.random() - 0.5) * canvas.width * 1.8,
                y: (Math.random() - 0.5) * canvas.height * 1.8,
                z: Math.random() * canvas.width,
                color: Math.random() > 0.5 ? 'start' : 'end'
            });
        }
    } else if (stars.length > count) {
        stars.length = count;
    }
}

// ID3 Parser to extract cover art from uploaded audio files
function getMp3AlbumArt(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        // Read first 512KB of the file (ID3v2 tags are always at the start)
        const slice = file.slice(0, 512 * 1024);
        reader.onload = function(e) {
            try {
                const buffer = e.target.result;
                const view = new DataView(buffer);
                
                // Check for "ID3" header
                if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
                    resolve(null);
                    return;
                }
                
                let offset = 10; // Skip 10-byte ID3 header
                const totalSize = readUint28(view, 6);
                const limit = Math.min(buffer.byteLength, totalSize + 10);
                
                while (offset < limit - 10) {
                    // Frame ID is 4 bytes
                    const frameId = String.fromCharCode(
                        view.getUint8(offset),
                        view.getUint8(offset + 1),
                        view.getUint8(offset + 2),
                        view.getUint8(offset + 3)
                    );
                    
                    // Frame size is 4 bytes
                    const frameSize = view.getUint32(offset + 4);
                    
                    if (frameSize === 0 || offset + 10 + frameSize > limit) {
                        break;
                    }
                    
                    // "APIC" is the ID3v2 attached picture frame
                    if (frameId === "APIC") {
                        const dataStart = offset + 10;
                        const encoding = view.getUint8(dataStart);
                        
                        // Find MIME type (null-terminated string)
                        let mimeOffset = dataStart + 1;
                        let mimeType = "";
                        while (view.getUint8(mimeOffset) !== 0x00 && mimeOffset < dataStart + frameSize) {
                            mimeType += String.fromCharCode(view.getUint8(mimeOffset));
                            mimeOffset++;
                        }
                        
                        // Skip null byte
                        let picTypeOffset = mimeOffset + 1;
                        
                        // Skip description (null-terminated string)
                        let descOffset = picTypeOffset + 1;
                        if (encoding === 1 || encoding === 2) {
                            // UTF-16 uses double null termination
                            while (!(view.getUint8(descOffset) === 0x00 && view.getUint8(descOffset + 1) === 0x00) && descOffset < dataStart + frameSize) {
                                descOffset += 2;
                            }
                            descOffset += 2;
                        } else {
                            // ASCII / UTF-8 uses single null
                            while (view.getUint8(descOffset) !== 0x00 && descOffset < dataStart + frameSize) {
                                descOffset++;
                            }
                            descOffset += 1;
                        }
                        
                        // Remaining bytes are the image data
                        const picDataStart = descOffset;
                        const picDataSize = frameSize - (picDataStart - dataStart);
                        
                        const picBuffer = buffer.slice(picDataStart, picDataStart + picDataSize);
                        const blob = new Blob([picBuffer], { type: mimeType });
                        const objectUrl = URL.createObjectURL(blob);
                        resolve(objectUrl);
                        return;
                    }
                    
                    offset += 10 + frameSize;
                }
                resolve(null);
            } catch (err) {
                console.error("Error reading ID3 tags:", err);
                resolve(null);
            }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(slice);
    });
}

function readUint28(view, offset) {
    return (view.getUint8(offset) << 21) |
           (view.getUint8(offset + 1) << 14) |
           (view.getUint8(offset + 2) << 7) |
           view.getUint8(offset + 3);
}

function render() {
    // 1. Draw Background trail effect for glow
    ctx.fillStyle = 'rgba(7, 8, 13, 0.15)'; // Trail length
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let bassEnergy = 0;
    let midEnergy = 0;
    let trebleEnergy = 0;

    // 2. Fetch Audio Data if connected
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);

        // Extract frequencies
        // Bass: first ~12 frequencies
        let bassSum = 0;
        for (let i = 0; i < 12; i++) bassSum += dataArray[i];
        bassEnergy = bassSum / (12 * 255);

        // Mids: index 12 to 90
        let midSum = 0;
        for (let i = 12; i < 90; i++) midSum += dataArray[i];
        midEnergy = midSum / (78 * 255);

        // Treble: index 90 to 200
        let trebleSum = 0;
        for (let i = 90; i < 200; i++) trebleSum += dataArray[i];
        trebleEnergy = trebleSum / (110 * 255);
    }

    // Update propagating wave ripples
    for (let i = waveRipples.length - 1; i >= 0; i--) {
        waveRipples[i].radius += waveRipples[i].speed;
        waveRipples[i].amplitude *= waveRipples[i].decay;
        if (waveRipples[i].amplitude < 0.1 || waveRipples[i].radius > canvas.width) {
            waveRipples.splice(i, 1);
        }
    }

    // Interactive sliders config
    const sensitivity = parseFloat(sliderSensitivity.value);
    const speedConfig = parseFloat(sliderSpeed.value);
    const numWaves = parseInt(sliderWaves.value);
    const themeColors = THEMES[currentTheme];

    // Dynamic theme overrides (RGB Rainbow Mode)
    let activeStartColor = themeColors.start;
    let activeEndColor = themeColors.end;
    let activeGlowColor = themeColors.glow;
    
    if (toggleRgb.checked) {
        // Increment hue over time
        rgbHue = (rgbHue + speedConfig * 0.8) % 360;
        activeStartColor = `hsl(${rgbHue}, 100%, 60%)`;
        activeEndColor = `hsl(${(rgbHue + 120) % 360}, 100%, 60%)`;
        activeGlowColor = `hsla(${rgbHue}, 100%, 60%, 0.45)`;
    }

    // Apply exponential low-pass filter to audio energies to prevent visuals from twitching
    smoothBass = smoothBass * 0.84 + bassEnergy * 0.16;
    smoothMid = smoothMid * 0.84 + midEnergy * 0.16;
    smoothTreble = smoothTreble * 0.84 + trebleEnergy * 0.16;

    // Auto-Cycle Phonk Mode Logic
    if (activeStyle === 'phonkmix') {
        const cycleInterval = parseInt(sliderPhonkCycleTime.value) || 15;
        if (Date.now() - lastPhonkCycleTime > cycleInterval * 1000) {
            // Find next style index
            const currentIdx = phonkStylesList.indexOf(phonkSubStyle);
            const nextIdx = (currentIdx + 1) % phonkStylesList.length;
            phonkSubStyle = phonkStylesList[nextIdx];
            lastPhonkCycleTime = Date.now();
            
            // Trigger transition glitch
            phonkTransitionTimer = 15; // 15 frames transition
            
            // Initialize the new sub-style
            if (phonkSubStyle === 'vortex') {
                initVortexParticles();
            } else if (phonkSubStyle === 'glitch') {
                glitchSlices = [];
                lightningBolts = [];
            } else if (phonkSubStyle === 'inferno') {
                initInfernoRings();
                infernoParticles = [];
            }
            
            // Update UI customizer label dynamically if visible
            const activeName = phonkSubStyle === 'vortex' ? 'Chaos Vortex' : 
                               phonkSubStyle === 'glitch' ? 'Glitch Storm' : 'Inferno Tunnel';
            phonkmixLooksBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Customize: ${activeName}`;
        }
    }

    // Speed up phase based on music beat (treble / mids)
    const baseSpeed = 0.008 * speedConfig;
    const audioSpeedMultiplier = 1 + (smoothTreble + smoothMid) * 1.5;
    wavePhase += baseSpeed * audioSpeedMultiplier;
    
    // Dynamic dashboard pulse based on smoothed bass energy
    if (dashboard) {
        if (dashboard.classList.contains('collapsed')) {
            dashboard.style.transform = 'translateX(-400px)';
            dashboard.style.boxShadow = '';
        } else {
            const scaleVal = 1 + (smoothBass * 0.014); // subtle pulse
            dashboard.style.transform = `scale(${scaleVal})`;
            dashboard.style.boxShadow = `0 12px 40px 0 rgba(0, 0, 0, 0.5), 0 0 ${10 + smoothBass * 35}px ${hexToRgba(activeStartColor, 0.15 + smoothBass * 0.35)}`;
        }
    }

    const centerY = canvas.height * 0.55; // Slightly lower than center
    
    // Animate centerX smoothly to slide the entire visualizer when Workspace is active
    const targetCenterX = isWorkspaceActive ? canvas.width * 0.335 : canvas.width / 2;
    if (currentCenterX === null) {
        currentCenterX = targetCenterX;
    } else {
        currentCenterX += (targetCenterX - currentCenterX) * 0.085; // smooth sliding interpolation
    }
    const centerX = currentCenterX;
    const width = canvas.width;

    // 3a. Screen-edge Beat Glow (Vignette)
    if (smoothBass > 0.05) {
        ctx.save();
        const glowGrad = ctx.createRadialGradient(
            centerX, centerY, 10,
            centerX, centerY, Math.max(canvas.width, canvas.height) * 0.8
        );
        glowGrad.addColorStop(0, 'rgba(7, 8, 13, 0)');
        const opacity = smoothBass * 0.35; // Dynamic opacity based on bass intensity
        glowGrad.addColorStop(1, hexToRgba(activeStartColor, opacity));
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // 3b. Beat Detection & Concentric Shockwaves (uses raw bassEnergy to fire beats instantly without smoothing delay)
    const beatThreshold = 0.38;
    const energyDifference = bassEnergy - lastBassEnergy;
    if (bassEnergy > beatThreshold && energyDifference > 0.05 && toggleParticles.checked) {
        // Spawn a physical wave-packet ripple along the flowing waves on beats
        waveRipples.push({
            x: centerX,
            radius: 0,
            amplitude: 38 * energyDifference * sensitivity, // scale ripple amplitude with beat intensity
            decay: 0.955,
            speed: 16
        });

        // Trigger full-screen GPU-based water ripple warp on bass hits
        screenRipples[nextRippleIndex].progress = 0.01;
        screenRipples[nextRippleIndex].maxScale = 45 + Math.min(185, 160 * energyDifference * sensitivity); // Highly noticeable displacement scale!
        nextRippleIndex = (nextRippleIndex + 1) % screenRipples.length;
    }
    lastBassEnergy = bassEnergy;

    // 3c. Render Background Style Animation
    const currentRenderStyle = (activeStyle === 'phonkmix') ? phonkSubStyle : activeStyle;
    if (currentRenderStyle === 'classic') {
        const wavesEnabled = toggleWaves.checked;
        
        if (wavesEnabled) {
            ctx.save();
            
            // Draw waves overlapping
            for (let w = 0; w < numWaves; w++) {
                // Different offset parameters for each wave
                const waveOffset = w * (Math.PI / numWaves);
                
                // Modulate amplitude based on smoothed Bass energy
                const amplitudeMod = 50 + (smoothBass * 180 * sensitivity);
                // Vary base amplitude slightly per wave
                const amplitude = amplitudeMod * (1.1 - w * 0.12); 

                // Modulate wave frequency (wavelength) based on smoothed mid/treble audio energy
                const baseFrequency = 0.003 + (w * 0.0005);
                const waveFrequency = baseFrequency * (1 + (smoothMid * 0.5));

                // Create beautiful gradient stroke
                const gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, activeStartColor);
                gradient.addColorStop(0.5, activeEndColor);
                gradient.addColorStop(1, activeStartColor);

                // Precompute wave path points to support fills & spikes
                const points = [];
                for (let x = 0; x <= width; x += 8) {
                    const edgeTaper = Math.sin(Math.PI * (x / width));
                    let waveY;
                    
                    const waveStyle = selectWaveStyle.value;
                    if (waveStyle === 'spikes') {
                        const s1 = Math.sin(x * waveFrequency + wavePhase + waveOffset);
                        const s2 = Math.cos(x * (waveFrequency * 2.2) - (wavePhase * 0.7) + waveOffset);
                        const combined = (s1 + s2 * 0.3) * edgeTaper;
                        const spikyCombined = Math.sign(combined) * Math.pow(Math.abs(combined), 2.0);
                        waveY = centerY + spikyCombined * amplitude;
                    } else if (waveStyle === 'noise') {
                        const noise1 = Math.sin(x * waveFrequency + wavePhase + waveOffset);
                        const noise2 = Math.sin(x * waveFrequency * 3.5 - wavePhase * 1.8) * 0.25;
                        const noise3 = Math.cos(x * waveFrequency * 7.2 + wavePhase * 2.5) * 0.12;
                        const combinedNoise = (noise1 + noise2 + noise3) * edgeTaper;
                        waveY = centerY + combinedNoise * amplitude;
                    } else { // 'sine'
                        const s1 = Math.sin(x * waveFrequency + wavePhase + waveOffset);
                        const s2 = Math.cos(x * (waveFrequency * 1.6) - (wavePhase * 0.8) + waveOffset);
                        const combined = (s1 + s2 * 0.25) * edgeTaper;
                        waveY = centerY + combined * amplitude;
                    }

                    // Interactive mouse ripple push
                    if (mouse.x !== null && mouse.y !== null) {
                        const dx = x - mouse.x;
                        const dy = waveY - mouse.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < mouse.radius) {
                            const force = (mouse.radius - dist) / mouse.radius;
                            waveY += (waveY - mouse.y) * force * 0.38;
                        }
                    }

                    // Apply radial coordinate displacement ripple distortion
                    const warped = displacePoint(x, waveY);
                    points.push(warped);
                }

                // Draw Wave Fill under the curves if enabled (using smooth quadratic curves)
                const waveFillEnabled = toggleWaveFill.checked;
                if (waveFillEnabled && points.length > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(0, canvas.height);
                    ctx.lineTo(points[0].x, points[0].y);
                    
                    // Midpoint quadratic interpolation to make fill curves completely smooth
                    for (let i = 1; i < points.length - 1; i++) {
                        const xc = (points[i].x + points[i + 1].x) / 2;
                        const yc = (points[i].y + points[i + 1].y) / 2;
                        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                    }
                    
                    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
                    ctx.lineTo(width, canvas.height);
                    ctx.closePath();

                    const fillOpacity = 0.08;
                    const fillGrad = ctx.createLinearGradient(0, centerY - amplitude, 0, canvas.height);
                    fillGrad.addColorStop(0, hexToRgba(activeStartColor, fillOpacity * (1.2 - w / numWaves)));
                    fillGrad.addColorStop(1, 'rgba(7, 8, 13, 0)');
                    ctx.fillStyle = fillGrad;
                    ctx.fill();
                    ctx.restore();
                }

                // Draw Wave Outline (using smooth quadratic curves connecting midpoints)
                if (points.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(points[0].x, points[0].y);
                    
                    for (let i = 1; i < points.length - 1; i++) {
                        const xc = (points[i].x + points[i + 1].x) / 2;
                        const yc = (points[i].y + points[i + 1].y) / 2;
                        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                    }
                    
                    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = (3.5 - w * 0.4);
                    
                    const lineOpacity = 0.2;
                    ctx.globalAlpha = lineOpacity + (0.5 * (1 - w / numWaves)) + (smoothBass * 0.2);
                    
                    if (toggleGlow.checked) {
                        ctx.shadowColor = activeGlowColor;
                        ctx.shadowBlur = 18 + (smoothBass * 15);
                    } else {
                        ctx.shadowBlur = 0;
                    }
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    } else if (currentRenderStyle === 'bars') {
        ctx.save();
        const numBars = parseInt(sliderBarDensity.value);
        const layout = selectBarsLayout.value;
        const peakHoldEnabled = togglePeakHold.checked;
        
        // Ensure barPeaks is sized correctly
        if (barPeaks.length !== numBars) {
            barPeaks = new Array(numBars).fill(0);
        }
        
        const decayScale = parseInt(sliderPeakDecay.value);
        const decayFactor = 0.995 - (decayScale * 0.0065);
        const minDecayStep = 1.2;

        if (toggleGlow.checked) {
            ctx.shadowColor = activeGlowColor;
            ctx.shadowBlur = 12 + (smoothBass * 10);
        }

        const padding = 4;
        const totalPaddingWidth = padding * (numBars + 1);
        const barWidth = (canvas.width - totalPaddingWidth) / numBars;

        for (let i = 0; i < numBars; i++) {
            // Logarithmic mapping: match active musical range (indices 3 to 115) instead of empty treble
            const binCount = dataArray ? dataArray.length : 128;
            const maxActiveBin = Math.min(115, binCount - 1);
            const logIndex = 3 + Math.min(
                maxActiveBin - 3,
                Math.round(Math.pow(i / numBars, 1.35) * (maxActiveBin - 3))
            );
            
            const freqVal = dataArray ? dataArray[logIndex] : 0;
            const freqNorm = freqVal / 255;
            
            // Apply a gentle quadratic high-frequency pre-emphasis boost to avoid clipping the mid-range
            const hfBoost = 1.0 + Math.pow(i / numBars, 1.8) * 0.9;
            let finalNorm = freqNorm * hfBoost;
            if (finalNorm > 1.0) finalNorm = 1.0;

            if (layout === 'classic') {
                const targetHeight = finalNorm * canvas.height * 0.52 * sensitivity;
                if (targetHeight >= barPeaks[i]) {
                    barPeaks[i] = targetHeight;
                } else {
                    barPeaks[i] -= (barPeaks[i] - targetHeight) * (1 - decayFactor) + minDecayStep;
                    if (barPeaks[i] < 0) barPeaks[i] = 0;
                }
                
                const x = padding + i * (barWidth + padding);
                const y = canvas.height - targetHeight;
                
                if (targetHeight > 1) {
                    const pTL = displacePoint(x, y);
                    const pTR = displacePoint(x + barWidth, y);
                    const pBL = displacePoint(x, canvas.height);
                    const pBR = displacePoint(x + barWidth, canvas.height);
                    
                    const barGrad = ctx.createLinearGradient(x, canvas.height, x, y);
                    barGrad.addColorStop(0, activeStartColor);
                    barGrad.addColorStop(1, activeEndColor);
                    ctx.fillStyle = barGrad;
                    
                    ctx.beginPath();
                    ctx.moveTo(pBL.x, pBL.y);
                    ctx.lineTo(pTL.x, pTL.y);
                    ctx.lineTo(pTR.x, pTR.y);
                    ctx.lineTo(pBR.x, pBR.y);
                    ctx.closePath();
                    ctx.fill();
                }
                
                if (peakHoldEnabled) {
                    const peakY = canvas.height - barPeaks[i] - 6;
                    const pPeak = displacePoint(x + barWidth / 2, peakY);
                    ctx.fillStyle = activeEndColor;
                    ctx.beginPath();
                    ctx.arc(pPeak.x, pPeak.y, Math.max(1.5, barWidth / 2), 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (layout === 'symmetric') {
                const targetHeight = finalNorm * canvas.height * 0.31 * sensitivity;
                if (targetHeight >= barPeaks[i]) {
                    barPeaks[i] = targetHeight;
                } else {
                    barPeaks[i] -= (barPeaks[i] - targetHeight) * (1 - decayFactor) + minDecayStep;
                    if (barPeaks[i] < 0) barPeaks[i] = 0;
                }
                
                const x = padding + i * (barWidth + padding);
                const centerY = canvas.height / 2;
                
                if (targetHeight > 1) {
                    const pTL = displacePoint(x, centerY - targetHeight);
                    const pTR = displacePoint(x + barWidth, centerY - targetHeight);
                    const pBL = displacePoint(x, centerY);
                    const pBR = displacePoint(x + barWidth, centerY);
                    
                    const pTL_b = displacePoint(x, centerY);
                    const pTR_b = displacePoint(x + barWidth, centerY);
                    const pBL_b = displacePoint(x, centerY + targetHeight);
                    const pBR_b = displacePoint(x + barWidth, centerY + targetHeight);
                    
                    const barGrad = ctx.createLinearGradient(x, centerY + targetHeight, x, centerY - targetHeight);
                    barGrad.addColorStop(0, activeStartColor);
                    barGrad.addColorStop(0.5, activeEndColor);
                    barGrad.addColorStop(1, activeStartColor);
                    ctx.fillStyle = barGrad;
                    
                    // Top half
                    ctx.beginPath();
                    ctx.moveTo(pBL.x, pBL.y);
                    ctx.lineTo(pTL.x, pTL.y);
                    ctx.lineTo(pTR.x, pTR.y);
                    ctx.lineTo(pBR.x, pBR.y);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Bottom half
                    ctx.beginPath();
                    ctx.moveTo(pTL_b.x, pTL_b.y);
                    ctx.lineTo(pBL_b.x, pBL_b.y);
                    ctx.lineTo(pBR_b.x, pBR_b.y);
                    ctx.lineTo(pTR_b.x, pTR_b.y);
                    ctx.closePath();
                    ctx.fill();
                }
                
                if (peakHoldEnabled) {
                    ctx.fillStyle = activeEndColor;
                    const pPeakTop = displacePoint(x + barWidth / 2, centerY - barPeaks[i] - 3);
                    const pPeakBottom = displacePoint(x + barWidth / 2, centerY + barPeaks[i] + 3);
                    
                    ctx.beginPath();
                    ctx.arc(pPeakTop.x, pPeakTop.y, Math.max(1.5, barWidth / 2), 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.arc(pPeakBottom.x, pPeakBottom.y, Math.max(1.5, barWidth / 2), 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (layout === 'radial') {
                const baseRadius = toggleCenterCore.checked ? (110 + (smoothBass * 45)) : 160;
                const angle = (i * Math.PI * 2) / numBars;
                const targetHeight = finalNorm * 180 * sensitivity;
                
                if (targetHeight >= barPeaks[i]) {
                    barPeaks[i] = targetHeight;
                } else {
                    barPeaks[i] -= (barPeaks[i] - targetHeight) * (1 - decayFactor) + minDecayStep;
                    if (barPeaks[i] < 0) barPeaks[i] = 0;
                }
                
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                
                const x1 = centerX + cos * baseRadius;
                const y1 = centerY + sin * baseRadius;
                const x2 = centerX + cos * (baseRadius + targetHeight);
                const y2 = centerY + sin * (baseRadius + targetHeight);
                
                const p1 = displacePoint(x1, y1);
                const p2 = displacePoint(x2, y2);
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = activeStartColor;
                ctx.lineWidth = Math.max(1.5, Math.min(10, (2 * Math.PI * baseRadius) / numBars * 0.8));
                ctx.lineCap = 'round';
                ctx.stroke();
                
                if (peakHoldEnabled) {
                    const px = centerX + cos * (baseRadius + barPeaks[i] + 4);
                    const py = centerY + sin * (baseRadius + barPeaks[i] + 4);
                    const pPeak = displacePoint(px, py);
                    ctx.beginPath();
                    ctx.arc(pPeak.x, pPeak.y, Math.max(1.5, ctx.lineWidth / 2), 0, Math.PI * 2);
                    ctx.fillStyle = activeEndColor;
                    ctx.fill();
                }
            } else if (layout === 'retro') {
                const targetHeight = finalNorm * canvas.height * 0.52 * sensitivity;
                if (targetHeight >= barPeaks[i]) {
                    barPeaks[i] = targetHeight;
                } else {
                    barPeaks[i] -= (barPeaks[i] - targetHeight) * (1 - decayFactor) + minDecayStep;
                    if (barPeaks[i] < 0) barPeaks[i] = 0;
                }
                
                const x = padding + i * (barWidth + padding);
                
                const blockSize = 8;
                const blockSpacing = 3;
                const numBlocks = Math.floor(targetHeight / (blockSize + blockSpacing));
                
                for (let b = 0; b < numBlocks; b++) {
                    const y = canvas.height - (b * (blockSize + blockSpacing)) - blockSize;
                    const heightPercent = (b * (blockSize + blockSpacing)) / (canvas.height * 0.65);
                    
                    const p = displacePoint(x + barWidth / 2, y + blockSize / 2);
                    
                    if (heightPercent < 0.4) {
                        ctx.fillStyle = activeStartColor;
                    } else if (heightPercent < 0.8) {
                        ctx.fillStyle = activeEndColor;
                    } else {
                        ctx.fillStyle = '#ff003c';
                    }
                    
                    drawRoundedRect(ctx, p.x - barWidth / 2, p.y - blockSize / 2, barWidth, blockSize, 1.5);
                }
                
                if (peakHoldEnabled && barPeaks[i] > 1) {
                    const peakY = canvas.height - barPeaks[i] - 6;
                    const pPeak = displacePoint(x + barWidth / 2, peakY + 1.5);
                    ctx.fillStyle = '#ff003c';
                    drawRoundedRect(ctx, pPeak.x - barWidth / 2, pPeak.y - 1.5, barWidth, 3, 1.5);
                }
            }
        }
        ctx.restore();
    } else if (currentRenderStyle === 'starfield') {
        ctx.save();
        
        const starCount = parseInt(sliderStarCount.value);
        if (stars.length !== starCount) {
            updateStarCount();
        }
        
        const speedVal = speedConfig * 5 + (smoothTreble + smoothMid) * 35;
        const stretchVal = parseFloat(sliderWarpStretch.value) * (1 + (smoothTreble + smoothMid) * 2);
        
        stars.forEach(star => {
            star.z -= speedVal;
            
            if (star.z <= 0) {
                star.z = canvas.width;
                star.x = (Math.random() - 0.5) * canvas.width * 1.8;
                star.y = (Math.random() - 0.5) * canvas.height * 1.8;
            }
            
            const px = (star.x / star.z) * canvas.width * 0.7 + centerX;
            const py = (star.y / star.z) * canvas.height * 0.7 + centerY;
            
            if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) {
                star.z = canvas.width;
                star.x = (Math.random() - 0.5) * canvas.width * 1.8;
                star.y = (Math.random() - 0.5) * canvas.height * 1.8;
                return;
            }
            
            const pxPrev = (star.x / (star.z + stretchVal * 12)) * canvas.width * 0.7 + centerX;
            const pyPrev = (star.y / (star.z + stretchVal * 12)) * canvas.height * 0.7 + centerY;
            
            const alpha = Math.min(1.0, (1 - star.z / canvas.width) * 1.8);
            ctx.strokeStyle = hexToRgba(star.color === 'start' ? activeStartColor : activeEndColor, alpha);
            ctx.lineWidth = Math.min(3.5, (1 - star.z / canvas.width) * 3 + 0.5);
            
            if (toggleGlow.checked) {
                ctx.shadowColor = star.color === 'start' ? activeStartColor : activeEndColor;
                ctx.shadowBlur = 4 + (smoothBass * 8);
            }
            
            ctx.beginPath();
            ctx.moveTo(pxPrev, pyPrev);
            ctx.lineTo(px, py);
            ctx.stroke();
        });
        
    } else if (currentRenderStyle === 'zen') {
        // 1. Update and draw background fireflies
        if (fireflies.length > 0) {
            fireflies.forEach(firefly => {
                firefly.draw(ctx);
            });
        }

        // 2. Setup colors and scale
        const scale = parseFloat(sliderZenScale.value);
        const theme = selectZenTheme.value;
        const petalCount = parseInt(sliderZenPetals.value);
        
        let auraColors = {
            inner: 'rgba(255, 223, 100, 0.25)',
            outer: 'rgba(255, 140, 0, 0)'
        };
        let petalColors = {
            start: '#ffd700',
            end: '#ff8c00',
            glow: '#ff4500'
        };
        
        if (theme === 'lotus') {
            auraColors = {
                inner: 'rgba(255, 105, 180, 0.25)',
                outer: 'rgba(138, 43, 226, 0)'
            };
            petalColors = {
                start: '#ff69b4',
                end: '#8a2be2',
                glow: '#da70d6'
            };
        } else if (theme === 'aurora') {
            auraColors = {
                inner: 'rgba(0, 255, 135, 0.25)',
                outer: 'rgba(0, 114, 255, 0)'
            };
            petalColors = {
                start: '#00ff87',
                end: '#00c6ff',
                glow: '#60efff'
            };
        } else if (theme === 'cosmic') {
            auraColors = {
                inner: 'rgba(75, 0, 130, 0.3)',
                outer: 'rgba(0, 0, 255, 0)'
            };
            petalColors = {
                start: '#4b0082',
                end: '#0000ff',
                glow: '#1e90ff'
            };
        }

        // 3. Draw central glowing aura
        ctx.save();
        const auraRadius = (180 + (smoothBass * 100)) * scale;
        const auraGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, auraRadius);
        auraGrad.addColorStop(0, auraColors.inner);
        auraGrad.addColorStop(1, auraColors.outer);
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. Update rotation
        const rotationSpeedMultiplier = parseFloat(sliderZenSpeed.value);
        zenRotationAngle += 0.0035 * rotationSpeedMultiplier * speedConfig;

        // 5. Helper function for drawing a layer of petals
        const drawPetalLayer = (numPetals, baseRadius, petalLength, angleOffset, colorStart, colorEnd, opacity) => {
            ctx.save();
            ctx.globalAlpha = opacity;
            
            if (toggleGlow.checked) {
                ctx.shadowColor = petalColors.glow;
                ctx.shadowBlur = 10 + (smoothBass * 18);
            }
            
            for (let i = 0; i < numPetals; i++) {
                const angle = angleOffset + (i * Math.PI * 2) / numPetals;
                
                // Base point on base circle
                const xBase = centerX + Math.cos(angle) * baseRadius;
                const yBase = centerY + Math.sin(angle) * baseRadius;
                
                // Tip point
                const xTip = centerX + Math.cos(angle) * (baseRadius + petalLength);
                const yTip = centerY + Math.sin(angle) * (baseRadius + petalLength);
                
                // Control points bulge out sideways
                const leftAngle = angle - Math.PI / numPetals * 0.7;
                const rightAngle = angle + Math.PI / numPetals * 0.7;
                
                const bulgeRadius = baseRadius + petalLength * 0.45;
                const xCtrlLeft = centerX + Math.cos(leftAngle) * bulgeRadius;
                const yCtrlLeft = centerY + Math.sin(leftAngle) * bulgeRadius;
                
                const xCtrlRight = centerX + Math.cos(rightAngle) * bulgeRadius;
                const yCtrlRight = centerY + Math.sin(rightAngle) * bulgeRadius;
                
                // Apply coordinate displacement ripple distortion
                const ptBase = displacePoint(xBase, yBase);
                const ptTip = displacePoint(xTip, yTip);
                const ptCtrlLeft = displacePoint(xCtrlLeft, yCtrlLeft);
                const ptCtrlRight = displacePoint(xCtrlRight, yCtrlRight);
                
                // Create gradient along the petal length
                const petalGrad = ctx.createLinearGradient(ptBase.x, ptBase.y, ptTip.x, ptTip.y);
                petalGrad.addColorStop(0, colorStart);
                petalGrad.addColorStop(1, colorEnd);
                ctx.fillStyle = petalGrad;
                
                ctx.beginPath();
                ctx.moveTo(ptBase.x, ptBase.y);
                ctx.quadraticCurveTo(ptCtrlLeft.x, ptCtrlLeft.y, ptTip.x, ptTip.y);
                ctx.quadraticCurveTo(ptCtrlRight.x, ptCtrlRight.y, ptBase.x, ptBase.y);
                ctx.closePath();
                ctx.fill();
                
                // Draw a subtle spine down the center
                ctx.beginPath();
                ctx.moveTo(ptBase.x, ptBase.y);
                ctx.lineTo(ptTip.x, ptTip.y);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1.0;
                ctx.stroke();
            }
            ctx.restore();
        };

        // 6. Draw Outer Sacred Orbit Ring (below petals)
        if (toggleZenRing.checked) {
            ctx.save();
            ctx.strokeStyle = petalColors.start;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 12]);
            if (toggleGlow.checked) {
                ctx.shadowColor = petalColors.glow;
                ctx.shadowBlur = 12 + (smoothBass * 10);
            }
            
            const ringRadius = (150 + smoothBass * 60) * scale;
            ctx.beginPath();
            
            const numSegments = 120;
            for (let j = 0; j <= numSegments; j++) {
                const angle = (j * Math.PI * 2) / numSegments;
                const rx = centerX + Math.cos(angle) * ringRadius;
                const ry = centerY + Math.sin(angle) * ringRadius;
                const pt = displacePoint(rx, ry);
                
                if (j === 0) {
                    ctx.moveTo(pt.x, pt.y);
                } else {
                    ctx.lineTo(pt.x, pt.y);
                }
            }
            ctx.stroke();
            ctx.restore();
        }

        // 7. Draw Petal Layers
        // Outer Layer: large, breathes with Bass
        drawPetalLayer(
            petalCount, 
            30 * scale, 
            (110 + smoothBass * 75) * scale, 
            zenRotationAngle, 
            petalColors.start, 
            petalColors.end, 
            0.45
        );
        
        // Middle Layer: medium, offset rotation, breathes with Mids
        drawPetalLayer(
            petalCount, 
            20 * scale, 
            (75 + smoothMid * 55) * scale, 
            -zenRotationAngle * 0.8 + Math.PI / petalCount, 
            petalColors.start, 
            petalColors.end, 
            0.7
        );
        
        // Inner Layer: small, offset rotation, breathes with Treble
        drawPetalLayer(
            petalCount, 
            10 * scale, 
            (45 + smoothTreble * 35) * scale, 
            zenRotationAngle * 1.2 + Math.PI / (petalCount * 2), 
            '#ffffff', 
            petalColors.start, 
            0.9
        );

        // 8. Draw Central Seed/Core
        ctx.save();
        const seedRadius = (12 + smoothBass * 6) * scale;
        const seedGrad = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, seedRadius);
        seedGrad.addColorStop(0, '#ffffff');
        seedGrad.addColorStop(0.5, petalColors.start);
        seedGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = seedGrad;
        
        ctx.beginPath();
        const numCorePoints = 36;
        for (let j = 0; j <= numCorePoints; j++) {
            const angle = (j * Math.PI * 2) / numCorePoints;
            const rx = centerX + Math.cos(angle) * seedRadius;
            const ry = centerY + Math.sin(angle) * seedRadius;
            const pt = displacePoint(rx, ry);
            if (j === 0) {
                ctx.moveTo(pt.x, pt.y);
            } else {
                ctx.lineTo(pt.x, pt.y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }  // end zen else-if block

// ---- CHAOS VORTEX RENDER ----
    else if (currentRenderStyle === 'vortex') {
        const vCX = centerX;
        const vCY = canvas.height / 2;

        const vTheme = selectVortexTheme.value;
        let vColor1 = '#ff003c', vColor2 = '#ff6600', vGlow = '#ff003c';
        if (vTheme === 'electric') { vColor1 = '#bf00ff'; vColor2 = '#7700ff'; vGlow = '#bf00ff'; }
        else if (vTheme === 'ice') { vColor1 = '#00c6ff'; vColor2 = '#ffffff'; vGlow = '#00c6ff'; }
        else if (vTheme === 'toxic') { vColor1 = '#00ff44'; vColor2 = '#aaff00'; vGlow = '#00ff44'; }

        const spinSpeed = parseFloat(sliderVortexSpin.value) * speedConfig;
        const scaledBass = smoothBass * phonkIntensity;

        // Dark centre core gradient — perfectly centered
        ctx.save();
        const coreGrad = ctx.createRadialGradient(vCX, vCY, 0, vCX, vCY, 120);
        coreGrad.addColorStop(0, hexToRgba(vColor1, 0.18 * phonkIntensity));
        coreGrad.addColorStop(1, 'rgba(7,8,13,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath(); ctx.arc(vCX, vCY, 120, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Beat fling detection
        if (scaledBass > 0.6 && toggleVortexFlare.checked) { vortexBeatFling = true; }

        // Update and draw particles (VortexParticle already uses canvas.width/2, canvas.height/2 internally)
        syncVortexParticleCount();
        vortexParticles.forEach(p => {
            p.update(spinSpeed, smoothBass, vortexBeatFling); // VortexParticle scales smoothBass internally
            if (toggleGlow.checked) {
                ctx.save(); ctx.shadowColor = vGlow; ctx.shadowBlur = 8 + scaledBass * 20; ctx.restore();
            }
            p.draw(ctx, vColor1, vColor2);
        });
        vortexBeatFling = false;

        // Beat pulse flare ring — perfectly centered at true canvas center
        if (toggleVortexFlare.checked && scaledBass > 0.4) {
            ctx.save();
            ctx.strokeStyle = vColor1;
            ctx.lineWidth = 2 + scaledBass * 4;
            ctx.globalAlpha = scaledBass * 0.6;
            if (toggleGlow.checked) { ctx.shadowColor = vGlow; ctx.shadowBlur = 30 * scaledBass; }
            ctx.beginPath();
            ctx.arc(vCX, vCY, 40 + scaledBass * 120, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

    } else if (currentRenderStyle === 'glitch') {
        // ---- GLITCH STORM RENDER ----
        const gCX = centerX;
        const gCY = canvas.height / 2;

        const gTheme = selectGlitchTheme.value;
        let gColor = '#ff003c', gAlt = '#ff6600';
        if (gTheme === 'matrix') { gColor = '#00ff44'; gAlt = '#aaff00'; }
        else if (gTheme === 'plasma') { gColor = '#bf00ff'; gAlt = '#ff00aa'; }
        else if (gTheme === 'ghost') { gColor = '#ffffff'; gAlt = '#aaaaaa'; }

        const glitchIntensity = parseInt(sliderGlitchIntensity.value);
        const chromaSpread = parseInt(sliderGlitchChroma.value);
        const scanlineOpacity = parseInt(sliderGlitchScanlines.value) / 100;
        const scaledBass = smoothBass * phonkIntensity;

        // Background: dark with theme tint
        ctx.save();
        const bgGrad = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, canvas.height * 0.7);
        bgGrad.addColorStop(0, hexToRgba(gColor, 0.06));
        bgGrad.addColorStop(1, 'rgba(7,8,13,0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Scanlines
        if (scanlineOpacity > 0) {
            ctx.save();
            ctx.globalAlpha = scanlineOpacity * 0.5;
            for (let sy = 0; sy < canvas.height; sy += 4) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, sy, canvas.width, 2);
            }
            ctx.restore();
        }

        // Equalizer bars in glitch mode (vertical centered, color-tinted)
        const numBarsG = 64;
        const barWidthG = canvas.width / numBarsG;
        ctx.save();
        for (let b = 0; b < numBarsG; b++) {
            const dataIdx = 3 + Math.floor((b / numBarsG) * 112);
            const val = dataArray ? dataArray[dataIdx] / 255 : 0;
            const barH = val * (canvas.height * 0.45) * sensitivity;
            const bx = b * barWidthG;
            if (toggleGlow.checked) { ctx.shadowColor = gColor; ctx.shadowBlur = 8 + scaledBass * 20; }
            ctx.fillStyle = hexToRgba(gColor, 0.7 + val * 0.3);
            ctx.fillRect(bx, gCY - barH, barWidthG - 2, barH * 2);
        }
        ctx.restore();

        // Glitch band displacements on beat
        glitchFrameTimer++;
        const beatStrength = scaledBass;
        if (beatStrength > 0.35 && glitchFrameTimer % Math.max(1, Math.floor(8 - glitchIntensity)) === 0) {
            const numSlices = Math.floor(glitchIntensity * beatStrength * 4) + 1;
            for (let s = 0; s < numSlices; s++) {
                const sliceY = Math.random() * canvas.height;
                const sliceH = Math.random() * 60 + 10;
                const sliceDx = (Math.random() - 0.5) * chromaSpread * 4 * beatStrength;
                glitchSlices.push({ y: sliceY, h: sliceH, dx: sliceDx, life: 6 + Math.random() * 8 });
            }
        }

        // Render active glitch slices (band-shift using drawImage)
        glitchSlices = glitchSlices.filter(sl => sl.life > 0);
        glitchSlices.forEach(sl => {
            if (sl.y < 0 || sl.y + sl.h > canvas.height || sl.h <= 0) { sl.life = 0; return; }
            ctx.save();
            ctx.globalAlpha = Math.min(1, sl.life / 8);
            try {
                ctx.drawImage(canvas, 0, sl.y, canvas.width, sl.h, sl.dx, sl.y, canvas.width, sl.h);
            } catch(e) {}
            ctx.restore();
            sl.life--;
        });

        // Chromatic aberration ghost copies on beat
        if (chromaSpread > 0 && scaledBass > 0.3) {
            const spread = chromaSpread * scaledBass;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.15 * scaledBass;
            try {
                ctx.drawImage(canvas, spread, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
                ctx.drawImage(canvas, -spread, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
            } catch(e) {}
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }

        // Lightning bolts on beat
        if (toggleGlitchLightning.checked && scaledBass > 0.5 && Math.random() < scaledBass * 0.4) {
            const destX = (Math.random() - 0.5) * canvas.width * 0.8 + gCX;
            const destY = (Math.random() - 0.5) * canvas.height * 0.8 + gCY;
            lightningBolts.push(new LightningBolt(gCX, gCY, destX, destY, gColor, 1.5 + scaledBass * 2));
            // Add secondary bolts occasionally
            if (Math.random() < 0.4) {
                const d2x = (Math.random() - 0.5) * canvas.width * 0.6 + gCX;
                const d2y = (Math.random() - 0.5) * canvas.height * 0.6 + gCY;
                lightningBolts.push(new LightningBolt(gCX, gCY, d2x, d2y, gAlt, 1));
            }
        }
        lightningBolts = lightningBolts.filter(bolt => bolt.update());
        lightningBolts.forEach(bolt => bolt.draw(ctx));

        // Central energy core for glitch
        ctx.save();
        const glitchCoreR = 30 + scaledBass * 40;
        const glitchGrad = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, glitchCoreR);
        glitchGrad.addColorStop(0, gColor);
        glitchGrad.addColorStop(0.5, hexToRgba(gColor, 0.4));
        glitchGrad.addColorStop(1, 'rgba(7,8,13,0)');
        ctx.fillStyle = glitchGrad;
        if (toggleGlow.checked) { ctx.shadowColor = gColor; ctx.shadowBlur = 40 + scaledBass * 60; }
        ctx.beginPath(); ctx.arc(gCX, gCY, glitchCoreR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

    } else if (currentRenderStyle === 'inferno') {
        // ---- INFERNO TUNNEL RENDER ----
        const iCX = centerX;
        const iCY = canvas.height / 2;

        const iTheme = selectInfernoTheme.value;
        let iColor1 = '#ff2200', iColor2 = '#ff7700', iFireColor = '#ff4400';
        if (iTheme === 'electric') { iColor1 = '#00c6ff'; iColor2 = '#0044ff'; iFireColor = '#00aaff'; }
        else if (iTheme === 'acid') { iColor1 = '#aaff00'; iColor2 = '#00ff44'; iFireColor = '#88ff00'; }
        else if (iTheme === 'ghost') { iColor1 = '#ffffff'; iColor2 = '#aaaaaa'; iFireColor = '#ccccff'; }

        const iSpeed = parseFloat(sliderInfernoSpeed.value);
        const iShape = selectInfernoShape.value;
        const maxR = Math.min(canvas.width, canvas.height) * 0.52;
        const scaledBass = smoothBass * phonkIntensity;

        // Draw dark tunnel background gradient
        ctx.save();
        const tunnelBg = ctx.createRadialGradient(iCX, iCY, 0, iCX, iCY, maxR * 1.2);
        tunnelBg.addColorStop(0, 'rgba(7,8,13,1)');
        tunnelBg.addColorStop(0.6, hexToRgba(iColor1, 0.06));
        tunnelBg.addColorStop(1, 'rgba(7,8,13,0)');
        ctx.fillStyle = tunnelBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Advance and cull rings
        infernoRings = infernoRings.filter(ring => ring.update(iSpeed, smoothBass)); // InfernoRing scales it internally

        // Spawn new rings as old ones fly past
        const targetDensity = parseInt(sliderInfernoDensity.value);
        while (infernoRings.length < targetDensity) {
            infernoRings.push(new InfernoRing(0));
        }

        // Draw rings sorted back-to-front
        const sortedRings = [...infernoRings].sort((a, b) => a.z - b.z);
        sortedRings.forEach(ring => ring.draw(ctx, iCX, iCY, maxR, iColor1, iColor2, iShape));

        // Spawn fire particles from tunnel mouth on beats
        if (toggleInfernoFire.checked) {
            const spawnCount = Math.floor(scaledBass * 8 + smoothTreble * 4 + 1);
            for (let s = 0; s < spawnCount; s++) {
                infernoParticles.push(new InfernoParticle(iCX, iCY));
            }
        }
        infernoParticles = infernoParticles.filter(p => p.update());
        infernoParticles.forEach(p => p.draw(ctx, iFireColor));

        // Centre opening glow
        ctx.save();
        const openingR = 18 + scaledBass * 35;
        const openGrad = ctx.createRadialGradient(iCX, iCY, 0, iCX, iCY, openingR);
        openGrad.addColorStop(0, '#ffffff');
        openGrad.addColorStop(0.4, hexToRgba(iColor1, 0.9));
        openGrad.addColorStop(1, 'rgba(7,8,13,0)');
        ctx.fillStyle = openGrad;
        if (toggleGlow.checked) { ctx.shadowColor = iColor1; ctx.shadowBlur = 50 + scaledBass * 80; }
        ctx.beginPath(); ctx.arc(iCX, iCY, openingR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // 3d. Center Core Rendering (Circular equalizer, spin logo, solid background mask)
    if (toggleCenterCore.checked && currentRenderStyle !== 'zen' && currentRenderStyle !== 'glitch' && currentRenderStyle !== 'vortex' && currentRenderStyle !== 'inferno') {
        const baseRadius = 110 + (smoothBass * 45);
        const hasLogo = (logoImg && logoImg.complete && logoImg.naturalWidth !== 0);

        if (hasLogo) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#07080d'; // Matches main background
            ctx.fill();
            ctx.restore();
        }

        // 3e. Draw Circular Audio Ring (Equalizer core)
        ctx.save();
        ctx.strokeStyle = activeStartColor;
        ctx.lineWidth = 2.5;
        if (toggleGlow.checked) {
            ctx.shadowColor = activeGlowColor;
            ctx.shadowBlur = 15 + (smoothBass * 20);
        }

        const numRingBars = 90;
        for (let i = 0; i < numRingBars; i++) {
            const angle = (i * Math.PI * 2) / numRingBars;
            
            // Symmetric left-right mapping: Bass at bottom, Treble at top
            let diff = Math.abs(angle - Math.PI / 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            const t = diff / Math.PI; // 0 at bottom (pointing down), 1 at top (pointing up)
            
            const dataIndex = 3 + Math.floor(t * 115);
            const freqVal = dataArray ? dataArray[dataIndex] : 0;
            const freqNorm = freqVal / 255;
            
            const barLength = freqNorm * 75 * sensitivity;
            
            const x1 = centerX + Math.cos(angle) * baseRadius;
            const y1 = centerY + Math.sin(angle) * baseRadius;
            const x2 = centerX + Math.cos(angle) * (baseRadius + barLength);
            const y2 = centerY + Math.sin(angle) * (baseRadius + barLength);

            const p1 = displacePoint(x1, y1);
            const p2 = displacePoint(x2, y2);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = hexToRgba(activeStartColor, 0.35 + (freqNorm * 0.65));
            ctx.stroke();
        }
        ctx.restore();

        // 3f. Draw Spinning Center Logo
        if (hasLogo) {
            ctx.save();
            
            const rotationSpeed = 0.005 + (smoothBass * 0.02);
            logoRotation += rotationSpeed;

            ctx.translate(centerX, centerY);
            ctx.rotate(logoRotation);

            const innerRadius = baseRadius * 0.72;

            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            ctx.drawImage(logoImg, -innerRadius, -innerRadius, innerRadius * 2, innerRadius * 2);
            
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
            ctx.strokeStyle = activeStartColor;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.restore();
        }
    } else {
        const rotationSpeed = 0.005 + (smoothBass * 0.02);
        logoRotation += rotationSpeed;
    }

    // 4. Update and Render Glow Orbs and Shockwaves
    if (toggleParticles.checked) {
        // Update and draw shockwaves
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            shockwaves[i].update();
            shockwaves[i].draw(ctx, toggleGlow.checked);
            if (shockwaves[i].alpha <= 0) {
                shockwaves.splice(i, 1);
            }
        }

        // Limit shockwaves count to prevent performance drag
        if (shockwaves.length > 12) {
            shockwaves.shift();
        }

        // Update and draw ambient Glow Orbs
        particles.forEach((orb) => {
            orb.update(smoothBass, smoothTreble);
            orb.draw(ctx, activeStartColor);
        });
    } else {
        shockwaves = [];
    }

    // 4. Render transition glitch effect if timer is active
    if (phonkTransitionTimer > 0) {
        phonkTransitionTimer--;
        
        ctx.save();
        // Draw full-screen displacement blocks
        const numBlocks = Math.floor(Math.random() * 5) + 3;
        for (let i = 0; i < numBlocks; i++) {
            const h = Math.random() * 120 + 20;
            const y = Math.random() * (canvas.height - h);
            const dx = (Math.random() - 0.5) * 60;
            try {
                ctx.drawImage(canvas, 0, y, canvas.width, h, dx, y, canvas.width, h);
            } catch (e) {}
        }
        
        // Draw chromatic screen splits
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.35;
        const spread = (Math.random() - 0.5) * 25;
        try {
            ctx.drawImage(canvas, spread, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvas, -spread, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        } catch(e) {}
        
        // Semi-transparent colored flash
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = Math.random() < 0.5 ? '#ff007f' : '#00f0ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.restore();
    }

    // 5. Update full-screen ripple distortion (GPU-based Inline-Refraction)
    let totalScale = 0;
    let hasActiveRipples = false;

    if (toggleParticles.checked) {
        for (let i = 0; i < screenRipples.length; i++) {
            const ripple = screenRipples[i];
            if (ripple.progress > 0) {
                hasActiveRipples = true;
                // Expand the ripple radius slowly (in slomo!)
                ripple.progress += 0.0055 * speedConfig; 
                
                if (ripple.progress < 1.0) {
                    const envelope = Math.sin(ripple.progress * Math.PI);
                    const currentScale = ripple.maxScale * envelope;
                    totalScale = Math.max(totalScale, currentScale);
                    
                    // Update the individual SVG circle's radius and opacity
                    const rippleCircle = document.getElementById(`ripple-circle-${i}`);
                    if (rippleCircle) {
                        rippleCircle.setAttribute('r', (ripple.progress * 140) + '%');
                        rippleCircle.setAttribute('opacity', envelope.toFixed(2));
                    }
                } else {
                    // Reset this ripple
                    ripple.progress = 0;
                    const rippleCircle = document.getElementById(`ripple-circle-${i}`);
                    if (rippleCircle) {
                        rippleCircle.setAttribute('r', '0%');
                        rippleCircle.setAttribute('opacity', '0');
                    }
                }
            }
        }
    }

    if (hasActiveRipples && totalScale > 0.5) {
        // Update the displacement scale
        if (screenRippleMap) {
            screenRippleMap.setAttribute('scale', totalScale.toFixed(1));
        }
        
        // Force Chrome to refresh the feImage cache by toggling the href attribute
        const feImage = document.querySelector('#screen-ripple-filter feImage');
        if (feImage) {
            feImage.setAttribute('href', '');
            feImage.setAttribute('href', '#ripple-source');
        }
        
        canvas.style.filter = 'url(#screen-ripple-filter)';
    } else {
        // Reset all
        if (screenRippleMap) {
            screenRippleMap.setAttribute('scale', '0');
        }
        canvas.style.filter = '';
        // Clear all SVG circles
        for (let i = 0; i < screenRipples.length; i++) {
            const rippleCircle = document.getElementById(`ripple-circle-${i}`);
            if (rippleCircle) {
                rippleCircle.setAttribute('r', '0%');
                rippleCircle.setAttribute('opacity', '0');
            }
        }
    }

    // Call next animation frame
    requestAnimationFrame(render);
}

// Start rendering loop immediately
render();

// --- 5. Chrome Extension Audio Capture Handling ---
function initExtensionCapture(streamId) {
    initAudio();
    
    // Stop any existing stream tracks first to free up the media capture interface
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    // Constraints to capture tab audio from streamId
    navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
            }
        },
        video: false
    })
    .then(stream => {
        isMicActive = false;
        audioStream = stream; // Save stream to allow stopping it later!
        
        // Disconnect old source
        if (source && source.disconnect) {
            try { source.disconnect(); } catch (err) {}
        }
        
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.connect(audioContext.destination); // Play the audio back to user speakers
        
        // Hide standard inputs (file upload and microphone)
        document.getElementById('file-tab').style.display = 'none';
        document.getElementById('mic-tab').style.display = 'none';
        document.querySelector('.tabs').style.display = 'none';
        
        // Add dynamic success message inside the dashboard
        const header = document.querySelector('.dashboard-header');
        const statusPanel = document.createElement('div');
        statusPanel.style.marginTop = '15px';
        statusPanel.style.padding = '10px 15px';
        statusPanel.style.borderRadius = '12px';
        statusPanel.style.background = 'rgba(0, 255, 135, 0.08)';
        statusPanel.style.border = '1px solid rgba(0, 255, 135, 0.2)';
        statusPanel.innerHTML = `
            <p style="font-size: 13px; color: #00ff87; text-align: center; font-weight: 600;">
                <i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Tab Audio Synced
            </p>
            <p style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 3px;">
                Play music in the original tab to visualize.
            </p>
        `;
        header.parentNode.insertBefore(statusPanel, header.nextSibling);
    })
    .catch(err => {
        console.error("Extension audio capture failed:", err);
        alert("Failed to capture tab audio. Make sure the source tab remains open.");
    });
}

// Check URL query parameters for extension-provided streamId
const extensionStreamId = urlParams.get('streamId');
if (extensionStreamId) {
    // Remove the streamId from the URL address bar so that refreshing the page loads the visualizer normally
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('streamId');
        window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch (e) {
        console.warn("Failed to clean up URL streamId parameter:", e);
    }

    // Small delay to make sure AudioContext initializes correctly after page load
    setTimeout(() => {
        initExtensionCapture(extensionStreamId);
    }, 500);
}

// --- 6. Custom style dropdown controller logic ---
(function() {
    const customDropdown = document.getElementById('custom-dropdown-style');
    if (!customDropdown) return;
    const customDropdownTrigger = customDropdown.querySelector('.custom-dropdown-trigger');
    const customDropdownMenu = document.getElementById('custom-dropdown-menu-style');
    const customDropdownItems = customDropdown.querySelectorAll('.custom-dropdown-item');
    const customDropdownSelectedText = document.getElementById('custom-dropdown-selected-text');

    customDropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customDropdownMenu.classList.toggle('show');
    });

    customDropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const val = item.getAttribute('data-value');
            
            // Remove selected class from others
            customDropdownItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            // Update trigger text
            customDropdownSelectedText.innerText = item.innerText;
            
            // Close menu
            customDropdownMenu.classList.remove('show');
            
            // Update hidden native select and dispatch change event
            if (selectStyle) {
                selectStyle.value = val;
                selectStyle.dispatchEvent(new Event('change'));
            }
        });
    });

    // Close custom dropdown when clicking outside
    document.addEventListener('click', () => {
        customDropdownMenu.classList.remove('show');
    });
})();
