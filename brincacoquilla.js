/*
Game: Dale Coquilla!
Version: 1.0.0
Author: Federico Guzman (kraiosis)
Website: http://fedguzman.com

*/
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("current-score");
const highScoreElement = document.getElementById("high-score");
const flyCountElement = document.getElementById("fly-count");
const gameOverScreen = document.getElementById("game-over-screen");
const gameOverScoreElement = document.getElementById("game-over-score");
const gameOverHighScoreElement = document.getElementById("game-over-high-score");
const splashScreen = document.getElementById("splash-screen");
const startButton = document.getElementById("start-button");
const fullscreenButton = document.getElementById("fullscreen-button");
const fullscreenError = document.getElementById("fullscreen-error");
const audioButton = document.getElementById("audio-button");
const audioStatus = document.getElementById("audio-status");
const backgroundMusic = document.getElementById("background-music");
backgroundMusic.volume = 0.21;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Game Settings & States
const GRAVITY = 0.6;
let gameSpeed = 6;
let score = 0;
let highScore = 0;
let fliesEaten = 0;
let isGameOver = false;
let hasStarted = false;
let audioEnabled = true;

// Entity Containers
let obstacles = [];
let flies = [];
let scorePopups = []; // Text elements that float up when eating flies
let clouds = [
    { x: 120, y: 58, scale: 1.05, speed: 0.35 },
    { x: 430, y: 92, scale: 0.72, speed: 0.24 },
    { x: 700, y: 43, scale: 0.88, speed: 0.3 }
];
let habitatOffset = 0;
const habitatPlants = Array.from({ length: 14 }, (_, index) => ({
    x: index * 68 + 16,
    height: 12 + (index * 17 % 20),
    lean: index % 2 === 0 ? -1 : 1,
    color: ["#397b45", "#508b49", "#2f6d46"][index % 3]
}));
let weatherCycleFrame = 0;
const weatherCycleLength = 1200;
const rainyWeatherStart = 660;
let rainParticles = [];
for (let i = 0; i < 42; i++) {
    rainParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: 5 + Math.random() * 7,
        speed: 1.4 + Math.random() * 1.4
    });
}

// Spawning Triggers
let spawnTimer = 0;
let flySpawnTimer = 0;
let animationFrameCount = 0;
let spacePressed = false;

// Frog Player Object
const frog = {
    x: 60, y: 206, width: 36, height: 34, velocityY: 0, isJumping: false, isRunning: false, jumpForce: -12.5,
    draw() {
        ctx.save();
        const airborne = this.isJumping;
        const jumpArc = airborne ? Math.min(1, Math.abs(this.velocityY) / 12.5) : 0;
        let squishX = airborne ? -3 * jumpArc : (animationFrameCount % 30 < 8 ? 2 : 0);
        let squishY = airborne ? 3 * jumpArc : (animationFrameCount % 30 < 8 ? -1 : 0);
        const rX = this.x - squishX / 2, rY = this.y - squishY, rW = this.width + squishX, rH = this.height + squishY;

        ctx.fillStyle = "#2d5a27";
        ctx.beginPath();
        if (airborne) {
            const stretch = Math.min(1, Math.abs(this.velocityY) / 10);
            const legLength = 10 + stretch * 7;
            const legAngle = 0.55 + stretch * 0.2;
            ctx.ellipse(rX + 3, rY + rH - 5, 5, legLength, -legAngle, 0, Math.PI * 2);
            ctx.ellipse(rX + rW - 3, rY + rH - 5, 5, legLength, legAngle, 0, Math.PI * 2);
        } else {
            const stride = this.isRunning ? Math.sin(animationFrameCount * 0.7) * 2 : 0;
            ctx.ellipse(rX + 4, rY + rH - 8, 7, 9 + stride, Math.PI / 4, 0, Math.PI * 2);
            ctx.ellipse(rX + rW - 4, rY + rH - 8, 7, 9 - stride, -Math.PI / 4, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = "#4e9c45"; // Core Body
        ctx.beginPath(); ctx.arc(rX + rW/2, rY + rH/2 + 2, rW/2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#d4f5cc"; // Belly
        ctx.beginPath(); ctx.arc(rX + rW/2, rY + rH/2 + 5, rW/3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4e9c45"; // Front Flippers
        ctx.fillRect(rX + 6, rY + rH - 5, 4, 8); ctx.fillRect(rX + rW - 10, rY + rH - 5, 4, 8);
        ctx.beginPath(); ctx.arc(rX + 10, rY + 4, 7, 0, Math.PI * 2); ctx.arc(rX + rW - 10, rY + 4, 7, 0, Math.PI * 2); ctx.fill(); // Eyes
        ctx.fillStyle = "#ffffff"; // Whites of eyes
        ctx.beginPath(); ctx.arc(rX + 10, rY + 3, 5, 0, Math.PI * 2); ctx.arc(rX + rW - 10, rY + 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#111827"; // Pupils
        ctx.beginPath(); ctx.arc(rX + 11.5, rY + 3, 2.5, 0, Math.PI * 2); ctx.arc(rX + rW - 8.5, rY + 3, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1e3d1a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rX + rW/2, rY + 14, 4, 0, Math.PI); ctx.stroke(); // Smile
        ctx.restore();
    },
    update() {
        this.isRunning = hasStarted && !isGameOver && !this.isJumping;
        this.velocityY += GRAVITY; this.y += this.velocityY;
        const floorY = canvas.height - this.height - 10;
        if (this.y >= floorY) { this.y = floorY; this.velocityY = 0; this.isJumping = false; }
    },
    jump() {
        if (!this.isJumping) {
            this.velocityY = this.jumpForce;
            this.isJumping = true;
        }
    }
};

// Obstacle (Hazards) Blueprint
class Obstacle {
    constructor(speed) {
        const roll = Math.random();
        this.type = roll > 0.80 ? "snake" : roll > 0.66 ? "hole" : roll > 0.52 ? "bridge" : roll > 0.26 ? "thistle" : "stone";
        this.width = this.type === "snake" ? 44 : this.type === "hole" ? 52 + Math.random() * 16 : this.type === "bridge" ? 60 : 20 + Math.random() * 15;
        this.height = this.type === "snake" ? 16 : this.type === "hole" ? 18 : this.type === "bridge" ? 25 : 30 + Math.random() * 20;
        this.x = canvas.width; this.y = canvas.height - this.height - 10; this.speed = speed;
    }
    draw() {
        ctx.save();
        if (this.type === "snake") {
            const centerY = this.y + this.height * 0.62;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#28734b";
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(this.x + 41, centerY + 2);
            ctx.bezierCurveTo(this.x + 34, this.y - 2, this.x + 27, this.y + this.height + 2, this.x + 18, centerY);
            ctx.stroke();
            ctx.fillStyle = "#388b53";
            ctx.beginPath();
            ctx.ellipse(this.x + 12, this.y + 6, 8, 6, 0.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f5f2ce";
            ctx.beginPath();
            ctx.arc(this.x + 9, this.y + 4, 1.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#243b2b";
            ctx.beginPath();
            ctx.arc(this.x + 8.5, this.y + 4, 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#d65b57";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x + 5, this.y + 8);
            ctx.lineTo(this.x, this.y + 9);
            ctx.moveTo(this.x + 1, this.y + 9);
            ctx.lineTo(this.x - 2, this.y + 7);
            ctx.stroke();
        } else if (this.type === "hole") {
            const groundY = canvas.height - 10;
            ctx.fillStyle = "#263f34";
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, groundY + 1, this.width / 2, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#172b28";
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, groundY + 1, this.width / 2 - 4, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(117, 161, 143, 0.65)";
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, groundY + 3, this.width * 0.28, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === "bridge") {
            const groundY = canvas.height - 10;
            const deckY = groundY - this.height + 7;
            ctx.strokeStyle = "#62452d";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.x + 9, deckY + 7);
            ctx.lineTo(this.x + 12, groundY);
            ctx.moveTo(this.x + this.width - 9, deckY + 7);
            ctx.lineTo(this.x + this.width - 12, groundY);
            ctx.stroke();
            ctx.fillStyle = "#8b5e3c";
            ctx.fillRect(this.x, deckY, this.width, 8);
            ctx.fillStyle = "#bd8a58";
            for (let plankX = this.x + 4; plankX < this.x + this.width - 3; plankX += 12) {
                ctx.fillRect(plankX, deckY + 1, 8, 6);
            }
            ctx.strokeStyle = "#62452d";
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, deckY, this.width, 8);
        } else if (this.type === "thistle") {
            ctx.fillStyle = "#6b21a8"; ctx.beginPath(); ctx.moveTo(this.x, this.y + this.height); ctx.lineTo(this.x + this.width / 2, this.y); ctx.lineTo(this.x + this.width, this.y + this.height); ctx.fill();
            ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 2; ctx.stroke();
        } else {
            ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(this.x + this.width/2, this.y + this.height, this.width/2, Math.PI, 0, false); ctx.fill();
        }
        ctx.restore();
    }
    update() { this.x -= this.speed; }
}

// Collectible Fly Blueprint
class Fly {
    constructor(speed) {
        this.width = 16; this.height = 12; this.x = canvas.width;
        this.y = canvas.height - 65 - (Math.random() * 85); this.speed = speed + 0.5;
        this.wingWave = Math.random() * 10;
    }
    draw() {
        ctx.save(); this.wingWave += 0.5; let wingOffset = Math.sin(this.wingWave) * 5;
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // Wings
        ctx.beginPath(); ctx.ellipse(this.x + 3, this.y + 2 - wingOffset, 4, 7, Math.PI/4, 0, Math.PI*2); ctx.ellipse(this.x + 13, this.y + 2 - wingOffset, 4, 7, -Math.PI/4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.ellipse(this.x + 8, this.y + 6, 6, 4, 0, 0, Math.PI*2); ctx.fill(); // Body
        ctx.fillStyle = "#ef4444"; ctx.fillRect(this.x + 4, this.y + 3, 2, 2); // Compound Eyes
        ctx.restore();
    }
    update() { this.x -= this.speed; this.y += Math.sin(this.wingWave) * 0.4; }
}
function formatScore(num) { return String(Math.floor(num)).padStart(5, '0'); }

function spawnEntities() {
    if (spawnTimer <= 0) {
        obstacles.push(new Obstacle(gameSpeed));
        spawnTimer = 80 + Math.random() * 90 - (gameSpeed * 2);
    }
    spawnTimer--;

    if (flySpawnTimer <= 0) {
        flies.push(new Fly(gameSpeed));
        flySpawnTimer = 110 + Math.random() * 130;
    }
    flySpawnTimer--;
}

function checkCollision(rect1, rect2, padding) {
    return (
        rect1.x + padding < rect2.x + rect2.width &&
        rect1.x + rect1.width - padding > rect2.x &&
        rect1.y + padding < rect2.y + rect2.height &&
        rect1.y + rect1.height - padding > rect2.y
    );
}

function drawCloud(cloud) {
    const x = cloud.x, y = cloud.y, s = cloud.scale;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
    ctx.beginPath();
    ctx.ellipse(x, y, 24 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 15 * s, y + 1 * s, 13 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 13 * s, y - 2 * s, 15 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 1 * s, y - 6 * s, 13 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function updateAndDrawWeather() {
    const advancing = hasStarted && !isGameOver;
    if (advancing) weatherCycleFrame = (weatherCycleFrame + 1) % weatherCycleLength;
    const raining = hasStarted && weatherCycleFrame >= rainyWeatherStart;

    if (!raining) {
        const sunX = canvas.width - 86, sunY = 48;
        const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 36);
        glow.addColorStop(0, "rgba(255, 227, 117, 0.42)");
        glow.addColorStop(1, "rgba(255, 227, 117, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 211, 91, 0.82)";
        ctx.beginPath();
        ctx.arc(sunX, sunY, 17, 0, Math.PI * 2);
        ctx.fill();
    }

    clouds.forEach((cloud) => {
        if (advancing) {
            cloud.x -= cloud.speed;
            if (cloud.x < -55 * cloud.scale) cloud.x = canvas.width + 55 * cloud.scale;
        }
        drawCloud(cloud);
    });

    if (!raining) return;
    ctx.save();
    ctx.strokeStyle = "rgba(78, 131, 158, 0.38)";
    ctx.lineWidth = 1;
    rainParticles.forEach((drop) => {
        if (advancing) {
            drop.x -= 0.45;
            drop.y += drop.speed + gameSpeed * 0.12;
            if (drop.y > canvas.height - 10) {
                drop.y = -drop.length;
                drop.x = Math.random() * canvas.width;
            }
            if (drop.x < 0) drop.x = canvas.width;
        }
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 2, drop.y + drop.length);
        ctx.stroke();
    });
    ctx.restore();
}

function drawMangroveGround() {
    const groundY = canvas.height - 10;
    if (hasStarted && !isGameOver) habitatOffset = (habitatOffset + gameSpeed * 0.45) % 68;

    ctx.fillStyle = "#b9d9cf";
    ctx.fillRect(0, groundY + 1, canvas.width, 4);
    ctx.fillStyle = "#315747";
    ctx.fillRect(0, groundY + 5, canvas.width, canvas.height - groundY - 5);

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(35, 83, 62, 0.88)";
    ctx.lineWidth = 3;
    for (let x = -68 - habitatOffset; x < canvas.width + 68; x += 136) {
        ctx.beginPath();
        ctx.moveTo(x, groundY + 7);
        ctx.bezierCurveTo(x + 5, groundY + 2, x + 12, groundY + 17, x + 17, canvas.height);
        ctx.moveTo(x + 18, groundY + 7);
        ctx.bezierCurveTo(x + 22, groundY + 4, x + 30, groundY + 13, x + 34, canvas.height);
        ctx.stroke();
    }

    habitatPlants.forEach((plant) => {
        const x = ((plant.x - habitatOffset + canvas.width) % canvas.width);
        const baseY = groundY + 2;
        const tipY = baseY - plant.height;
        ctx.strokeStyle = plant.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(x + plant.lean * 3, tipY + 6, x + plant.lean * 7, tipY);
        ctx.stroke();

        ctx.fillStyle = plant.color;
        for (let leaf = 0; leaf < 3; leaf++) {
            const leafY = baseY - 5 - leaf * 5;
            const direction = leaf % 2 === 0 ? -1 : 1;
            ctx.beginPath();
            ctx.ellipse(x + direction * 5, leafY, 5, 2.2, direction * -0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.restore();

    ctx.fillStyle = "#3b5335";
    ctx.fillRect(0, groundY - 3, canvas.width, 10);
    ctx.fillStyle = "rgba(183, 210, 154, 0.75)";
    for (let x = 8 - habitatOffset; x < canvas.width; x += 38) {
        ctx.fillRect(x, groundY - 2, 14, 2);
    }
}

function showAudioError(error) {
    audioStatus.textContent = "El audio no está disponible en este navegador.";
    audioStatus.hidden = false;
    console.error("Audio playback failed:", error);
}

function handleAudioPlaybackError(error, showError) {
    if (!["NotAllowedError", "AbortError"].includes(error.name) && showError) showAudioError(error);
}

function startMusic(showError = true) {
    if (!audioEnabled || !hasStarted || isGameOver || !backgroundMusic.paused) return;
    backgroundMusic.play().catch((error) => {
        handleAudioPlaybackError(error, showError);
    });
}

function stopMusic() {
    backgroundMusic.pause();
    if (backgroundMusic.readyState > 0) backgroundMusic.currentTime = 0;
}

function updateAudioButton() {
    const label = audioEnabled ? "Silenciar audio" : "Activar audio";
    audioButton.setAttribute("aria-pressed", String(audioEnabled));
    audioButton.setAttribute("aria-label", label);
    audioButton.title = label;
}

function activateAudio(showError = true) {
    if (!audioEnabled) return;
    startMusic(showError);
}

audioButton.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    audioStatus.hidden = true;
    updateAudioButton();
    if (audioEnabled) {
        activateAudio();
    } else {
        stopMusic();
    }
});
updateAudioButton();

function finishGame() {
    if (isGameOver) return;
    isGameOver = true;
    stopMusic();
    if (score > highScore) highScore = score;
    scoreElement.textContent = formatScore(score);
    highScoreElement.textContent = formatScore(highScore);
    gameOverScoreElement.textContent = formatScore(score);
    gameOverHighScoreElement.textContent = formatScore(highScore);
    gameOverScreen.style.display = "flex";
}

function startGame() {
    if (hasStarted) return;
    hasStarted = true;
    activateAudio();
    splashScreen.style.display = "none";
    animate();
}

function handleAction() {
    if (!hasStarted) { startGame(); return; }
    isGameOver ? resetGame() : frog.jump();
}

startButton.addEventListener("click", startGame);

function updateFullscreenButton() {
    const isFullscreen = document.fullscreenElement === document.documentElement;
    const canFullscreen = document.fullscreenEnabled &&
        typeof document.documentElement.requestFullscreen === "function";
    const label = isFullscreen ? "Salir de pantalla completa" :
        canFullscreen ? "Activar pantalla completa" : "Información de pantalla completa";
    fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
    fullscreenButton.setAttribute("aria-label", label);
    fullscreenButton.title = label;
}

function showFullscreenHelp() {
    fullscreenError.textContent = isIOS
        ? "Safari en iPhone no permite poner esta página en pantalla completa. Usa Compartir > Añadir a pantalla de inicio y abre el juego desde ese icono para ocultar las barras."
        : "Este navegador no permite poner páginas web en pantalla completa.";
    fullscreenError.hidden = false;
}

fullscreenButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    fullscreenError.hidden = true;
    if (!document.fullscreenElement && (!document.fullscreenEnabled ||
        typeof document.documentElement.requestFullscreen !== "function")) {
        showFullscreenHelp();
        return;
    }

    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        showFullscreenHelp();
        console.error("Fullscreen request failed:", error);
    }
});

document.addEventListener("fullscreenchange", updateFullscreenButton);
updateFullscreenButton();

// Event Hooks
window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "ArrowUp") && !spacePressed) {
        handleAction(); spacePressed = true; e.preventDefault();
    }
});
window.addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ArrowUp") spacePressed = false; });
function resetGame() {
    obstacles = []; flies = []; scorePopups = []; score = 0; fliesEaten = 0; gameSpeed = 6; isGameOver = false;
    spawnTimer = 0; flySpawnTimer = 40; frog.y = canvas.height - frog.height - 10; frog.velocityY = 0;
    flyCountElement.textContent = `🪰 0`; gameOverScreen.style.display = "none";
    activateAudio();
}
function animate() {
    animationFrameCount++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateAndDrawWeather();

    drawMangroveGround();

    if (!isGameOver) {
        score += 0.15; gameSpeed += 0.0015;
        scoreElement.textContent = formatScore(score);
        if (score > highScore) { highScore = score; highScoreElement.textContent = formatScore(highScore); }
        frog.update(); spawnEntities();
    }

    // Process Catchable Flies loop
    for (let j = flies.length - 1; j >= 0; j--) {
        if (!isGameOver) flies[j].update();
        flies[j].draw();
        if (checkCollision(frog, flies[j], 0)) {
            scorePopups.push({ x: flies[j].x, y: flies[j].y, alpha: 1.0 });
            flies.splice(j, 1); fliesEaten++; score += 100;
            flyCountElement.textContent = `🪰 ${fliesEaten}`; continue;
        }
        if (flies[j].x + flies[j].width < 0) flies.splice(j, 1);
    }

    // Process Environmental Obstacles loop
    for (let i = obstacles.length - 1; i >= 0; i--) {
        if (!isGameOver) obstacles[i].update();
        obstacles[i].draw();
        if (checkCollision(frog, obstacles[i], 4)) finishGame();
        if (obstacles[i].x + obstacles[i].width < 0) obstacles.splice(i, 1);
    }

    frog.draw();

    // Render Float-Up Catch text numbers
    ctx.save(); ctx.font = "bold 16px 'Courier New'"; ctx.fillStyle = "#b45309";
    for (let k = scorePopups.length - 1; k >= 0; k--) {
        let p = scorePopups[k]; ctx.globalAlpha = p.alpha; ctx.fillText("+100", p.x, p.y);
        if (!isGameOver) { p.y -= 1.2; p.alpha -= 0.03; }
        if (p.alpha <= 0) scorePopups.splice(k, 1);
    }
    ctx.restore();

    requestAnimationFrame(animate);
}
function formatScore(num) { return String(Math.floor(num)).padStart(5, '0'); }

function spawnEntities() {
    if (spawnTimer <= 0) {
        obstacles.push(new Obstacle(gameSpeed));
        spawnTimer = 80 + Math.random() * 90 - (gameSpeed * 2);
    }
    spawnTimer--;

    if (flySpawnTimer <= 0) {
        flies.push(new Fly(gameSpeed));
        flySpawnTimer = 110 + Math.random() * 130;
    }
    flySpawnTimer--;
}

function checkCollision(rect1, rect2, padding) {
    return (
        rect1.x + padding < rect2.x + rect2.width &&
        rect1.x + rect1.width - padding > rect2.x &&
        rect1.y + padding < rect2.y + rect2.height &&
        rect1.y + rect1.height - padding > rect2.y
    );
}

function handleAction() {
    if (!hasStarted) { startGame(); return; }
    isGameOver ? resetGame() : frog.jump();
}

// 💻 PC Browser Controls (Keyboards)
window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "ArrowUp") && !spacePressed) {
        handleAction(); spacePressed = true; e.preventDefault();
    }
});
window.addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ArrowUp") spacePressed = false; });

// Handle taps across the game, including the splash screen.
window.addEventListener("touchstart", (e) => {
    if (!hasStarted) {
        if (e.target.closest("#start-button")) {
            startGame();
            e.preventDefault();
        }
        return;
    }

    if (e.target.closest("#game-container") && !e.target.closest("a, #fullscreen-button, #audio-button")) {
        handleAction();
        e.preventDefault();
    }
}, { passive: false });

function resetGame() {
    obstacles = []; flies = []; scorePopups = []; score = 0; fliesEaten = 0; gameSpeed = 6; isGameOver = false;
    spawnTimer = 0; flySpawnTimer = 40; frog.y = canvas.height - frog.height - 10; frog.velocityY = 0;
    flyCountElement.textContent = `🪰 0`; gameOverScreen.style.display = "none";
    activateAudio();
}
