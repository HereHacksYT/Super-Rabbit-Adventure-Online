const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false;
let maxPlayersLimit = 4;
let isDead = false;
let respawnTimer = null;
let respawnCountdown = 15;

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

// --- ZEMİN (120 yarıçap) ---
const groundGeo = new THREE.CircleGeometry(120, 128);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

// --- BÜYÜK ÇİMEN BLOK (tek parça, üstü yeşil, yanları toprak) ---
function createBigGrassBlock(x, z, width, depth, height) {
    const group = new THREE.Group();
    
    // Toprak gövde (tam blok)
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9b8c7c, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    obstacles.push(body); // Tüm gövde engel
    
    // Çimen üst yüzey (ince yeşil plaka)
    const topGeo = new THREE.BoxGeometry(width - 0.1, 0.2, depth - 0.1);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.8 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = height + 0.1;
    top.receiveShadow = true;
    group.add(top);
    obstacles.push(top); // Üst plaka da engel
    
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

// --- TAŞ DUVAR (tek parça) ---
function createStoneWallBlock(x, z, width, height, depth = 0.5) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
    const wall = new THREE.Mesh(geo, mat);
    wall.position.set(x, height/2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    gameplayGroup.add(wall);
    obstacles.push(wall);
    return wall;
}

// --- PARKUR (basamaklı kaya platformlar, düzenli aralıklı) ---
function createParkourStepsClean(x, z, count, stepHeight = 1.2, stepSize = 2.4, gap = 1.5) {
    for (let i = 0; i < count; i++) {
        const h = (i + 1) * stepHeight;
        const geo = new THREE.BoxGeometry(stepSize, h, stepSize);
        const mat = new THREE.MeshStandardMaterial({ color: 0xaa9977, roughness: 0.6 });
        const step = new THREE.Mesh(geo, mat);
        step.position.set(x, h/2, z + i * (stepSize + gap));
        step.castShadow = true;
        step.receiveShadow = true;
        gameplayGroup.add(step);
        obstacles.push(step);
    }
}

// --- AHŞAP EV (sadece gövde engele eklenecek, daha büyük) ---
function createWoodenHouse(x, z, rotY = 0) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 });

    const bodyGeo = new THREE.BoxGeometry(6.0, 5.0, 6.0);
    const body = new THREE.Mesh(bodyGeo, woodMat);
    body.position.y = 2.5;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    obstacles.push(body); // Sadece gövdeyi engele ekle, çatıyı değil

    const roofGeo = new THREE.ConeGeometry(4.2, 2.8, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 6.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true; roof.receiveShadow = true;
    group.add(roof);

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

// --- AĞAÇ (sadece gövde engel) ---
function createBigTree(x, z, scale = 2) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.45 * scale, 3.0 * scale, 16);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.55 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5 * scale;
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    obstacles.push(trunk);
    
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d7a1c, roughness: 0.35 });
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

// ============ HARİTA ELEMANLARI (YENİ DÜZEN) ============

// Ahşap evler (gövde boyutu 6x5x6, görsel büyüdü, çarpışma sadece gövde)
createWoodenHouse(-20, -16, 0.2);
createWoodenHouse(18, 13, -0.3);
createWoodenHouse(-20, 20, 0.5);

// Büyük çimen bloklar (evlerden tamamen uzak, tek parça)
createBigGrassBlock(32, -22, 8, 8, 8);
createBigGrassBlock(-28, -12, 9, 10, 6);
createBigGrassBlock(33, 22, 10, 8, 7);
createBigGrassBlock(-30, -30, 9, 9, 10);
createBigGrassBlock(22, 0, 8, 8, 6);

// Taş duvar (parkurdan ayrı, temiz)
createStoneWallBlock(28, -32, 16, 10, 0.5);

// Parkur (basamaklı, taş duvarın yanında, çimen bloklarla çakışmayacak)
createParkourStepsClean(30, -24, 5, 1.2, 2.4, 1.5);

// Ağaçlar
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
const gravity = 0.8, jumpForce = 18;

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

document.getElementById('jump-button').addEventListener('touchstart', (e) => { e.preventDefault(); if (gameActive && !isDead && jumpCount < 2) { velocityY = jumpForce; jumpCount++; } });
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

// ANA DÖNGÜ
let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    let hasMoved = false;

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