function setVHProperty() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setVHProperty();
function handleViewportChange() {
    setVHProperty();
    if (typeof resizeCanvas === 'function') {
        resizeCanvas();
    }
}
window.addEventListener('resize', handleViewportChange);
window.addEventListener('orientationchange', handleViewportChange);
if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    let ticking = false;
    let lastHeight = window.innerHeight;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (Math.abs(window.innerHeight - lastHeight) > 5) {
                    handleViewportChange();
                    lastHeight = window.innerHeight;
                }
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
    window.addEventListener('focus', handleViewportChange, { passive: true });
    window.addEventListener('blur', handleViewportChange, { passive: true });
}
const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const defaultConfig = {
    gravity: isMobileDevice ? 0.7 : 0.8,      
    jump: -10,                                 
    birdSize: 100,
    birdWidth: 100,
    birdHeight: 75,
    pipeWidth: 140,
    pipeGap: 200,
    pipeSpeed: 5,
    coinSize: 90,
    enemySize: 100,
    enemySpeed: 3,
    enemySpawnTime: 10000,
};
const CONFIG = window.DESIGN_CONFIG ? {
    ...defaultConfig,
    birdSize: window.DESIGN_CONFIG.birdSize || defaultConfig.birdSize,
    birdWidth: window.DESIGN_CONFIG.birdWidth || defaultConfig.birdWidth,
    birdHeight: window.DESIGN_CONFIG.birdHeight || defaultConfig.birdHeight,
    pipeWidth: window.DESIGN_CONFIG.pipeWidth || defaultConfig.pipeWidth,
    coinSize: window.DESIGN_CONFIG.coinSize || defaultConfig.coinSize,
    enemySize: window.DESIGN_CONFIG.enemySize || defaultConfig.enemySize,
} : defaultConfig;
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY && 
    window.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' && 
    window.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE') {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}
let canvas, ctx;
let gameState = 'splash';
let score = 0;
let highscore = 0;
let coins = 0;
let frames = 0;
let gameStartTime = 0;
let lastDisplayedScore = -1; 
let imagesLoaded = false;
let isPaused = false;
let bird = {
    x: 60,
    y: 200,
    velocity: 0,
    width: window.DESIGN_CONFIG?.birdWidth || 100,
    height: window.DESIGN_CONFIG?.birdHeight || 75,
    rotation: 0,
    targetRotation: 0, 
    frame: 0
};
let pipes = [];
let gameCoins = [];
let enemies = [];
let powerUps = []; 
let slowMotionActive = false;
let slowMotionEndTime = 0;
let lastPowerUpScore = 0;
let pipeSpawnCounter = 0;
let bossActive = false;
let boss = null;
let bossHealth = 0;
let bossMaxHealth = 0;
let lastBossScore = 0;
const images = {
    bird: new Image(),
    pipeUp: new Image(),
    pipeDown: new Image(),
    pipe: new Image(),
    coin: new Image(),
    enemies: [],
    fontBig: [],
    fontSmall: [],
    medals: {
        bronze: new Image(),
        silver: new Image(),
        gold: new Image(),
        platinum: new Image()
    },
    pipeTopFrames: [],
    pipeBottomFrames: []
};
const bossOrder = [
    'BEAR.gif',
    'ELIZABETH WARREN.gif',
    'SAM BANKMAN-FRIED.gif',
    'NANCY PELOSI.gif',
    'JIM CRAMER.gif',
    'GARY GENSLER.gif'
];
let currentBossIndex = 0; 
for (let i = 0; i <= 9; i++) {
    images.fontBig[i] = new Image();
    images.fontBig[i].src = `assets/fonts/big/${i}.png`;
    images.fontSmall[i] = new Image();
    images.fontSmall[i].src = `assets/fonts/small/${i}.png`;
}
images.medals.bronze.src = 'assets/medals/bronze.png';
images.medals.silver.src = 'assets/medals/silver.png';
images.medals.gold.src = 'assets/medals/gold.png';
images.medals.platinum.src = 'assets/medals/platinum.png';
const sounds = {
    jump: new Audio('assets/sounds/sfx_wing2.ogg'),
    score: new Audio('assets/sounds/sfx_point.ogg'),
    hit: new Audio('assets/sounds/sfx_hit.ogg'),
    die: new Audio('assets/sounds/mixkit-arcade-game-explosion-2759.wav'),
    swoosh: new Audio('assets/sounds/sfx_swooshing.ogg'),
    bossShoot: new Audio('assets/sounds/Fire 5.mp3'), 
    bossHit: new Audio('assets/sounds/sfx_hit.ogg'), 
    bossDefeat: new Audio('assets/sounds/sfx_swooshing.ogg'), 
    gameOver: new Audio('assets/sounds/Game Over.mp3'), 
    soundtrack: new Audio('assets/sounds/soundtrack.mp3')
};
sounds.soundtrack.loop = true;
sounds.soundtrack.volume = 0.15; 
Object.values(sounds).forEach(sound => {
    if (sound) {
        sound.volume = 0.3;
        sound.addEventListener('error', () => {
        });
    }
});
if (sounds.bossShoot) sounds.bossShoot.volume = 0.15;
let soundEnabled = true;
let musicEnabled = true;
let flyArea = 420;
let pixelPerfectCollision = true;
let masksPrecomputed = false;
const isDesktop = window.innerWidth > 1024;
const gameSpeedMultiplier = isDesktop ? 2.0 : 1.0;
const targetFPS = isDesktop ? 70 : 60;
function loadImages() {
    const CANDLESTICK_FRAME_COUNT = 20;
    let loadedCount = 0;
    const totalImages = 2 + bossOrder.length + (CANDLESTICK_FRAME_COUNT * 2);
    const onImageLoad = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
            imagesLoaded = true;
            precomputeCollisionMasks();
        }
    };
    const createHiddenImage = (src) => {
        const img = document.createElement('img');
        img.src = src;
        img.style.display = 'none';
        document.body.appendChild(img);
        return img;
    };
    images.bird = createHiddenImage('assets/characters/MAIN CHARACTER.gif');
    images.bird.onload = onImageLoad;
    images.coin = createHiddenImage('assets/items/COIN.gif');
    images.coin.onload = onImageLoad;
    for (let i = 0; i < CANDLESTICK_FRAME_COUNT; i++) {
        const frameNum = String(i).padStart(2, '0');
        const topFrame = createHiddenImage(`assets/candlesticks/top/frame_${frameNum}_delay-0.1s.gif`);
        topFrame.onload = onImageLoad;
        images.pipeTopFrames.push(topFrame);
        const bottomFrame = createHiddenImage(`assets/candlesticks/bottom/frame_${frameNum}_delay-0.1s.gif`);
        bottomFrame.onload = onImageLoad;
        images.pipeBottomFrames.push(bottomFrame);
    }
    images.pipeUp = images.pipeBottomFrames[0];
    images.pipeDown = images.pipeTopFrames[0];
    images.pipe = images.pipeTopFrames[0];
    bossOrder.forEach(char => {
        const img = createHiddenImage(`assets/characters/enemies/${char}`);
        img.onload = onImageLoad;
        images.enemies.push(img);
    });
}
async function precomputeCollisionMasks() {
    if (!window.collisionSystem) {
        masksPrecomputed = false;
        return;
    }
    try {
        await window.collisionSystem.precomputeMasks('bird', images.bird, {
            frameCount: 6,
            frameDuration: 100,
            alphaThreshold: 30
        });
        const pipeTopMasks = [];
        const pipeBottomMasks = [];
        for (let i = 0; i < images.pipeTopFrames.length; i++) {
            const topFrame = images.pipeTopFrames[i];
            const bottomFrame = images.pipeBottomFrames[i];
            if (!topFrame.complete) await new Promise(resolve => topFrame.onload = resolve);
            if (!bottomFrame.complete) await new Promise(resolve => bottomFrame.onload = resolve);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = topFrame.naturalWidth || 200;
            canvas.height = topFrame.naturalHeight || 200;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(topFrame, 0, 0);
            const topImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const topMask = window.collisionSystem.generateCollisionMask(topImageData, 200);
            const topBbox = window.collisionSystem.generateBoundingBox(topImageData, 200);
            pipeTopMasks.push({
                mask: topMask,
                bbox: topBbox,
                width: canvas.width,
                height: canvas.height
            });
            canvas.width = bottomFrame.naturalWidth || 200;
            canvas.height = bottomFrame.naturalHeight || 200;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bottomFrame, 0, 0);
            const bottomImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const bottomMask = window.collisionSystem.generateCollisionMask(bottomImageData, 200);
            const bottomBbox = window.collisionSystem.generateBoundingBox(bottomImageData, 200);
            pipeBottomMasks.push({
                mask: bottomMask,
                bbox: bottomBbox,
                width: canvas.width,
                height: canvas.height
            });
        }
        window.collisionSystem.masks.set('pipeDown', pipeTopMasks);
        window.collisionSystem.masks.set('pipeUp', pipeBottomMasks);
        await window.collisionSystem.precomputeMasks('coin', images.coin, {
            frameCount: 6,
            frameDuration: 100,
            alphaThreshold: 50
        });
        for (let i = 0; i < images.enemies.length; i++) {
            await window.collisionSystem.precomputeMasks(`enemy_${i}`, images.enemies[i], {
                frameCount: 4,
                frameDuration: 150,
                alphaThreshold: 50
            });
        }
        masksPrecomputed = true;
    } catch (error) {
        masksPrecomputed = false;
    }
}
function getHighScore() {
    const saved = localStorage.getItem('flappyBirdHighScore');
    return saved ? parseInt(saved) : 0;
}
function saveHighScore() {
    localStorage.setItem('flappyBirdHighScore', highscore);
}
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        return false;
    }
});
window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    loadImages();
    highscore = getHighScore();
    initHTMLElements();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('keydown', handleKeyPress);
    if ('ontouchstart' in window) {
        document.addEventListener('touchstart', handleTouch, { passive: false });
    } else {
        document.addEventListener('mousedown', handleClick);
        document.getElementById('splash').addEventListener('click', startGame);
    }
    const isTouchDevice = 'ontouchstart' in window;
    const eventType = isTouchDevice ? 'touchend' : 'click';
    document.getElementById('startplaybutton').addEventListener(eventType, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (gameState === 'start') {
            showGetReady();
        }
    });
    document.getElementById('replay').addEventListener(eventType, (e) => {
        e.preventDefault();
        showGetReady();
    });
    document.getElementById('sharebutton').addEventListener(eventType, (e) => {
        e.preventDefault();
        shareScore();
    });
    document.getElementById('buylongbutton').addEventListener(eventType, (e) => {
        e.preventDefault();
        buyLong();
    });
    const submitBtn = document.getElementById('submitNameBtn');
    submitBtn.addEventListener(eventType, async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await handleNameSubmit();
    });
    if (isTouchDevice) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleNameSubmit();
        });
    }
    document.getElementById('playerNameInput').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await handleNameSubmit();
        }
    });
    const setupScrollableArea = (selector) => {
        const areas = document.querySelectorAll(selector);
        areas.forEach(area => {
            area.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: true });
            area.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
            area.addEventListener('touchend', (e) => {
                e.stopPropagation();
            }, { passive: true });
        });
    };
    setupScrollableArea('.leaderboard-scroll');
    setupScrollableArea('#scoreboard');
    setupScrollableArea('#leaderboard-container');
    setupScrollableArea('#leaderboardTable');
    document.getElementById('musicToggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMusic();
    });
    document.getElementById('soundToggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSound();
    });
    document.getElementById('scoreboardMusicToggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMusic();
    });
    document.getElementById('scoreboardSfxToggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSound();
    });
    document.getElementById('pauseButton').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePause();
    });
    document.getElementById('resumeButton').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePause();
    });
    const musicBtn = document.getElementById('musicToggle');
    const musicText = musicBtn.querySelector('.music-text');
    const soundBtn = document.getElementById('soundToggle');
    const soundText = soundBtn.querySelector('.sound-text');
    if (musicEnabled) {
        musicText.textContent = 'ON';
        musicText.style.color = '#46DDB1';
        musicBtn.classList.remove('off');
    } else {
        musicText.textContent = 'OFF';
        musicText.style.color = '#999';
        musicBtn.classList.add('off');
    }
    if (soundEnabled) {
        soundText.textContent = 'ON';
        soundText.style.color = '#46DDB1';
        soundBtn.classList.remove('off');
    } else {
        soundText.textContent = 'OFF';
        soundText.style.color = '#999';
        soundBtn.classList.add('off');
    }
    showStartScreen();
    gameLoop();
};
function resizeCanvas() {
    const flyarea = document.getElementById('flyarea');
    canvas.width = flyarea.offsetWidth;
    canvas.height = flyarea.offsetHeight;
    flyArea = flyarea.offsetHeight;
    const isMobile = window.innerWidth <= 600;
    const baseWidth = window.DESIGN_CONFIG?.birdWidth || 120;
    const baseHeight = window.DESIGN_CONFIG?.birdHeight || 90;
    if (isMobile) {
        bird.width = baseWidth * 0.7;
        bird.height = baseHeight * 0.7;
    } else {
        bird.width = baseWidth;
        bird.height = baseHeight;
    }
    if (gameState === 'start' || gameState === 'getready' || gameState === 'playing') {
        bird.x = canvas.width * 0.2;
    }
}
function showStartScreen() {
    gameState = 'start';
    isPaused = false;
    score = 0;
    lastDisplayedScore = -1; 
    coins = 0;
    frames = 0;
    pipes = [];
    gameCoins = [];
    enemies = [];
    powerUps = [];
    bossActive = false;
    boss = null;
    bossHealth = 0;
    lastBossScore = 0;
    slowMotionActive = false;
    slowMotionEndTime = 0;
    lastPowerUpScore = 0;
    pipeSpawnCounter = 0;
    currentBossIndex = 0;
    if (sounds.soundtrack) {
        sounds.soundtrack.pause();
        sounds.soundtrack.currentTime = 0;
    }
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('pauseOverlay').style.display = 'none';
    cleanupHTMLElements();
    bird.x = canvas.width * 0.2;
    bird.y = 200;
    bird.velocity = 0;
    bird.rotation = 0;
    bird.targetRotation = 0;
    if (htmlElements.bird) {
        htmlElements.bird.style.opacity = '0';
        htmlElements.bird.style.display = 'none';
        htmlElements.bird.style.visibility = 'hidden';
        htmlElements.bird.style.width = '0px';
        htmlElements.bird.style.height = '0px';
        htmlElements.bird.style.transform = 'rotate(0deg)';
    }
    const startScreen = document.getElementById('startscreen');
    startScreen.style.opacity = '1';
    startScreen.style.display = 'flex';
    startScreen.classList.add('active');
    document.getElementById('splash').style.display = 'none';
    document.getElementById('splash').classList.remove('active');
    document.getElementById('scoreboard').style.display = 'none';
    document.getElementById('bigscore').style.display = 'none';
    displayStartLeaderboard();
    document.querySelectorAll('.animated').forEach(el => {
        el.classList.remove('paused');
    });
    playSound('swoosh');
}
function showGetReady() {
    gameState = 'getready';
    isPaused = false;
    score = 0;
    lastDisplayedScore = -1;
    coins = 0;
    frames = 0;
    pipes = [];
    gameCoins = [];
    enemies = [];
    powerUps = [];
    bossActive = false;
    boss = null;
    bossHealth = 0;
    lastBossScore = 0;
    slowMotionActive = false;
    slowMotionEndTime = 0;
    lastPowerUpScore = 0;
    pipeSpawnCounter = 0;
    currentBossIndex = 0;
    cleanupHTMLElements();
    if (sounds.soundtrack) {
        sounds.soundtrack.pause();
        sounds.soundtrack.currentTime = 0;
    }
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('bigscore').style.display = 'none';
    bird.x = canvas.width * 0.2;
    bird.y = 200;
    bird.velocity = 0;
    bird.rotation = 0;
    bird.targetRotation = 0;
    if (htmlElements.bird) {
        htmlElements.bird.style.opacity = '0';
        htmlElements.bird.style.display = 'none';
        htmlElements.bird.style.visibility = 'hidden';
        htmlElements.bird.style.width = '0px';
        htmlElements.bird.style.height = '0px';
        htmlElements.bird.style.transform = 'rotate(0deg)';
    }
    const startScreen = document.getElementById('startscreen');
    startScreen.style.opacity = '0';
    startScreen.classList.remove('active');
    setTimeout(() => {
        startScreen.style.display = 'none';
    }, 500);
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.style.opacity = '0';
    setTimeout(() => {
        scoreboard.style.display = 'none';
    }, 500);
    document.querySelectorAll('.animated').forEach(el => {
        el.classList.remove('paused');
    });
    const splashEl = document.getElementById('splash');
    splashEl.style.opacity = '1';
    splashEl.style.display = 'flex';
    splashEl.classList.add('active');
    playSound('swoosh');
}
function showSplash() {
    showStartScreen();
}
function cleanupHTMLElements() {
    htmlElements.pipes.forEach(elem => {
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    });
    htmlElements.pipes = [];
    htmlElements.coins.forEach(elem => {
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    });
    htmlElements.coins = [];
    htmlElements.enemies.forEach(elem => {
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    });
    htmlElements.enemies = [];
    if (htmlElements.boss && htmlElements.boss.parentNode) {
        htmlElements.boss.parentNode.removeChild(htmlElements.boss);
        htmlElements.boss = null;
    }
    powerUpElements.forEach(elem => {
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    });
    powerUpElements = [];
}
function startGame() {
    if (gameState !== 'getready') return;
    gameState = 'playing';
    gameStartTime = Date.now();
    isPaused = false;
    score = 0;
    coins = 0;
    frames = 0;
    pipes = [];
    gameCoins = [];
    enemies = [];
    powerUps = [];
    bossActive = false;
    boss = null;
    bossHealth = 0;
    lastBossScore = 0;
    if (htmlElements.boss && htmlElements.boss.parentNode) {
        htmlElements.boss.parentNode.removeChild(htmlElements.boss);
        htmlElements.boss = null;
    }
    slowMotionActive = false;
    slowMotionEndTime = 0;
    lastPowerUpScore = 0;
    pipeSpawnCounter = 0;
    currentBossIndex = 0;
    bird.x = canvas.width * 0.2;
    bird.y = 200;
    bird.velocity = 0;
    bird.rotation = 0;
    bird.targetRotation = 0;
    const splashEl = document.getElementById('splash');
    splashEl.style.opacity = '0';
    splashEl.classList.remove('active');
    setTimeout(() => {
        splashEl.style.display = 'none';
    }, 500);
    document.getElementById('scoreboard').style.display = 'none';
    document.getElementById('bigscore').style.display = 'block';
    document.getElementById('gameControls').style.display = 'flex';
    document.getElementById('pauseOverlay').style.display = 'none';
    updateBigScore();
    updateHUD();
    playSound('swoosh');
    if (musicEnabled && sounds.soundtrack) {
        sounds.soundtrack.currentTime = 0;
        sounds.soundtrack.play().catch(e => {});
    }
}
function handleKeyPress(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'playing' && !isPaused) {
            jump();
        } else if (gameState === 'start') {
            showGetReady();
        } else if (gameState === 'getready') {
            startGame();
        }
    }
    if (e.code === 'Escape') {
        e.preventDefault();
        if (gameState === 'playing') {
            togglePause();
        }
    }
}
let isTouchDevice = false;
function handleClick(e) {
    if (isTouchDevice) {
        return;
    }
    if (gameState === 'playing') {
        jump();
    }
}
let lastTouchTime = 0;
const touchDebounceDelay = 10; 
function handleTouch(e) {
    e.preventDefault(); 
    e.stopPropagation(); 
    if (gameState === 'playing') {
        jump();
    } else if (gameState === 'getready') {
        startGame();
    }
}
function jump() {
    bird.velocity = CONFIG.jump;
    playSound('jump');
}
let lastFrameTime = 0;
const frameDuration = 1000 / targetFPS;
function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    if (timestamp - lastFrameTime < frameDuration) {
        return;
    }
    lastFrameTime = timestamp;
    if (gameState === 'playing' && !isPaused) {
        update();
    }
    draw();
}
function update() {
    frames++;
    const speedMultiplier = 1 + (Math.floor(score / 50) * 0.04); 
    const baseSpeed = Math.min(CONFIG.pipeSpeed * speedMultiplier, CONFIG.pipeSpeed * 1.5); 
    const currentSpeed = baseSpeed * gameSpeedMultiplier; 
    const enemySpeedMultiplier = 1 + (Math.floor(score / 50) * 0.06); 
    const baseEnemySpeed = Math.min(CONFIG.enemySpeed * enemySpeedMultiplier, CONFIG.enemySpeed * 1.8); 
    const currentEnemySpeed = baseEnemySpeed * gameSpeedMultiplier; 
    const spawnRateMultiplier = Math.max(0.6, 1 - (Math.floor(score / 50) * 0.04)); 
    const pipeSpawnInterval = Math.floor(120 * spawnRateMultiplier); 
    const coinSpawnInterval = Math.floor(140 * spawnRateMultiplier); 
    const enemySpawnInterval = Math.floor(180 * spawnRateMultiplier); 
    bird.velocity += CONFIG.gravity;
    bird.y += bird.velocity;
    const targetRotation = Math.min(Math.max(bird.velocity * 3, -30), 90);
    bird.rotation += (targetRotation - bird.rotation) * 0.4;
    bird.frame = Math.floor((frames / 6) % 6);
    const groundLevel = flyArea;
    if (bird.y + bird.height / 2 > groundLevel || bird.y - bird.height / 2 < 0) {
        gameOver();
        return;
    }
    if (score >= lastBossScore + 20 && !bossActive) {
        startBossFight();
    }
    if (score >= lastPowerUpScore + 30 && !bossActive) {
        spawnPowerUp();
        lastPowerUpScore = score;
    }
    const isMobile = window.innerWidth <= 600;
    const mobileSpawnMultiplier = isMobile ? 1.5 : 1.0; 
    const adjustedInterval = Math.max(pipeSpawnInterval * mobileSpawnMultiplier, 60);
    if (!bossActive && frames % Math.floor(adjustedInterval) === 0) {
        spawnPipe();
        if (pipeSpawnCounter % 2 === 0) { 
            const clusterChance = isMobile ? 0.6 : 0.4; 
            const shouldCluster = Math.random() > clusterChance;
            if (shouldCluster) {
                const clusterSpacing = isMobile ? 600 : 450;
                const clusterSize = Math.random() > 0.5 ? 1 : 2; 
                for (let c = 0; c < clusterSize; c++) {
                    spawnPipe(true, (c + 1) * clusterSpacing);
                }
            }
        }
    }
    let effectiveSpeed = currentSpeed;
    let effectiveEnemySpeed = currentEnemySpeed;
    if (slowMotionActive) {
        effectiveSpeed = currentSpeed * 0.85; 
        effectiveEnemySpeed = currentEnemySpeed * 0.85;
    }
    updatePowerUps(effectiveSpeed);
    if (bossActive && boss) {
        updateBoss(effectiveSpeed);
    }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= effectiveSpeed;
        if (!pipes[i].isStatic) {
            pipes[i].frame = Math.floor((frames / 6) % 20);
        } else {
            pipes[i].frame = pipes[i].staticFrame || 7;
        }
        const pipeWidth = pipes[i].width || CONFIG.pipeWidth;
        if (!pipes[i].passed && pipes[i].x + pipeWidth < bird.x) {
            pipes[i].passed = true;
        }
        if (pipes[i].x + pipeWidth < 0) {
            pipes.splice(i, 1);
        }
        if (checkPipeCollision(pipes[i])) {
            gameOver();
            return;
        }
    }
    for (let i = gameCoins.length - 1; i >= 0; i--) {
        gameCoins[i].x -= effectiveSpeed;
        if (!gameCoins[i].frame) gameCoins[i].frame = 0;
        gameCoins[i].frame = Math.floor((frames / 6) % 6);
        if (gameCoins[i].x + CONFIG.coinSize < 0) {
            gameCoins.splice(i, 1);
            continue;
        }
        if (checkCoinCollision(gameCoins[i])) {
            coins++;
            score++; 
            updateBigScore();
            updateHUD();
            playSound('coin');
            gameCoins.splice(i, 1);
        }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (!enemies[i].direction) {
            enemies[i].direction = Math.random() > 0.5 ? 1 : -1;
        }
        enemies[i].x -= effectiveSpeed;
        const baseVerticalSpeed = 0.8;
        const verticalSpeedIncrease = Math.floor(score / 100) * 0.15;
        const verticalSpeed = Math.min(baseVerticalSpeed + verticalSpeedIncrease, 2.3);
        enemies[i].y += enemies[i].direction * verticalSpeed;
        const topBound = 10;
        const bottomBound = flyArea - 10;
        if (enemies[i].y <= topBound) {
            enemies[i].direction = 1;
            enemies[i].y = topBound;
        } else if (enemies[i].y >= bottomBound) {
            enemies[i].direction = -1;
            enemies[i].y = bottomBound;
        }
        enemies[i].frame = Math.floor((frames / 9) % 4);
        if (enemies[i].x + CONFIG.enemySize < 0) {
            enemies.splice(i, 1);
            continue;
        }
        if (checkEnemyCollision(enemies[i])) {
            gameOver();
            return;
        }
    }
}
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPipesAsHTML();
    drawCoinsAsHTML();
    drawEnemiesAsHTML();
    drawPowerUps();
    if (bossActive && boss) {
        drawBossAsHTML();
        drawBossProjectiles();
        drawBossHealthBar();
    }
    drawSlowMotionIndicator();
    drawBirdAsHTML();
}
let htmlElements = {
    bird: null,
    pipes: [],
    coins: [],
    enemies: [],
    boss: null
};
function initHTMLElements() {
    const flyarea = document.getElementById('flyarea');
    htmlElements.bird = document.createElement('img');
    htmlElements.bird.src = 'assets/characters/MAIN CHARACTER.gif';
    htmlElements.bird.style.position = 'absolute';
    htmlElements.bird.style.pointerEvents = 'none';
    htmlElements.bird.style.zIndex = '50';
    htmlElements.bird.style.display = 'none';
    htmlElements.bird.style.visibility = 'hidden';
    htmlElements.bird.style.opacity = '0';
    htmlElements.bird.style.width = '0px';
    htmlElements.bird.style.height = '0px';
    flyarea.appendChild(htmlElements.bird);
}
function drawBirdAsHTML() {
    if (!htmlElements.bird) return;
    if (gameState === 'start' || gameState === 'getready') {
        htmlElements.bird.style.display = 'none';
        htmlElements.bird.style.visibility = 'hidden';
        htmlElements.bird.style.opacity = '0';
        htmlElements.bird.style.width = '0px';
        htmlElements.bird.style.height = '0px';
        return;
    }
    if (gameState === 'gameOver') {
        htmlElements.bird.style.width = bird.width + 'px';
        htmlElements.bird.style.height = bird.height + 'px';
        htmlElements.bird.style.left = (bird.x - bird.width/2) + 'px';
        htmlElements.bird.style.top = (bird.y - bird.height/2) + 'px';
        return;
    }
    if (gameState === 'playing') {
        htmlElements.bird.style.display = 'block';
        htmlElements.bird.style.visibility = 'visible';
        htmlElements.bird.style.opacity = '1';
        htmlElements.bird.style.width = bird.width + 'px';
        htmlElements.bird.style.height = bird.height + 'px';
    } else {
        htmlElements.bird.style.display = 'none';
        htmlElements.bird.style.visibility = 'hidden';
        htmlElements.bird.style.opacity = '0';
        htmlElements.bird.style.width = '0px';
        htmlElements.bird.style.height = '0px';
    }
    htmlElements.bird.style.left = (bird.x - bird.width/2) + 'px';
    htmlElements.bird.style.top = (bird.y - bird.height/2) + 'px';
    htmlElements.bird.style.transform = `rotate(${bird.rotation}deg)`;
}
function drawPipesAsHTML() {
    const flyarea = document.getElementById('flyarea');
    while (htmlElements.pipes.length > pipes.length * 2) {
        const elem = htmlElements.pipes.pop();
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    }
    pipes.forEach((pipe, i) => {
        const frameNum = String(pipe.frame || 0).padStart(2, '0');
        let topPipeIndex = i * 2;
        if (!htmlElements.pipes[topPipeIndex]) {
            htmlElements.pipes[topPipeIndex] = document.createElement('img');
            htmlElements.pipes[topPipeIndex].style.position = 'absolute';
            htmlElements.pipes[topPipeIndex].style.pointerEvents = 'none';
            htmlElements.pipes[topPipeIndex].style.zIndex = '10';
            htmlElements.pipes[topPipeIndex].style.objectFit = 'fill';
            htmlElements.pipes[topPipeIndex].style.imageRendering = 'pixelated';
            htmlElements.pipes[topPipeIndex].setAttribute('data-frame', '-1'); 
            flyarea.appendChild(htmlElements.pipes[topPipeIndex]);
        }
        const pipeWidth = pipe.width || CONFIG.pipeWidth;
        const lastFrame = htmlElements.pipes[topPipeIndex].getAttribute('data-frame');
        if (lastFrame !== frameNum) {
            htmlElements.pipes[topPipeIndex].src = `assets/candlesticks/top/frame_${frameNum}_delay-0.1s.gif`;
            htmlElements.pipes[topPipeIndex].setAttribute('data-frame', frameNum);
        }
        htmlElements.pipes[topPipeIndex].style.width = pipeWidth + 'px';
        htmlElements.pipes[topPipeIndex].style.height = pipe.topHeight + 'px';
        htmlElements.pipes[topPipeIndex].style.left = pipe.x + 'px';
        htmlElements.pipes[topPipeIndex].style.top = '0px';
        let bottomPipeIndex = i * 2 + 1;
        if (!htmlElements.pipes[bottomPipeIndex]) {
            htmlElements.pipes[bottomPipeIndex] = document.createElement('img');
            htmlElements.pipes[bottomPipeIndex].style.position = 'absolute';
            htmlElements.pipes[bottomPipeIndex].style.pointerEvents = 'none';
            htmlElements.pipes[bottomPipeIndex].style.zIndex = '10';
            htmlElements.pipes[bottomPipeIndex].style.objectFit = 'fill';
            htmlElements.pipes[bottomPipeIndex].style.imageRendering = 'pixelated';
            htmlElements.pipes[bottomPipeIndex].setAttribute('data-frame', '-1'); 
            flyarea.appendChild(htmlElements.pipes[bottomPipeIndex]);
        }
        const lastBottomFrame = htmlElements.pipes[bottomPipeIndex].getAttribute('data-frame');
        if (lastBottomFrame !== frameNum) {
            htmlElements.pipes[bottomPipeIndex].src = `assets/candlesticks/bottom/frame_${frameNum}_delay-0.1s.gif`;
            htmlElements.pipes[bottomPipeIndex].setAttribute('data-frame', frameNum);
        }
        const pipeGap = pipe.gap || CONFIG.pipeGap; 
        const bottomPipeStart = pipe.topHeight + pipeGap;
        const bottomPipeHeight = flyArea - bottomPipeStart;
        htmlElements.pipes[bottomPipeIndex].style.width = pipeWidth + 'px';
        htmlElements.pipes[bottomPipeIndex].style.height = bottomPipeHeight + 'px';
        htmlElements.pipes[bottomPipeIndex].style.left = pipe.x + 'px';
        htmlElements.pipes[bottomPipeIndex].style.top = bottomPipeStart + 'px';
    });
}
function drawCoinsAsHTML() {
    const flyarea = document.getElementById('flyarea');
    while (htmlElements.coins.length > gameCoins.length) {
        const elem = htmlElements.coins.pop();
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    }
    gameCoins.forEach((coin, i) => {
        if (!htmlElements.coins[i]) {
            htmlElements.coins[i] = document.createElement('img');
            htmlElements.coins[i].src = 'assets/items/COIN.gif';
            htmlElements.coins[i].style.position = 'absolute';
            htmlElements.coins[i].style.pointerEvents = 'none';
            htmlElements.coins[i].style.zIndex = '30';
            htmlElements.coins[i].style.display = 'block';
            htmlElements.coins[i].style.visibility = 'visible';
            htmlElements.coins[i].style.opacity = '1';
            htmlElements.coins[i].setAttribute('data-coin', 'true');
            flyarea.appendChild(htmlElements.coins[i]);
        }
        const coinSize = coin.size || CONFIG.coinSize;
        htmlElements.coins[i].style.width = coinSize + 'px';
        htmlElements.coins[i].style.height = coinSize + 'px';
        htmlElements.coins[i].style.left = (coin.x - coinSize/2) + 'px';
        htmlElements.coins[i].style.top = (coin.y - coinSize/2) + 'px';
        htmlElements.coins[i].style.display = 'block';
    });
}
function drawEnemiesAsHTML() {
    const flyarea = document.getElementById('flyarea');
    while (htmlElements.enemies.length > enemies.length) {
        const elem = htmlElements.enemies.pop();
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    }
    enemies.forEach((enemy, i) => {
        if (!htmlElements.enemies[i]) {
            htmlElements.enemies[i] = document.createElement('img');
            htmlElements.enemies[i].style.position = 'absolute';
            htmlElements.enemies[i].style.pointerEvents = 'none';
            htmlElements.enemies[i].style.zIndex = '40';
            htmlElements.enemies[i].style.display = 'block';
            htmlElements.enemies[i].style.visibility = 'visible';
            htmlElements.enemies[i].style.opacity = '1';
            htmlElements.enemies[i].setAttribute('data-enemy', 'true');
            flyarea.appendChild(htmlElements.enemies[i]);
        }
        const currentCharIndex = htmlElements.enemies[i].getAttribute('data-char-index');
        if (currentCharIndex !== String(enemy.characterIndex)) {
            if (enemy.characterIndex !== undefined && bossOrder[enemy.characterIndex]) {
                const enemySrc = `assets/characters/enemies/${bossOrder[enemy.characterIndex]}?v=${Date.now()}`;
                htmlElements.enemies[i].src = enemySrc;
                htmlElements.enemies[i].setAttribute('data-char-index', enemy.characterIndex);
            }
        }
        const enemySize = enemy.size || CONFIG.enemySize;
        htmlElements.enemies[i].style.width = enemySize + 'px';
        htmlElements.enemies[i].style.height = enemySize + 'px';
        htmlElements.enemies[i].style.left = (enemy.x - enemySize/2) + 'px';
        htmlElements.enemies[i].style.top = (enemy.y - enemySize/2) + 'px';
        htmlElements.enemies[i].style.display = 'block';
    });
}
function drawBossAsHTML() {
    if (!boss) return;
    const flyarea = document.getElementById('flyarea');
    if (!htmlElements.boss) {
        htmlElements.boss = document.createElement('img');
        if (boss.characterIndex !== undefined && bossOrder[boss.characterIndex]) {
            htmlElements.boss.src = `assets/characters/enemies/${bossOrder[boss.characterIndex]}`;
        }
        htmlElements.boss.style.position = 'absolute';
        htmlElements.boss.style.pointerEvents = 'none';
        htmlElements.boss.style.zIndex = '45';
        htmlElements.boss.style.display = 'block';
        htmlElements.boss.style.filter = 'drop-shadow(0 0 20px red)';
        flyarea.appendChild(htmlElements.boss);
    }
    htmlElements.boss.style.width = boss.width + 'px';
    htmlElements.boss.style.height = boss.height + 'px';
    htmlElements.boss.style.left = (boss.x - boss.width/2) + 'px';
    htmlElements.boss.style.top = (boss.y - boss.height/2) + 'px';
}
function drawBossProjectiles() {
    if (!bossActive || !boss || !boss.projectiles || boss.projectiles.length === 0) return;
    ctx.save();
    for (const proj of boss.projectiles) {
        if (!proj) continue;
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size / 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
function drawBossHealthBar() {
    if (!boss) return;
    const barWidth = boss.width * 0.9; 
    const barHeight = 8;
    const barX = boss.x - barWidth / 2;
    const barY = boss.y - boss.height / 2 - 20; 
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const healthPercent = Math.max(0, bossHealth / bossMaxHealth);
    ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.ceil(bossHealth)}%`, boss.x, barY - 5);
    ctx.shadowBlur = 0;
}
function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation * Math.PI / 180);
    if (imagesLoaded && images.bird.complete) {
        ctx.drawImage(images.bird, -bird.width/2, -bird.height/2, bird.width, bird.height);
    } else {
        ctx.fillStyle = '#FFD93D';
        ctx.beginPath();
        ctx.arc(0, 0, bird.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
function drawPipe(pipe) {
    if (imagesLoaded && images.pipeDown.complete && images.pipeUp.complete) {
        ctx.drawImage(images.pipeDown, pipe.x, 0, CONFIG.pipeWidth, pipe.topHeight);
        const pipeGap = pipe.gap || CONFIG.pipeGap; 
        const bottomPipeStart = pipe.topHeight + pipeGap;
        const bottomPipeHeight = flyArea - bottomPipeStart;
        ctx.drawImage(images.pipeUp, pipe.x, bottomPipeStart, CONFIG.pipeWidth, bottomPipeHeight);
    } else {
        const pipeGap = pipe.gap || CONFIG.pipeGap;
        ctx.fillStyle = '#5cb85c';
        ctx.fillRect(pipe.x, 0, CONFIG.pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.topHeight + pipeGap, CONFIG.pipeWidth, flyArea - pipe.topHeight - pipeGap);
    }
}
function drawCoin(coin) {
    ctx.save();
    ctx.translate(coin.x, coin.y);
    if (imagesLoaded && images.coin.complete) {
        ctx.drawImage(images.coin, -CONFIG.coinSize/2, -CONFIG.coinSize/2, CONFIG.coinSize, CONFIG.coinSize);
    } else {
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 15;
    const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, CONFIG.coinSize / 2);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.7, '#FFA500');
    gradient.addColorStop(1, '#FF8C00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.coinSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FF8C00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.coinSize / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8B4513';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    }
    ctx.restore();
}
function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (images.enemies.length > 0 && enemy.characterIndex !== undefined) {
        const characterImg = images.enemies[enemy.characterIndex];
        if (characterImg && characterImg.complete) {
            ctx.drawImage(characterImg, -CONFIG.enemySize/2, -CONFIG.enemySize/2, CONFIG.enemySize, CONFIG.enemySize);
            ctx.restore();
            return;
        }
    }
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.enemySize / 2, 0, Math.PI * 2);
    ctx.fill();
    const wingAngle = Math.sin(enemy.frame) * 0.5;
    ctx.fillStyle = '#A52A2A';
    ctx.beginPath();
    ctx.ellipse(-CONFIG.enemySize / 2, 0, 12, 8, -wingAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CONFIG.enemySize / 2, 0, 12, 8, wingAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(-5, -3, 4, 0, Math.PI * 2);
    ctx.arc(5, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(-3, 5);
    ctx.lineTo(-3, 10);
    ctx.lineTo(-1, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(3, 10);
    ctx.lineTo(1, 5);
    ctx.fill();
    ctx.restore();
}
function spawnPipe(forceStatic = false, offsetDistance = 0) {
    const isMobile = window.innerWidth <= 600;
    const pipeWidth = isMobile ? CONFIG.pipeWidth * 0.75 : CONFIG.pipeWidth; 
    const coinSize = isMobile ? CONFIG.coinSize * 0.75 : CONFIG.coinSize; 
    const enemySize = isMobile ? CONFIG.enemySize * 0.75 : CONFIG.enemySize; 
    const gapReduction = Math.min(score * 1, 60); 
    const baseGap = isMobile ? 180 : CONFIG.pipeGap; 
    const minGap = isMobile ? 150 : 140; 
    const currentGap = Math.max(baseGap - gapReduction, minGap);
    const minHeight = 50;
    const maxHeight = flyArea - currentGap - 100;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    const pipeGap = currentGap;
    const gapCenter = topHeight + pipeGap / 2;
    if (!forceStatic) {
        pipeSpawnCounter++;
    }
    const isStatic = forceStatic || (pipeSpawnCounter % 2 === 0); 
    const staticFrames = [7, 8, 9, 10, 11];
    const staticFrame = isStatic ? staticFrames[Math.floor(Math.random() * staticFrames.length)] : 0;
    pipes.push({
        x: canvas.width + offsetDistance, 
        topHeight: topHeight,
        passed: false,
        frame: staticFrame,
        gap: currentGap,
        width: pipeWidth, 
        isStatic: isStatic, 
        staticFrame: staticFrame 
    });
    if (Math.random() > 0.05) {
        gameCoins.push({
            x: canvas.width + pipeWidth / 2 + offsetDistance,
            y: gapCenter + (Math.random() - 0.5) * 40,
            frame: 0,
            size: coinSize
        });
    }
}
function spawnCoin() {
}
function spawnCoinSafely() {
}
function spawnCoinInPipeGap() {
}
function spawnEnemy() {
}
function spawnEnemyInPipeGap() {
}
function spawnPowerUp() {
    const spawnNearTop = Math.random() > 0.5;
    const yPosition = spawnNearTop 
        ? Math.random() * 80 + 30  
        : flyArea - Math.random() * 80 - 30; 
    powerUps.push({
        x: canvas.width,
        y: yPosition,
        type: 'slowMotion',
        rotation: 0,
        size: 90
    });
}
function activateSlowMotion() {
    slowMotionActive = true;
    slowMotionEndTime = Date.now() + 3000;
    playSound('coin');
}
function updatePowerUps(speed) {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].x -= speed;
        if (powerUps[i].x + powerUps[i].size < 0) {
            powerUps.splice(i, 1);
            continue;
        }
        const dx = bird.x - powerUps[i].x;
        const dy = bird.y - powerUps[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < (bird.width / 2 + powerUps[i].size / 2)) {
            activateSlowMotion();
            powerUps.splice(i, 1);
        }
    }
    if (slowMotionActive && Date.now() >= slowMotionEndTime) {
        slowMotionActive = false;
    }
}
let powerUpElements = [];
function drawPowerUps() {
    const flyarea = document.getElementById('flyarea');
    while (powerUpElements.length > powerUps.length) {
        const elem = powerUpElements.pop();
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    }
    powerUps.forEach((powerUp, i) => {
        if (!powerUpElements[i]) {
            powerUpElements[i] = document.createElement('img');
            powerUpElements[i].src = 'assets/items/GOLD COIN.gif';
            powerUpElements[i].style.position = 'absolute';
            powerUpElements[i].style.pointerEvents = 'none';
            powerUpElements[i].style.zIndex = '30';
            powerUpElements[i].style.display = 'block';
            powerUpElements[i].style.filter = 'drop-shadow(0 0 10px gold)';
            flyarea.appendChild(powerUpElements[i]);
        }
        powerUpElements[i].style.width = powerUp.size + 'px';
        powerUpElements[i].style.height = powerUp.size + 'px';
        powerUpElements[i].style.left = (powerUp.x - powerUp.size/2) + 'px';
        powerUpElements[i].style.top = (powerUp.y - powerUp.size/2) + 'px';
        powerUpElements[i].style.display = 'block';
    });
}
function drawSlowMotionIndicator() {
    if (!slowMotionActive) return;
    const timeLeft = Math.max(0, slowMotionEndTime - Date.now());
    const percent = timeLeft / 3000;
    const isMobile = window.innerWidth <= 600;
    const barWidth = 150;
    const barHeight = 6;
    const barX = (canvas.width - barWidth) / 2;
    const barY = isMobile ? canvas.height - 80 : canvas.height * 0.7; 
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SLOW MOTION', canvas.width / 2, barY - 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = '#00d9ff';
    ctx.fillRect(barX, barY, barWidth * percent, barHeight);
}
function startBossFight() {
    bossActive = true;
    lastBossScore = score;
    bossMaxHealth = 100; 
    bossHealth = bossMaxHealth;
    pipes = [];
    gameCoins = [];
    enemies = [];
    powerUps = [];
    slowMotionActive = false;
    const isMobile = window.innerWidth <= 600;
    const bossSize = 180; 
    const bossXPosition = isMobile ? 0.85 : 0.75; 
    boss = {
        x: canvas.width * bossXPosition,
        y: flyArea / 2,
        width: bossSize,
        height: bossSize,
        velocityY: 0,
        targetY: flyArea / 2,
        attackTimer: 0,
        attackPattern: 0, 
        frame: 0,
        characterIndex: currentBossIndex, 
        projectiles: []
    };
    currentBossIndex = (currentBossIndex + 1) % bossOrder.length;
}
function updateBoss(gameSpeed) {
    if (!boss) return;
    boss.targetY = flyArea * 0.3 + Math.sin(frames / 40) * (flyArea * 0.3);
    boss.velocityY += (boss.targetY - boss.y) * 0.03;
    boss.y += boss.velocityY;
    boss.velocityY *= 0.92;
    boss.frame = Math.floor((frames / 9) % 4);
    boss.attackTimer++;
    if (boss.attackTimer % 180 === 0) {
        boss.attackPattern = (boss.attackPattern + 1) % 4; 
    }
    const isMobile = window.innerWidth <= 600;
    const isMachineGun = boss.attackPattern === 3;
    const shootInterval = isMobile ? 
        (isMachineGun ? 40 : 60) : 
        30; 
    const maxProjectiles = isMachineGun ? 6 : 2;
    const canShoot = isMobile ? (boss.projectiles.length <= maxProjectiles) : true;
    if (boss.attackTimer % shootInterval === 0 && canShoot) {
        shootBossPattern(boss.attackPattern);
    }
    updateBossProjectiles();
    if (frames % 6 === 0) { 
        bossHealth -= 0.5; 
    }
    if (checkBossProjectileCollision()) {
        gameOver();
        return;
    }
    if (bossHealth <= 0) {
        endBossFight(true);
        return;
    }
}
function shootBossPattern(patternIndex) {
    if (!boss || !bossActive) return;
    const isMobile = window.innerWidth <= 600;
    const projectileScale = isMobile ? 0.8 : 1.0;
    const velocityMultiplier = gameSpeedMultiplier;
    const startX = boss.x - boss.width / 2;
    const startY = boss.y;
    switch(patternIndex) {
        case 0:
            if (isMobile) {
                const targetY = Math.random() * flyArea;
                const dy = targetY - startY;
                const dx = -canvas.width;
                const angle = Math.atan2(dy, dx);
                boss.projectiles.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(angle) * 5 * velocityMultiplier, 
                    vy: Math.sin(angle) * 5 * velocityMultiplier,
                    size: 30 * projectileScale
                });
            } else {
                boss.projectiles.push({
                    x: startX,
                    y: startY,
                    vx: -6 * velocityMultiplier,
                    vy: 0,
                    size: 30 * projectileScale
                });
            }
            break;
        case 1:
            const angleRange = isMobile ? 50 : 30; 
            const angleStep = isMobile ? 25 : 30; 
            const spreadSpeed = isMobile ? 4.5 : 5; 
            for (let angle = -angleRange; angle <= angleRange; angle += angleStep) {
                const rad = (angle * Math.PI) / 180;
                boss.projectiles.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(rad + Math.PI) * spreadSpeed * velocityMultiplier,
                    vy: Math.sin(rad + Math.PI) * spreadSpeed * velocityMultiplier,
                    size: 25 * projectileScale
                });
            }
            break;
        case 2:
            const bulletCount = isMobile ? 6 : 5; 
            const spiralSpeed = isMobile ? 3.5 : 4; 
            for (let i = 0; i < bulletCount; i++) {
                const angle = (i * (360 / bulletCount)) + (frames * 2);
                const rad = (angle * Math.PI) / 180;
                boss.projectiles.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(rad) * spiralSpeed * velocityMultiplier,
                    vy: Math.sin(rad) * spiralSpeed * velocityMultiplier,
                    size: 20 * projectileScale
                });
            }
            break;
        case 3:
            if (isMobile) {
                const targetY = bird.y;
                const dy = targetY - startY;
                const dx = -canvas.width;
                const angle = Math.atan2(dy, dx);
                for (let i = 0; i < 3; i++) {
                    const spreadAngle = (i - 1) * 0.15; 
                    boss.projectiles.push({
                        x: startX,
                        y: startY,
                        vx: Math.cos(angle + spreadAngle) * 5.5 * velocityMultiplier,
                        vy: Math.sin(angle + spreadAngle) * 5.5 * velocityMultiplier,
                        size: 22 * projectileScale
                    });
                }
            } else {
                boss.projectiles.push({
                    x: startX,
                    y: startY,
                    vx: -7 * velocityMultiplier,
                    vy: 0,
                    size: 25 * projectileScale
                });
            }
            break;
    }
    if (soundEnabled && sounds.bossShoot) {
        try {
            sounds.bossShoot.currentTime = 0;
            sounds.bossShoot.play().catch(err => {});
        } catch (e) {}
    }
}
function updateBossProjectiles() {
    if (!boss) return;
    for (let i = boss.projectiles.length - 1; i >= 0; i--) {
        const proj = boss.projectiles[i];
        proj.x += proj.vx;
        proj.y += proj.vy;
        if (proj.x < -50 || proj.x > canvas.width + 50 || 
            proj.y < -50 || proj.y > flyArea + 50) {
            boss.projectiles.splice(i, 1);
        }
    }
}
function checkBossProjectileCollision() {
    if (!boss) return false;
    const birdLeft = bird.x - bird.width / 2 + 10; 
    const birdRight = bird.x + bird.width / 2 - 10;
    const birdTop = bird.y - bird.height / 2 + 10;
    const birdBottom = bird.y + bird.height / 2 - 10;
    for (const proj of boss.projectiles) {
        const projLeft = proj.x - proj.size / 2;
        const projRight = proj.x + proj.size / 2;
        const projTop = proj.y - proj.size / 2;
        const projBottom = proj.y + proj.size / 2;
        if (!(birdRight < projLeft || birdLeft > projRight || 
              birdBottom < projTop || birdTop > projBottom)) {
            if (soundEnabled && sounds.die) {
                try {
                    sounds.die.currentTime = 0;
                    sounds.die.play().catch(err => {});
                } catch (e) {}
            }
            return true; 
        }
    }
    return false;
}
function endBossFight(victory) {
    if (!bossActive) return; 
    bossActive = false;
    if (boss) {
        boss.projectiles = [];
    }
    boss = null;
    if (htmlElements.boss && htmlElements.boss.parentNode) {
        htmlElements.boss.parentNode.removeChild(htmlElements.boss);
        htmlElements.boss = null;
    }
    if (victory) {
        if (soundEnabled && sounds.bossDefeat) {
            try {
                sounds.bossDefeat.currentTime = 0;
                sounds.bossDefeat.play().catch(err => {});
            } catch (e) {}
        }
        lastBossScore = score;
        const bossReward = 10;
        coins += bossReward;
        score += bossReward; 
        updateBigScore();
        updateHUD();
        playSound('coin');
        showScorePopup('+10', boss.x, boss.y);
    }
}
function checkPipeCollision(pipe) {
    if (!masksPrecomputed || !window.collisionSystem) {
        return false;
    }
    const pipeFrame = Math.min(pipe.frame || 0, 19);
        const birdFrame = bird.frame || 0;
        const birdPos = {
            x: bird.x - bird.width / 2,
            y: bird.y - bird.height / 2,
            width: bird.width,
            height: bird.height
        };
        const topPipePos = {
            x: pipe.x,
            y: 0,
            width: CONFIG.pipeWidth,
            height: pipe.topHeight
        };
    if (window.collisionSystem.checkPixelCollision('bird', birdFrame, birdPos, 'pipeDown', pipeFrame, topPipePos)) {
            return true;
        }
    const pipeGap = pipe.gap || CONFIG.pipeGap; 
    const bottomPipeStart = pipe.topHeight + pipeGap;
        const bottomPipePos = {
            x: pipe.x,
            y: bottomPipeStart,
            width: CONFIG.pipeWidth,
            height: flyArea - bottomPipeStart
        };
    return window.collisionSystem.checkPixelCollision('bird', birdFrame, birdPos, 'pipeUp', pipeFrame, bottomPipePos);
}
function checkCoinCollision(coin) {
    if (pixelPerfectCollision && masksPrecomputed && window.collisionSystem) {
        const coinFrame = coin.frame || 0;
        const birdFrame = bird.frame || 0;
        const birdPos = {
            x: bird.x - bird.width / 2,
            y: bird.y - bird.height / 2,
            width: bird.width,
            height: bird.height
        };
        const coinPos = {
            x: coin.x - CONFIG.coinSize / 2,
            y: coin.y - CONFIG.coinSize / 2,
            width: CONFIG.coinSize,
            height: CONFIG.coinSize
        };
        return window.collisionSystem.checkPixelCollision(
            'bird', birdFrame, birdPos,
            'coin', coinFrame, coinPos
        );
    } else {
        const dx = bird.x - coin.x;
        const dy = bird.y - coin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < bird.height / 2 + CONFIG.coinSize / 2;
    }
}
function checkEnemyCollision(enemy) {
    if (pixelPerfectCollision && masksPrecomputed && window.collisionSystem) {
        const enemyFrame = Math.floor(enemy.frame) || 0;
        const birdFrame = bird.frame || 0;
        const enemyId = `enemy_${enemy.characterIndex}`;
        const birdPos = {
            x: bird.x - bird.width / 2,
            y: bird.y - bird.height / 2,
            width: bird.width,
            height: bird.height
        };
        const enemyPos = {
            x: enemy.x - CONFIG.enemySize / 2,
            y: enemy.y - CONFIG.enemySize / 2,
            width: CONFIG.enemySize,
            height: CONFIG.enemySize
        };
        return window.collisionSystem.checkPixelCollision(
            'bird', birdFrame, birdPos,
            enemyId, enemyFrame, enemyPos
        );
    } else {
        const dx = bird.x - enemy.x;
        const dy = bird.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < bird.height / 2 + CONFIG.enemySize / 2;
    }
}
function updateBigScore() {
    if (score === lastDisplayedScore) return;
    lastDisplayedScore = score;
    const bigscoreEl = document.getElementById('bigscore');
    bigscoreEl.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'row';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.flexWrap = 'nowrap';
    wrapper.style.gap = '2px';
    const digits = score.toString().split('');
    digits.forEach(digit => {
        const img = document.createElement('img');
        img.src = `assets/fonts/big/${digit}.png`;
        img.style.display = 'block';
        img.style.height = 'auto';
        img.style.width = 'auto';
        img.style.maxHeight = '60px';
        img.style.flexShrink = '0';
        img.style.imageRendering = 'pixelated';
        wrapper.appendChild(img);
    });
    bigscoreEl.appendChild(wrapper);
}
function updateHUD() {
}
function setSmallScore(elementId, value) {
    const element = document.getElementById(elementId);
    element.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'row';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.flexWrap = 'nowrap';
    const digits = value.toString().split('');
    digits.forEach(digit => {
        const img = document.createElement('img');
        img.src = `assets/fonts/small/${digit}.png`;
        wrapper.appendChild(img);
    });
    element.appendChild(wrapper);
}
function setMedal() {
    const medalEl = document.getElementById('medal');
    medalEl.innerHTML = '';
    if (score < 10) {
        medalEl.style.opacity = '0';
        return;
    }
    let medalType = 'bronze';
    if (score >= 40) medalType = 'platinum';
    else if (score >= 30) medalType = 'gold';
    else if (score >= 20) medalType = 'silver';
    const img = document.createElement('img');
    img.src = `assets/medal_${medalType}.png`;
    medalEl.appendChild(img);
    medalEl.style.opacity = '1';
}
async function gameOver() {
    gameState = 'gameOver';
    isPaused = false;
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('pauseOverlay').style.display = 'none';
    if (bossActive) {
        endBossFight(false); 
    }
    if (sounds.soundtrack) {
        sounds.soundtrack.pause();
        sounds.soundtrack.currentTime = 0;
    }
    playSound('die');
    performDeathAnimation();
    document.querySelectorAll('.animated').forEach(el => {
        el.classList.add('paused');
    });
    if (score > highscore) {
        highscore = score;
        saveHighScore();
    }
    const qualifiesForTop10 = await isTop10Score(score);
    const savedName = getSavedPlayerName();
    if (qualifiesForTop10 && !savedName) {
        showNameInputModal();
    } else if (savedName) {
        await saveScore(savedName);
    }
    document.getElementById('bigscore').style.display = 'none';
    setTimeout(async () => {
        const scoreboard = document.getElementById('scoreboard');
        scoreboard.style.display = 'block';
        scoreboard.style.opacity = '1';
        const replayBtn = document.getElementById('replay');
        replayBtn.style.display = 'flex';
        replayBtn.style.opacity = '1';
        const shareBtn = document.getElementById('sharebutton');
        shareBtn.style.display = 'flex';
        shareBtn.style.opacity = '1';
        const buyBtn = document.getElementById('buylongbutton');
        buyBtn.style.display = 'flex';
        buyBtn.style.opacity = '1';
        document.getElementById('leaderboard-container').style.display = 'block';
        setSmallScore('currentscore', score);
        setSmallScore('highscore', highscore);
        setMedal();
        await displayLeaderboard();
        playSound('swoosh');
    }, 500);
}
function getSavedPlayerName() {
    return localStorage.getItem('golongPlayerName');
}
function savePlayerName(name) {
    localStorage.setItem('golongPlayerName', name);
}
async function isTop10Score(playerScore) {
    if (!supabaseClient) return true; 
    try {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('score')
            .order('score', { ascending: false })
            .limit(10);
        if (error) throw error;
        if (!data || data.length < 10) return true;
        const tenthScore = data[9].score;
        return playerScore > tenthScore;
    } catch (error) {
        console.error('Error checking top 10:', error);
        return true; 
    }
}
async function saveScore(playerName) {
    if (!supabaseClient || !playerName) return;
    try {
        const { data: existingData, error: fetchError } = await supabaseClient
            .from('leaderboard')
            .select('*')
            .eq('player_name', playerName)
            .maybeSingle();
        if (fetchError) {
            console.error('Error fetching existing data:', fetchError);
            return;
        }
        if (existingData) {
            if (score > existingData.score) {
                const { error: updateError } = await supabaseClient
                    .from('leaderboard')
                    .update({ score: score })
                    .eq('player_name', playerName);
                if (updateError) {
                    console.error('Error updating score:', updateError);
                }
            }
        } else {
            const { error: insertError } = await supabaseClient
                .from('leaderboard')
                .insert([{ player_name: playerName, score: score }]);
            if (insertError) {
                console.error('Error inserting score:', insertError);
            }
        }
    } catch (error) {
        console.error('Error saving score:', error);
    }
}
async function getLeaderboard() {
    if (!supabaseClient) {
        const data = localStorage.getItem('flappyBirdLeaderboard');
        return data ? JSON.parse(data) : [];
    }
    try {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}
async function displayLeaderboard() {
    const leaderboard = await getLeaderboard();
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';
    if (leaderboard.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No scores yet!</td></tr>';
        return;
    }
    const trophyImages = {
        1: 'assets/medals/trophies/top1.png',
        2: 'assets/medals/trophies/top2.png',
        3: 'assets/medals/trophies/top3.png'
    };
    leaderboard.forEach((entry, index) => {
        const row = document.createElement('tr');
        const rank = index + 1;
        if (rank <= 3) {
            row.className = `trophy-rank${rank}`;
        }
        let trophyCell = '<td class="trophy-col">';
        if (rank <= 3) {
            trophyCell += `<img src="${trophyImages[rank]}" class="trophy-icon" alt="${rank}">`;
        } else {
            trophyCell += '';
        }
        trophyCell += '</td>';
        row.innerHTML = `
            ${trophyCell}
            <td>${rank}</td>
            <td>${entry.player_name || 'Anonymous'}</td>
            <td>${entry.score}</td>
        `;
        tbody.appendChild(row);
    });
}
async function displayStartLeaderboard() {
    const leaderboard = await getLeaderboard();
    const tbody = document.getElementById('startLeaderboardBody');
    tbody.innerHTML = '';
    if (leaderboard.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No scores yet!</td></tr>';
        return;
    }
    const trophyImages = {
        1: 'assets/medals/trophies/top1.png',
        2: 'assets/medals/trophies/top2.png',
        3: 'assets/medals/trophies/top3.png'
    };
    leaderboard.forEach((entry, index) => {
        const row = document.createElement('tr');
        const rank = index + 1;
        if (rank <= 3) {
            row.className = `trophy-rank${rank}`;
        }
        let trophyCell = '<td class="trophy-col">';
        if (rank <= 3) {
            trophyCell += `<img src="${trophyImages[rank]}" class="trophy-icon" alt="${rank}">`;
        } else {
            trophyCell += '';
        }
        trophyCell += '</td>';
        row.innerHTML = `
            ${trophyCell}
            <td>${rank}</td>
            <td>${entry.player_name || 'Anonymous'}</td>
            <td>${entry.score}</td>
        `;
        tbody.appendChild(row);
    });
}
function shareScore() {
    const text = `I just scored ${score} points on GO $LONG by @long! Play now and see if you can beat my score! Play here: https://longonsol.com/game`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
}
function buyLong() {
    window.open('https://pump.fun/coin/31a7WPnRKh64kVZbb2RVetY1uE1EjRE7bitoF2cxpump', '_blank');
}
function showScorePopup(text, x, y) {
    const popup = document.createElement('div');
    popup.textContent = text;
    popup.style.position = 'absolute';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    popup.style.fontSize = '48px';
    popup.style.fontFamily = "'Press Start 2P', monospace";
    popup.style.color = '#FFD700';
    popup.style.fontWeight = 'bold';
    popup.style.textShadow = '4px 4px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.8)';
    popup.style.zIndex = '9999';
    popup.style.pointerEvents = 'none';
    popup.style.animation = 'scorePopup 2s ease-out forwards';
    const flyarea = document.getElementById('flyarea');
    flyarea.appendChild(popup);
    setTimeout(() => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 2000);
}
function performDeathAnimation() {
    const birdElement = htmlElements.bird;
    if (!birdElement) return;
    const isMobile = window.innerWidth <= 600;
    if (isMobile) {
        birdElement.style.opacity = '0';
        return;
    }
    let flashCount = 0;
    const maxFlashes = 6;
    const flashInterval = setInterval(() => {
        flashCount++;
        if (flashCount % 2 === 0) {
            birdElement.style.opacity = '0';
        } else {
            birdElement.style.opacity = '1';
        }
        if (flashCount >= maxFlashes) {
            clearInterval(flashInterval);
            birdElement.style.opacity = '0'; 
        }
    }, 100); 
}
function showNameInputModal() {
    const modal = document.getElementById('nameInputModal');
    const input = document.getElementById('playerNameInput');
    modal.style.display = 'flex';
    input.value = '';
}
function hideNameInputModal() {
    const modal = document.getElementById('nameInputModal');
    modal.style.display = 'none';
}
async function handleNameSubmit() {
    const input = document.getElementById('playerNameInput');
    const playerName = input.value.trim();
    if (!playerName) {
        alert('Please enter a name!');
        return;
    }
    savePlayerName(playerName);
    await saveScore(playerName);
    hideNameInputModal();
    await displayLeaderboard();
}
function playSound(type) {
    if (!soundEnabled) return;
    try {
        switch(type) {
            case 'jump':
                sounds.jump.currentTime = 0;
                sounds.jump.play().catch(e => {});
                break;
            case 'score':
                sounds.score.currentTime = 0;
                sounds.score.play().catch(e => {});
                break;
            case 'coin':
                const coinSound = sounds.score.cloneNode();
                coinSound.volume = 0.2;
                coinSound.playbackRate = 1.5;
                coinSound.play().catch(e => {});
                break;
            case 'hit':
                sounds.hit.currentTime = 0;
                sounds.hit.play().catch(e => {});
                break;
            case 'die':
                sounds.die.currentTime = 0;
                sounds.die.play().catch(e => {});
                break;
            case 'swoosh':
                sounds.swoosh.currentTime = 0;
                sounds.swoosh.play().catch(e => {});
                break;
        }
    } catch(e) {}
}
function togglePause() {
    if (gameState !== 'playing') return;
    isPaused = !isPaused;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (isPaused) {
        pauseOverlay.style.display = 'flex';
        document.querySelectorAll('.animated').forEach(el => {
            el.classList.add('paused');
        });
        if (sounds.soundtrack) {
            sounds.soundtrack.pause();
        }
    } else {
        pauseOverlay.style.display = 'none';
        document.querySelectorAll('.animated').forEach(el => {
            el.classList.remove('paused');
        });
        if (musicEnabled && sounds.soundtrack) {
            sounds.soundtrack.play().catch(e => {});
        }
    }
}
function toggleMusic() {
    musicEnabled = !musicEnabled;
    const musicBtn = document.getElementById('musicToggle');
    const musicText = musicBtn ? musicBtn.querySelector('.music-text') : null;
    const scoreboardMusicBtn = document.getElementById('scoreboardMusicToggle');
    const scoreboardMusicText = scoreboardMusicBtn ? scoreboardMusicBtn.querySelector('.music-icon') : null;
    if (musicEnabled) {
        if (musicText) {
            musicText.textContent = 'ON';
            musicText.style.color = '#46DDB1';
            musicBtn.classList.remove('off');
        }
        if (scoreboardMusicText) {
            scoreboardMusicText.textContent = 'MUSIC ON';
            scoreboardMusicText.style.color = '#46DDB1';
            scoreboardMusicBtn.classList.remove('off');
        }
        if (gameState === 'playing' && !isPaused && sounds.soundtrack) {
            sounds.soundtrack.play().catch(e => {});
        }
    } else {
        if (musicText) {
            musicText.textContent = 'OFF';
            musicText.style.color = '#999';
            musicBtn.classList.add('off');
        }
        if (scoreboardMusicText) {
            scoreboardMusicText.textContent = 'MUSIC OFF';
            scoreboardMusicText.style.color = '#999';
            scoreboardMusicBtn.classList.add('off');
        }
        if (sounds.soundtrack) {
            sounds.soundtrack.pause();
        }
    }
}
function toggleSound() {
    soundEnabled = !soundEnabled;
    const soundBtn = document.getElementById('soundToggle');
    const soundText = soundBtn ? soundBtn.querySelector('.sound-text') : null;
    const scoreboardSfxBtn = document.getElementById('scoreboardSfxToggle');
    const scoreboardSfxText = scoreboardSfxBtn ? scoreboardSfxBtn.querySelector('.music-icon') : null;
    if (soundEnabled) {
        if (soundText) {
            soundText.textContent = 'ON';
            soundText.style.color = '#46DDB1';
            soundBtn.classList.remove('off');
        }
        if (scoreboardSfxText) {
            scoreboardSfxText.textContent = 'SFX ON';
            scoreboardSfxText.style.color = '#46DDB1';
            scoreboardSfxBtn.classList.remove('off');
        }
    } else {
        if (soundText) {
            soundText.textContent = 'OFF';
            soundText.style.color = '#999';
            soundBtn.classList.add('off');
        }
        if (scoreboardSfxText) {
            scoreboardSfxText.textContent = 'SFX OFF';
            scoreboardSfxText.style.color = '#999';
            scoreboardSfxBtn.classList.add('off');
        }
    }
}
