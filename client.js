const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false;
let maxPlayersLimit = 4;
let isDead = false;
let respawnTimer = null;
let respawnCountdown = 15;

// 3D SAHNE AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8e3); // Canlı gök mavisi
scene.fog = new THREE.Fog(0x7ec8e3, 25, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA (Yumuşak, pastel)
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
sunLight.position.set(50, 60, 40);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40;
sunLight.shadow.camera.bottom = -40;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

// --- ASIL OYUN DÜNYASI (Ayı Macerası Temalı) ---
const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

// Ana zemin (çimen, hafif engebeli görünüm için büyük daire)
const groundGeo = new THREE.CircleGeometry(35, 64);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6daa2e, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

// İç bölge (daha açık yeşil, yumuşak geçiş)
const innerGroundGeo = new THREE.CircleGeometry(25, 64);
const innerGroundMat = new THREE.MeshStandardMaterial({ color: 0x8cc63e, roughness: 0.8 });
const innerGround = new THREE.Mesh(innerGroundGeo, innerGroundMat);
innerGround.rotation.x = -Math.PI / 2;
innerGround.position.y = 0.02;
innerGround.receiveShadow = true;
gameplayGroup.add(innerGround);

// Çarpışma listesi
const obstacles = [];

// --- YARDIMCI FONKSİYONLAR (Ayı Macerası Tarzı) ---
function createTree(x, z, scale = 1, type = 'round') {
    const group = new THREE.Group();
    // Gövde
    const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2.2 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    if (type === 'round') {
        // Yuvarlak yapraklı ağaç (meşe benzeri)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.4 });
        const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.8 * scale, 8, 6), leafMat);
        leaf1.position.y = 2.0 * scale; leaf1.castShadow = true; leaf1.receiveShadow = true;
        group.add(leaf1);
        const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.6 * scale, 8, 6), leafMat);
        leaf2.position.set(0.4 * scale, 2.4 * scale, 0.2 * scale); leaf2.castShadow = true; leaf2.receiveShadow = true;
        group.add(leaf2);
        const leaf3 = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 8, 6), leafMat);
        leaf3.position.set(-0.3 * scale, 2.7 * scale, -0.3 * scale); leaf3.castShadow = true; leaf3.receiveShadow = true;
        group.add(leaf3);
    } else if (type === 'cone') {
        // Kozalaklı ağaç (çam)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
            const coneGeo = new THREE.ConeGeometry(0.7 * scale - i * 0.1, 0.9 * scale, 8);
            const cone = new THREE.Mesh(coneGeo, leafMat);
            cone.position.y = 1.8 * scale + i * 0.7 * scale;
            cone.castShadow = true; cone.receiveShadow = true;
            group.add(cone);
        }
    }

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    // Çarpışma için gövdeyi ekle
    obstacles.push(trunk);
    return group;
}

function createBigMushroom(x, z, scale = 1) {
    const group = new THREE.Group();
    // Gövde
    const stemGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 2.0 * scale, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 1.0 * scale; stem.castShadow = true; stem.receiveShadow = true;
    group.add(stem);
    // Mantar şapkası
    const capGeo = new THREE.SphereGeometry(0.8 * scale, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.3, metalness: 0.1 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 2.0 * scale; cap.castShadow = true; cap.receiveShadow = true;
    group.add(cap);
    // Üzerinde beyaz noktalar
    for (let i = 0; i < 5; i++) {
        const dotGeo = new THREE.SphereGeometry(0.1 * scale, 4);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const angle = (i / 5) * Math.PI * 2;
        dot.position.set(Math.cos(angle) * 0.5 * scale, 2.3 * scale, Math.sin(angle) * 0.5 * scale);
        group.add(dot);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(stem); // sadece gövde engel
    return group;
}

function createRockPlatform(x, z, scale = 1) {
    const geo = new THREE.CylinderGeometry(0.8 * scale, 1.0 * scale, 0.5 * scale, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5, metalness: 0.2 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 0.25 * scale, z);
    rock.castShadow = true; rock.receiveShadow = true;
    gameplayGroup.add(rock);
    obstacles.push(rock);
    return rock;
}

function createBoulder(x, z, scale = 1) {
    const geo = new THREE.IcosahedronGeometry(0.6 * scale, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.1 });
    const boulder = new THREE.Mesh(geo, mat);
    boulder.position.set(x, 0.3 * scale, z);
    boulder.castShadow = true; boulder.receiveShadow = true;
    boulder.rotation.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
    gameplayGroup.add(boulder);
    obstacles.push(boulder);
    return boulder;
}

function createFlower(x, z, color = 0xffaa88) {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.2; group.add(stem);
    const headGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.5; group.add(head);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createBush(x, z, scale = 1) {
    const group = new THREE.Group();
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3a6b1e, roughness: 0.6 });
    const geo1 = new THREE.SphereGeometry(0.4 * scale, 6);
    const s1 = new THREE.Mesh(geo1, bushMat);
    s1.position.set(0, 0.2 * scale, 0); s1.castShadow = true; s1.receiveShadow = true; group.add(s1);
    const geo2 = new THREE.SphereGeometry(0.35 * scale, 6);
    const s2 = new THREE.Mesh(geo2, bushMat);
    s2.position.set(0.3 * scale, 0.15 * scale, 0.2 * scale); s2.castShadow = true; s2.receiveShadow = true; group.add(s2);
    const s3 = new THREE.Mesh(geo2, bushMat);
    s3.position.set(-0.3 * scale, 0.15 * scale, -0.2 * scale); s3.castShadow = true; s3.receiveShadow = true; group.add(s3);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createWoodenBridge(x, z, rotY = 0, length = 3) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    // İki uzun kalas
    for (let side = -1; side <= 1; side += 2) {
        const plankGeo = new THREE.BoxGeometry(length, 0.1, 0.3);
        const plank = new THREE.Mesh(plankGeo, woodMat);
        plank.position.set(0, 0.2, side * 0.4);
        plank.castShadow = true; plank.receiveShadow = true;
        group.add(plank);
    }
    // Enine çıtalar
    for (let i = 0; i < length * 2; i++) {
        const slatGeo = new THREE.BoxGeometry(0.2, 0.05, 0.8);
        const slat = new THREE.Mesh(slatGeo, woodMat);
        slat.position.set(-length / 2 + i * 0.5, 0.25, 0);
        slat.castShadow = true; slat.receiveShadow = true;
        group.add(slat);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createPond(x, z, radius = 2) {
    const group = new THREE.Group();
    const pondGeo = new THREE.CircleGeometry(radius, 32);
    const pondMat = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.8 });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = 0.05;
    group.add(pond);
    // Kenar taşları
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const stoneGeo = new THREE.SphereGeometry(0.2, 4);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5 });
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius);
        stone.castShadow = true; stone.receiveShadow = true;
        group.add(stone);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

// --- HARİTAYI OLUŞTUR (Ayı Macerası Tarzı) ---
// Ağaçlar (yuvarlak ve çam)
createTree(-9, -9, 1.0, 'round');
createTree(10, -8, 0.9, 'cone');
createTree(-8, 10, 1.1, 'round');
createTree(9, 9, 0.8, 'cone');
createTree(0, -12, 1.2, 'round');
createTree(-13, 4, 0.9, 'cone');
createTree(12, -4, 1.0, 'round');
createTree(-5, 13, 1.0, 'cone');
createTree(6, -13, 0.9, 'round');
createTree(-11, -4, 0.8, 'cone');
createTree(11, 5, 1.1, 'round');
createTree(4, 12, 0.9, 'cone');

// Büyük mantarlar (platform olarak)
createBigMushroom(-6, -5, 1.2);
createBigMushroom(7, 4, 1.0);
createBigMushroom(0, -9, 1.3);
createBigMushroom(-4, 8, 0.9);
createBigMushroom(8, -3, 1.1);

// Taş platformlar (üzerine çıkılabilir)
createRockPlatform(-3, -2, 0.8);
createRockPlatform(4, -3, 0.9);
createRockPlatform(-5, 6, 1.0);
createRockPlatform(6, -6, 0.7);
createRockPlatform(-1, 7, 0.8);
createRockPlatform(2, -8, 0.9);

// Büyük kayalar
createBoulder(-7, -1, 1.2);
createBoulder(3, 5, 0.8);
createBoulder(-4, -9, 1.0);
createBoulder(9, 7, 1.1);
createBoulder(-9, 5, 0.9);
createBoulder(0, 10, 1.0);

// Çalılıklar
for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 7 + Math.random() * 12;
    createBush(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.7 + Math.random() * 1.0);
}

// Çiçekler
for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 14;
    createFlower(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.random() > 0.5 ? 0xffaa88 : 0xffcc44);
}

// Gölet (merkezden biraz uzak)
createPond(11, -10, 2.2);

// Ahşap köprü (göletin yanında bir çukur bölgeyi geçmek için)
createWoodenBridge(8, -8, 0.3, 3.5);

// --- LOBİ ODASI (aynı) ---
const lobbyGroup = new THREE.Group();
scene.add(lobbyGroup);

const cylinderGeo = new THREE.CylinderGeometry(12, 12, 15, 32, 1, true);
const cylinderMat = new THREE.MeshStandardMaterial({
    color: 0x00a2ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1
});
const lobbyRoom = new THREE.Mesh(cylinderGeo, cylinderMat);
lobbyRoom.position.set(0, 7.5, 50);
lobbyGroup.add(lobbyRoom);

const lobbyFloorGeo = new THREE.CylinderGeometry(12, 12, 0.5, 32);
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.5 });
const lobbyFloorMesh = new THREE.Mesh(lobbyFloorGeo, lobbyFloorMat);
lobbyFloorMesh.position.set(0, -0.25, 50);
lobbyGroup.add(lobbyFloorMesh);

const pads = [];
const padPositions = [
    { x: 0, z: 47.5 },
    { x: -3.5, z: 49.5 },
    { x: 3.5, z: 49.5 },
    { x: 0, z: 52.0 }
];

for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(padPositions[i].x, 0.1, padPositions[i].z);
    lobbyGroup.add(pad);
    pads.push(pad);
}

// MODEL FABRİKASI (değişmedi)
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
let myHealth = 100;
const maxHealth = 100;

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
    isDead = true;
    gameActive = false;
    rabbit.visible = false;
    document.getElementById('death-screen').style.display = 'flex';
    respawnCountdown = 15;
    document.getElementById('countdown-display').innerText = respawnCountdown;
    respawnTimer = setInterval(() => {
        respawnCountdown--;
        document.getElementById('countdown-display').innerText = respawnCountdown;
        if (respawnCountdown <= 0) {
            clearInterval(respawnTimer);
            respawn();
        }
    }, 1000);
}

function respawn() {
    isDead = false;
    gameActive = true;
    rabbit.visible = true;
    rabbit.position.set(0, 0, 0);
    rabbit.rotation.y = 0;
    myHealth = maxHealth;
    updateHealthBar();
    document.getElementById('death-screen').style.display = 'none';
    velocityY = 0;
    jumpCount = 0;
}

function checkCollision(newX, newY, newZ) {
    if (!gameActive) return false;
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.28, newY + 0.15, newZ - 0.28),
        new THREE.Vector3(newX + 0.28, newY + 1.1, newZ + 0.28)
    );
    gameplayGroup.updateMatrixWorld(true);
    for (let i = 0; i < obstacles.length; i++) {
        let obj = obstacles[i];
        if (!obj || !obj.parent) continue;
        let obstacleBox = new THREE.Box3().setFromObject(obj);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (newY >= obstacleBox.max.y - 0.3) continue;
            return true;
        }
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
        if (pX + 0.25 >= box.min.x && pX - 0.25 <= box.max.x &&
            pZ + 0.25 >= box.min.z && pZ - 0.25 <= box.max.z) {
            if (pY >= box.max.y - 0.4) {
                if (box.max.y > highestCeil) highestCeil = box.max.y;
            }
        }
    }
    return highestCeil;
}

let velocityY = 0, jumpCount = 0;
const gravity = 0.8, jumpForce = 18;

window.playSolo = function() {
    isOnlineMode = false;
    gameActive = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    document.getElementById('game-room-title').innerText = "TEK OYUNCULU";
    document.getElementById('game-player-count').innerText = "1";
    lobbyGroup.visible = false;
    gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0);
    rabbit.rotation.y = 0;
    myHealth = maxHealth;
    updateHealthBar();
    gameplayGroup.updateMatrixWorld(true);
};

window.createRoom = function() { isOnlineMode = true; socket.emit('createRoom', { maxPlayers: 4 }); };
window.joinRoom = function() {
    const code = document.getElementById('room-code-input').value.trim();
    if(code.length === 5) { isOnlineMode = true; socket.emit('joinRoom', code); }
};
window.hostStartGame = function() { socket.emit('startGameSignal'); };

socket.on('roomCreated', (data) => { setupLobbyUI(data); });
socket.on('roomUpdate', (data) => { setupLobbyUI(data); });

function setupLobbyUI(data) {
    maxPlayersLimit = data.maxPlayers;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-ui').style.display = 'block';
    document.getElementById('ui-room-code').innerText = data.roomCode;
    const currentCount = Object.keys(data.players).length;
    document.getElementById('ui-player-count').innerText = `Oyuncu: ${currentCount} / ${maxPlayersLimit}`;
    if (data.hostId === socket.id) {
        document.getElementById('ui-start-btn').style.display = 'block';
        document.getElementById('ui-waiting-msg').style.display = 'none';
    } else {
        document.getElementById('ui-start-btn').style.display = 'none';
        document.getElementById('ui-waiting-msg').style.display = 'block';
    }
    gameplayGroup.visible = false;
    lobbyGroup.visible = true;
    rabbit.position.set(padPositions[0].x, 0.2, padPositions[0].z);
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    let padIndex = 1;
    Object.keys(data.players).forEach((id) => {
        if (id !== socket.id && padIndex < 4) {
            const pos = padPositions[padIndex];
            addOtherPlayer(id, pos.x, 0.2, pos.z);
            padIndex++;
        }
    });
}

socket.on('gameStartedAtAll', (allPlayers) => {
    document.getElementById('lobby-ui').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    const currentCode = document.getElementById('ui-room-code').innerText;
    document.getElementById('game-room-title').innerText = "ODA: " + currentCode;
    document.getElementById('game-player-count').innerText = Object.keys(allPlayers).length;
    lobbyGroup.visible = false;
    gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0);
    rabbit.rotation.y = 0;
    myHealth = maxHealth;
    updateHealthBar();
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    Object.keys(allPlayers).forEach((id) => {
        if (id !== socket.id) addOtherPlayer(id, 0, 0, 0);
    });
    gameActive = true;
    isDead = false;
    gameplayGroup.updateMatrixWorld(true);
});

function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const modelData = createRabbitModel(false);
    modelData.mesh.position.set(x, y, z);
    scene.add(modelData.mesh);
    otherPlayers[id] = {
        mesh: modelData.mesh,
        visual: modelData.visual,
        head: modelData.head,
        isAttacking: false,
        attackAnimTime: 0
    };
}

socket.on('playerMoved', (playerInfo) => {
    if (gameActive && otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        otherPlayers[playerInfo.id].mesh.rotation.y = playerInfo.ry;
    }
});

socket.on('playerAttacked', (id) => {
    if (gameActive && otherPlayers[id]) {
        otherPlayers[id].isAttacking = true;
        otherPlayers[id].attackAnimTime = 0;
    }
});

socket.on('knockback', (angle) => {
    if (!gameActive || isDead) return;
    rabbit.position.x += Math.sin(angle) * 2.0;
    rabbit.position.z += Math.cos(angle) * 2.0;
    socket.emit('playerMovement', { 
        x: rabbit.position.x, 
        y: rabbit.position.y, 
        z: rabbit.position.z, 
        ry: rabbit.rotation.y 
    });
});

socket.on('playerDisconnected', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id].mesh);
        delete otherPlayers[id];
    }
});

socket.on('hostDisconnected', () => {
    alert('Oda sahibi oyundan ayrıldı. Lobiye dönülüyor.');
    location.reload();
});

// KONTROLLER (aynı)
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
let joystickActive = false, moveX = 0, moveZ = 0;

zone.addEventListener('touchstart', (e) => { if(!gameActive || isDead) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive && !isDead) {
        for (let i = 0; i < e.touches.length; i++) {
            if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; }
        }
    }
}, { passive: true });
zone.addEventListener('touchend', () => { joystickActive = false; stick.style.transform = 'translate(0px, 0px)'; moveX = 0; moveZ = 0; });

function handleJoystick(clientX, clientY) {
    const zoneRect = zone.getBoundingClientRect();
    let deltaX = clientX - (zoneRect.left + zoneRect.width / 2), deltaY = clientY - (zoneRect.top + zoneRect.height / 2);
    let dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (dist > maxRadius) { deltaX = (deltaX / dist) * maxRadius; deltaY = (deltaY / dist) * maxRadius; }
    stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    moveX = deltaX / maxRadius; moveZ = deltaY / maxRadius;
}

let cameraAngleY = 0, cameraAngleX = 0.3, cameraDistance = 5, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
window.addEventListener('touchstart', (e) => {
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    if (e.touches.length === 1 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) {
        isTurningCamera = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jBtn.contains(e.touches[i].target) && !aBtn.contains(e.target)) {
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.006;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.006;
            cameraAngleX = Math.max(0.1, Math.min(1.1, cameraAngleX));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break;
        }
    }
}, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });

document.getElementById('jump-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
    }
});

document.getElementById('attack-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && !isAttacking) {
        isAttacking = true; attackAnimTime = 0;
        if (isOnlineMode) socket.emit('playerAttack');

        if (isOnlineMode && gameActive) {
            Object.keys(otherPlayers).forEach((id) => {
                const otherPos = otherPlayers[id].mesh.position;
                const dist = rabbit.position.distanceTo(otherPos);
                if (dist < 2.0) {
                    const angle = Math.atan2(
                        otherPos.x - rabbit.position.x,
                        otherPos.z - rabbit.position.z
                    );
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
            const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
            const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
            const dirX = (forwardX * -moveZ) - (rightX * moveX);
            const dirZ = (forwardZ * -moveZ) - (rightZ * moveX);
            
            const nextX = rabbit.position.x + dirX * 9.0 * deltaTime;
            const nextZ = rabbit.position.z + dirZ * 9.0 * deltaTime;
            
            if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
            if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
            
            rabbit.rotation.y = Math.atan2(dirX, dirZ);
            hasMoved = true;

            legWiggle += 15 * deltaTime;
            footFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
            footBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        } else {
            footFL.position.y = 0.08; footFR.position.y = 0.08; footBL.position.y = 0.08; footBR.position.y = 0.08;
        }

        if (isAttacking) {
            attackAnimTime += 12 * deltaTime; const factor = Math.sin(attackAnimTime * Math.PI);
            if (attackAnimTime <= 1.0) { rabbitVisualGroup.position.z = factor * 0.5; head.position.z = 0.1 + factor * 0.25; head.rotation.x = factor * 0.4; }
            else { isAttacking = false; rabbitVisualGroup.position.z = 0; head.position.z = 0.1; head.rotation.x = 0; }
        }
        Object.keys(otherPlayers).forEach((id) => {
            const p = otherPlayers[id];
            if (p.isAttacking) {
                p.attackAnimTime += 12 * deltaTime; const factor = Math.sin(p.attackAnimTime * Math.PI);
                if (p.attackAnimTime <= 1.0) { p.visual.position.z = factor * 0.5; p.head.position.z = 0.1 + factor * 0.25; p.head.rotation.x = factor * 0.4; }
                else { p.isAttacking = false; p.visual.position.z = 0; p.head.position.z = 0.1; p.head.rotation.x = 0; }
            }
        });

        const currentFloorY = getFloorY(rabbit.position.x, rabbit.position.y, rabbit.position.z);
        velocityY -= gravity * 60 * deltaTime;
        rabbit.position.y += velocityY * deltaTime;
        if (rabbit.position.y <= currentFloorY) {
            rabbit.position.y = currentFloorY;
            velocityY = 0;
            jumpCount = 0;
        }

        if (isOnlineMode) {
            Object.keys(otherPlayers).forEach((id) => {
                const other = otherPlayers[id].mesh;
                const dist = rabbit.position.distanceTo(other.position);
                if (dist < 1.2 && dist > 0.01) {
                    const angle = Math.atan2(rabbit.position.x - other.position.x, rabbit.position.z - other.position.z);
                    const pushX = Math.sin(angle) * 0.05;
                    const pushZ = Math.cos(angle) * 0.05;
                    rabbit.position.x += pushX;
                    rabbit.position.z += pushZ;
                    other.position.x -= pushX;
                    other.position.z -= pushZ;
                }
            });
        }

        if (hasMoved || isAttacking) {
            socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
        }

        camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.y = rabbit.position.y + Math.sin(cameraAngleX) * cameraDistance;
        camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});