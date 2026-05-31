const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false;
let maxPlayersLimit = 4;
let isDead = false;
let respawnTimer = null;
let respawnCountdown = 15;
let lastTeleportTime = 0;
const teleportCooldown = 3; // saniye

// 3D SAHNE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 120, 400);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIK
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.7);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
sunLight.position.set(200, 350, 150);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -150;
sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.top = 150;
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
scene.add(sunLight);

const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);
const obstacles = [];
const portals = []; // portal listesi

// --- PROSEDÜREL DOKU OLUŞTURUCU ---
function createCanvasTexture(width, height, drawFunc) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFunc(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
}

// ZEMİN ÇİMEN DOKUSU
const groundTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5a8a3c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const shade = 80 + Math.random() * 60;
        const g = 120 + Math.random() * 50;
        const b = 30 + Math.random() * 40;
        ctx.fillStyle = `rgb(${shade}, ${g}, ${b})`;
        ctx.fillRect(x, y, 1 + Math.random() * 3, 2 + Math.random() * 5);
    }
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(30, 50, 10, ${Math.random() * 0.25})`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 3 + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(160, 200, 80, ${Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
});

// BLOK ÜSTÜ ÇİMEN DOKUSU
const blockGrassTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6daa2e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgb(${100 + Math.random()*40}, ${150 + Math.random()*60}, ${30 + Math.random()*30})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 4, 6);
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(50,80,20,${Math.random()*0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random()*w, Math.random()*h, Math.random()*3+1, 0, Math.PI*2);
        ctx.fill();
    }
});

// Toprak dokusu
const dirtTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8B6B4D';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
        const shade = 100 + Math.random() * 50;
        ctx.fillStyle = `rgb(${shade}, ${shade*0.7}, ${shade*0.4})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 3, 3);
    }
});

// Ahşap dokusu
const woodTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c49a6c';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, 0, 2, h);
    }
    for (let i = 0; i < 600; i++) {
        ctx.strokeStyle = `rgba(100, 60, 20, ${Math.random()*0.5})`;
        ctx.lineWidth = Math.random()*3+0.5;
        ctx.beginPath();
        const y = Math.random() * h;
        ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 10) {
            ctx.lineTo(x, y + Math.sin(x*0.05)*8);
        }
        ctx.stroke();
    }
    for (let i = 0; i < 15; i++) {
        const bx = Math.random() * w;
        const by = Math.random() * h;
        const r = 3 + Math.random() * 8;
        ctx.fillStyle = `rgba(80, 40, 20, 0.7)`;
        ctx.beginPath();
        ctx.ellipse(bx, by, r, r*1.5, 0, 0, Math.PI*2);
        ctx.fill();
    }
});

// TAŞ DUVAR DOKUSU
const stoneTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
        const y = row * 64;
        const offset = (row % 2) * 32;
        for (let col = 0; col < 8; col++) {
            const x = col * 64 + offset;
            const shade = 120 + Math.random() * 40;
            ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
            ctx.fillRect(x + 2, y + 2, 60, 28);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 2, y + 2, 60, 28);
        }
    }
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.2})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 4, 3);
    }
});

// Kiremit çatı dokusu
const roofTileTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a2e2e';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++) {
        const y = row * 42;
        const offset = (row % 2) * 21;
        for (let col = 0; col < 12; col++) {
            const x = col * 42 + offset;
            ctx.fillStyle = `rgb(${150 + Math.random()*30}, ${40 + Math.random()*20}, ${30 + Math.random()*20})`;
            ctx.fillRect(x + 2, y + 2, 38, 18);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 2, y + 2, 38, 18);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x + 2, y + 30, 38, 10);
        }
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.2})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 3, 2);
    }
});

// Ağaç kabuğu dokusu
const barkTexture = createCanvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6B4F3C';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
        ctx.strokeStyle = `rgba(40, 20, 10, ${Math.random()*0.5})`;
        ctx.lineWidth = Math.random()*4+2;
        ctx.beginPath();
        ctx.moveTo(0, Math.random()*h);
        ctx.lineTo(w, Math.random()*h);
        ctx.stroke();
    }
});

// Yaprak dokusu
const leafTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3d7a1c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = `rgb(${40 + Math.random()*30}, ${100 + Math.random()*50}, ${20 + Math.random()*20})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 2, 3);
    }
});

// --- MALZEMELER ---
const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.9 });
groundTexture.repeat.set(12, 12);

const blockGrassMat = new THREE.MeshStandardMaterial({ map: blockGrassTexture, roughness: 0.85 });
blockGrassTexture.repeat.set(8, 8);

const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTexture, roughness: 0.75 });
dirtTexture.repeat.set(4, 4);

const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.65 });

const stoneWallMat = new THREE.MeshStandardMaterial({ map: stoneTexture, roughness: 0.6 });

const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture, roughness: 0.7 });
const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture, roughness: 0.4 });

const roofMat = new THREE.MeshStandardMaterial({ map: roofTileTexture, roughness: 0.55 });

// --- ZEMİN ---
const groundGeo = new THREE.CircleGeometry(120, 128);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

// --- DUVAR (gölgesiz versiyon) ---
function createShadowlessWall(x, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geo, stoneWallMat);
    wall.position.set(x, height / 2, z);
    wall.castShadow = false;   // gölge yok
    wall.receiveShadow = false; // gölge almaz
    gameplayGroup.add(wall);
    obstacles.push(wall);
    return wall;
}

// --- BÜYÜK ÇİMEN BLOK (tek parça) ---
function createBigGrassBlock(x, z, width, depth, height) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeo, dirtMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    obstacles.push(body);
    const topGeo = new THREE.BoxGeometry(width - 0.1, 0.2, depth - 0.1);
    const top = new THREE.Mesh(topGeo, blockGrassMat);
    top.position.y = height + 0.1;
    top.receiveShadow = true;
    group.add(top);
    obstacles.push(top);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

// --- AHŞAP EV ---
function createWoodenHouse(x, z, rotY = 0) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(6.0, 5.0, 6.0);
    const body = new THREE.Mesh(bodyGeo, woodMat);
    body.position.y = 2.5;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    obstacles.push(body);
    const roofGeo = new THREE.ConeGeometry(4.2, 2.8, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 6.4;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true; roof.receiveShadow = true;
    group.add(roof);
    obstacles.push(roof);
    const doorGeo = new THREE.BoxGeometry(1.6, 3.0, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.5 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.5, 3.1);
    group.add(door);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    return group;
}

// --- AĞAÇ ---
function createBigTree(x, z, scale = 2) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.45 * scale, 3.0 * scale, 16);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.y = 1.5 * scale;
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    obstacles.push(trunk);
    for (let i = 0; i < 4; i++) {
        const sGeo = new THREE.SphereGeometry(0.85 * scale - i * 0.12, 16, 12);
        const s = new THREE.Mesh(sGeo, leafMat);
        s.position.set((Math.random() - 0.5) * 0.6 * scale, 2.4 * scale + i * 0.55 * scale, (Math.random() - 0.5) * 0.6 * scale);
        s.castShadow = true; s.receiveShadow = true;
        group.add(s);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

// --- PORTAL (güzel görünümlü) ---
function createPortal(x, z, targetX, targetZ, color = 0x00ffff) {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.2, 0.15, 16, 40);
    const ringMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.4;
    group.add(ring);
    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.8, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.35 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 1.4;
    group.add(pillar);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    portals.push({ mesh: group, target: new THREE.Vector3(targetX, 0, targetZ), color: color });
    return group;
}

// ============ HARİTA ELEMANLARI ============
createWoodenHouse(-20, -16, 0.2);
createWoodenHouse(18, 13, -0.3);
createWoodenHouse(-20, 20, 0.5);

createBigGrassBlock(32, -22, 8, 8, 8);
createBigGrassBlock(-28, -12, 9, 10, 6);
createBigGrassBlock(33, 22, 10, 8, 7);
createBigGrassBlock(-30, -30, 9, 9, 10);
createBigGrassBlock(22, 0, 8, 8, 6);

createBigTree(-36, -36, 2);
createBigTree(36, -32, 1.8);
createBigTree(-32, 36, 2.2);
createBigTree(34, 34, 2);
createBigTree(-38, 8, 1.8);
createBigTree(38, -8, 2);
createBigTree(0, -40, 2.2);
createBigTree(0, 40, 2.2);
createBigTree(-40, -14, 2);
createBigTree(40, 14, 2);
createBigTree(-16, -38, 1.8);
createBigTree(16, 38, 1.8);

// ============ 4 BÜYÜK DUVAR (gölgesiz) ============
createShadowlessWall(0, 46, 90, 100, 2);
createShadowlessWall(46, 0, 2, 100, 90);
createShadowlessWall(0, -46, 90, 100, 2);
createShadowlessWall(-46, 0, 2, 100, 90);

// ============ PORTAL (x:0, z:35) ============
createPortal(0, 35, 0, 0, 0x44ffff);

// --- KOORDİNAT GÖSTERGESİ ---
const coordSpan = document.createElement('span');
coordSpan.id = 'coords-display';
coordSpan.style.marginLeft = '15px';
coordSpan.style.color = '#ffeb3b';
document.getElementById('game-info-ui').appendChild(coordSpan);

// --- MODEL FABRİKASI (TAVŞAN) ---
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const otherBodyMat = new THREE.MeshStandardMaterial({ color: 0xddf0ff });
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });

function createRabbitModel(isLocal = false) {
    const group = new THREE.Group(); const visualGroup = new THREE.Group(); group.add(visualGroup);
    const currentMat = isLocal ? bodyMat : otherBodyMat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.75), currentMat); body.position.y = 0.4; body.castShadow = true; visualGroup.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), currentMat); head.position.y = 0.95; head.position.z = 0.1; head.castShadow = true; visualGroup.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), noseMat); nose.position.y = -0.05; nose.position.z = 0.33; head.add(nose);
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.18, 0.1, 0.25); head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.18, 0.1, 0.25); head.add(eyeR);
    const earGeo = new THREE.BoxGeometry(0.12, 0.55, 0.06);
    const earL = new THREE.Mesh(earGeo, currentMat); earL.position.set(-0.16, 0.45, -0.05); head.add(earL);
    const earR = new THREE.Mesh(earGeo, currentMat); earR.position.set(0.16, 0.45, -0.05); head.add(earR);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), currentMat); tail.position.set(0, 0.25, -0.4); visualGroup.add(tail);
    const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.34); const footMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const fFL = new THREE.Mesh(footGeo, footMat); fFL.position.set(-0.32, 0.08, 0.22); group.add(fFL);
    const fFR = new THREE.Mesh(footGeo, footMat); fFR.position.set(0.32, 0.08, 0.22); group.add(fFR);
    const fBL = new THREE.Mesh(footGeo, footMat); fBL.position.set(-0.32, -0.08, -0.22); group.add(fBL);
    const fBR = new THREE.Mesh(footGeo, footMat); fBR.position.set(0.32, -0.08, -0.22); group.add(fBR);
    return { mesh: group, visual: visualGroup, head: head, feet: [fFL, fFR, fBL, fBR] };
}

const localPlayer = createRabbitModel(true);
const rabbit = localPlayer.mesh; const rabbitVisualGroup = localPlayer.visual; const head = localPlayer.head;
const [footFL, footFR, footBL, footBR] = localPlayer.feet;
scene.add(rabbit);

let otherPlayers = {};
let isAttacking = false, attackAnimTime = 0;
let myHealth = 100; const maxHealth = 100;

function updateHealthBar() {
    const percent = (myHealth / maxHealth) * 100;
    document.getElementById('health-bar-fill').style.width = percent + '%';
    document.getElementById('health-text').innerText = myHealth + '/' + maxHealth;
    if (percent > 60) document.getElementById('health-bar-fill').style.background = 'linear-gradient(90deg, #4caf50, #8bc34a)';
    else if (percent > 30) document.getElementById('health-bar-fill').style.background = 'linear-gradient(90deg, #ff9800, #ffc107)';
    else document.getElementById('health-bar-fill').style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
}

function die() {
    if (isDead) return;
    isDead = true; gameActive = false; rabbit.visible = false;
    document.getElementById('death-screen').style.display = 'flex';
    respawnCountdown = 15; document.getElementById('countdown-display').innerText = respawnCountdown;
    respawnTimer = setInterval(() => { respawnCountdown--; document.getElementById('countdown-display').innerText = respawnCountdown; if (respawnCountdown <= 0) { clearInterval(respawnTimer); respawn(); } }, 1000);
}

function respawn() {
    isDead = false; gameActive = true; rabbit.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    document.getElementById('death-screen').style.display = 'none';
    velocityY = 0; jumpCount = 0;
}

function checkCollision(newX, newY, newZ) {
    if (!gameActive) return false;
    const playerBox = new THREE.Box3(new THREE.Vector3(newX - 0.28, newY + 0.15, newZ - 0.28), new THREE.Vector3(newX + 0.28, newY + 1.1, newZ + 0.28));
    gameplayGroup.updateMatrixWorld(true);
    for (let i = 0; i < obstacles.length; i++) {
        let obj = obstacles[i];
        if (!obj || !obj.parent) continue;
        let obstacleBox = new THREE.Box3().setFromObject(obj);
        if (playerBox.intersectsBox(obstacleBox)) { if (newY >= obstacleBox.max.y - 0.3) continue; return true; }
    }
    return false;
}

function getFloorY(pX, pY, pZ) {
    gameplayGroup.updateMatrixWorld(true);
    let highestCeil = 0;
    for (let i = 0; i < obstacles.length; i++) {
        let obj = obstacles[i];
        if (!obj || !obj.parent) continue;
        let box = new THREE.Box3().setFromObject(obj);
        if (pX + 0.25 >= box.min.x && pX - 0.25 <= box.max.x && pZ + 0.25 >= box.min.z && pZ - 0.25 <= box.max.z) {
            if (pY >= box.max.y - 0.4 && box.max.y > highestCeil) highestCeil = box.max.y;
        }
    }
    return highestCeil;
}

let velocityY = 0, jumpCount = 0;
const gravity = 0.8, jumpForce = 15.3;

window.playSolo = function() {
    isOnlineMode = false; gameActive = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    document.getElementById('game-room-title').innerText = "TEK OYUNCULU";
    document.getElementById('game-player-count').innerText = "1";
    gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    gameplayGroup.updateMatrixWorld(true);
};

window.createRoom = function() { isOnlineMode = true; socket.emit('createRoom', { maxPlayers: 4 }); };
window.joinRoom = function() { const code = document.getElementById('room-code-input').value.trim(); if(code.length === 5) { isOnlineMode = true; socket.emit('joinRoom', code); } };
window.hostStartGame = function() { socket.emit('startGameSignal'); };

socket.on('roomCreated', (d) => { setupLobbyUI(d); });
socket.on('roomUpdate', (d) => { setupLobbyUI(d); });

const lobbyGroup = new THREE.Group();
scene.add(lobbyGroup);
const pads = [];
const padPositions = [{ x: 0, z: 47.5 }, { x: -3.5, z: 49.5 }, { x: 3.5, z: 49.5 }, { x: 0, z: 52.0 }];
for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(padPositions[i].x, 0.1, padPositions[i].z);
    lobbyGroup.add(pad);
    pads.push(pad);
}

function setupLobbyUI(d) {
    maxPlayersLimit = d.maxPlayers;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-ui').style.display = 'block';
    document.getElementById('ui-room-code').innerText = d.roomCode;
    const cc = Object.keys(d.players).length;
    document.getElementById('ui-player-count').innerText = `Oyuncu: ${cc} / ${maxPlayersLimit}`;
    if (d.hostId === socket.id) { document.getElementById('ui-start-btn').style.display = 'block'; document.getElementById('ui-waiting-msg').style.display = 'none'; }
    else { document.getElementById('ui-start-btn').style.display = 'none'; document.getElementById('ui-waiting-msg').style.display = 'block'; }
    gameplayGroup.visible = false; lobbyGroup.visible = true;
    rabbit.position.set(padPositions[0].x, 0.2, padPositions[0].z);
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    let pi = 1;
    Object.keys(d.players).forEach((id) => { if (id !== socket.id && pi < 4) { const pos = padPositions[pi]; addOtherPlayer(id, pos.x, 0.2, pos.z); pi++; } });
}

socket.on('gameStartedAtAll', (ap) => {
    document.getElementById('lobby-ui').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    document.getElementById('game-room-title').innerText = "ODA: " + document.getElementById('ui-room-code').innerText;
    document.getElementById('game-player-count').innerText = Object.keys(ap).length;
    lobbyGroup.visible = false; gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    Object.keys(ap).forEach((id) => { if (id !== socket.id) addOtherPlayer(id, 0, 0, 0); });
    gameActive = true; isDead = false;
    gameplayGroup.updateMatrixWorld(true);
});

function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const md = createRabbitModel(false);
    md.mesh.position.set(x, y, z); scene.add(md.mesh);
    otherPlayers[id] = { mesh: md.mesh, visual: md.visual, head: md.head, isAttacking: false, attackAnimTime: 0 };
}

socket.on('playerMoved', (pi) => { if (gameActive && otherPlayers[pi.id]) { otherPlayers[pi.id].mesh.position.set(pi.x, pi.y, pi.z); otherPlayers[pi.id].mesh.rotation.y = pi.ry; } });
socket.on('playerAttacked', (id) => { if (gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; } });
socket.on('knockback', (angle) => { if (!gameActive || isDead) return; rabbit.position.x += Math.sin(angle) * 2.0; rabbit.position.z += Math.cos(angle) * 2.0; socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y }); });
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; } });
socket.on('hostDisconnected', () => { alert('Oda sahibi ayrıldı.'); location.reload(); });

// KONTROLLER
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
let joystickActive = false, moveX = 0, moveZ = 0;
zone.addEventListener('touchstart', (e) => { if(!gameActive || isDead) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => { if (joystickActive && gameActive && !isDead) { for (let i = 0; i < e.touches.length; i++) { if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; } } } }, { passive: true });
zone.addEventListener('touchend', () => { joystickActive = false; stick.style.transform = 'translate(0px, 0px)'; moveX = 0; moveZ = 0; });

function handleJoystick(cx, cy) {
    const zr = zone.getBoundingClientRect();
    let dx = cx - (zr.left + zr.width / 2), dy = cy - (zr.top + zr.height / 2);
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    moveX = dx / maxRadius; moveZ = dy / maxRadius;
}

let cameraAngleY = 0, cameraAngleX = 0.4, cameraDistance = 10, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
window.addEventListener('touchstart', (e) => {
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    if (e.touches.length === 1 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) { isTurningCamera = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !document.getElementById('jump-button').contains(e.touches[i].target) && !document.getElementById('attack-button').contains(e.touches[i].target)) {
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005;
            cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break;
        }
    }
}, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });

document.getElementById('jump-button').addEventListener('touchstart', (e) => { e.preventDefault(); if (gameActive && !isDead && jumpCount < 3) { velocityY = jumpForce; jumpCount++; } });
document.getElementById('attack-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && !isAttacking) {
        isAttacking = true; attackAnimTime = 0;
        if (isOnlineMode) socket.emit('playerAttack');
        if (isOnlineMode && gameActive) {
            Object.keys(otherPlayers).forEach((id) => {
                const op = otherPlayers[id].mesh.position;
                if (rabbit.position.distanceTo(op) < 2.0) {
                    const angle = Math.atan2(op.x - rabbit.position.x, op.z - rabbit.position.z);
                    socket.emit('playerKnockback', { targetId: id, angle: angle });
                }
            });
        }
    }
});

// ANA DÖNGÜ + PORTAL TELEPORT
let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    let hasMoved = false;

    document.getElementById('coords-display').innerText = `X:${Math.round(rabbit.position.x)} Z:${Math.round(rabbit.position.z)}`;

    // Portal kontrolü
    if (gameActive && !isDead) {
        const now = Date.now() / 1000;
        for (let i = 0; i < portals.length; i++) {
            const p = portals[i];
            const dist = new THREE.Vector2(rabbit.position.x - p.mesh.position.x, rabbit.position.z - p.mesh.position.z).length();
            if (dist < 2.5 && (now - lastTeleportTime > teleportCooldown)) {
                lastTeleportTime = now;
                // Hızlı kararma efekti
                document.getElementById('death-screen').style.display = 'flex';
                document.getElementById('death-screen').style.background = 'rgba(0,0,0,0.95)';
                document.querySelector('.death-text').innerText = 'YÜKLENİYOR...';
                document.getElementById('countdown-display').innerText = '';
                setTimeout(() => {
                    rabbit.position.x = p.target.x;
                    rabbit.position.z = p.target.z;
                    document.getElementById('death-screen').style.display = 'none';
                }, 600);
                break;
            }
        }
    }

    if (isOnlineMode && !gameActive && !isDead) {
        rabbit.rotation.y += 1.2 * deltaTime;
        Object.keys(otherPlayers).forEach((id) => { otherPlayers[id].mesh.rotation.y += 1.2 * deltaTime; });
        camera.position.set(0, 3.5, 43); camera.lookAt(0, 1.2, 50);
    }

    if (gameActive && !isDead) {
        if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
            const fx = Math.sin(cameraAngleY), fz = Math.cos(cameraAngleY);
            const rx = Math.sin(cameraAngleY + Math.PI / 2), rz = Math.cos(cameraAngleY + Math.PI / 2);
            const dx = (fx * -moveZ) - (rx * moveX), dz = (fz * -moveZ) - (rz * moveX);
            const nx = rabbit.position.x + dx * 12.0 * deltaTime, nz = rabbit.position.z + dz * 12.0 * deltaTime;
            if (!checkCollision(nx, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nx;
            if (!checkCollision(rabbit.position.x, rabbit.position.y, nz)) rabbit.position.z = nz;
            rabbit.rotation.y = Math.atan2(dx, dz);
            hasMoved = true;
            legWiggle += 15 * deltaTime;
            footFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
            footBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        } else { footFL.position.y = 0.08; footFR.position.y = 0.08; footBL.position.y = 0.08; footBR.position.y = 0.08; }
        if (isAttacking) {
            attackAnimTime += 12 * deltaTime; const f = Math.sin(attackAnimTime * Math.PI);
            if (attackAnimTime <= 1.0) { rabbitVisualGroup.position.z = f * 0.5; head.position.z = 0.1 + f * 0.25; head.rotation.x = f * 0.4; }
            else { isAttacking = false; rabbitVisualGroup.position.z = 0; head.position.z = 0.1; head.rotation.x = 0; }
        }
        Object.keys(otherPlayers).forEach((id) => {
            const op = otherPlayers[id];
            if (op.isAttacking) {
                op.attackAnimTime += 12 * deltaTime; const f = Math.sin(op.attackAnimTime * Math.PI);
                if (op.attackAnimTime <= 1.0) { op.visual.position.z = f * 0.5; op.head.position.z = 0.1 + f * 0.25; op.head.rotation.x = f * 0.4; }
                else { op.isAttacking = false; op.visual.position.z = 0; op.head.position.z = 0.1; op.head.rotation.x = 0; }
            }
        });

        const floorY = getFloorY(rabbit.position.x, rabbit.position.y, rabbit.position.z);
        velocityY -= gravity * 60 * deltaTime;
        rabbit.position.y += velocityY * deltaTime;
        if (rabbit.position.y <= floorY) { rabbit.position.y = floorY; velocityY = 0; jumpCount = 0; }

        if (isOnlineMode) {
            Object.keys(otherPlayers).forEach((id) => {
                const other = otherPlayers[id].mesh;
                const dist = rabbit.position.distanceTo(other.position);
                if (dist < 1.2 && dist > 0.01) {
                    const angle = Math.atan2(rabbit.position.x - other.position.x, rabbit.position.z - other.position.z);
                    const px = Math.sin(angle) * 0.05, pz = Math.cos(angle) * 0.05;
                    rabbit.position.x += px; rabbit.position.z += pz;
                    other.position.x -= px; other.position.z -= pz;
                }
            });
        }
        if (hasMoved || isAttacking) socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });

        camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.y = rabbit.position.y + Math.sin(cameraAngleX) * cameraDistance;
        camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);
    }
    renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });