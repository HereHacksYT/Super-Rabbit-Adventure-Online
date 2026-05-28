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
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 70, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.55);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.85);
sunLight.position.set(60, 80, 50);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -60;
sunLight.shadow.camera.right = 60;
sunLight.shadow.camera.top = 60;
sunLight.shadow.camera.bottom = -60;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

// --- ASIL OYUN DÜNYASI (BÜYÜK HARİTA) ---
const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

// Devasa ana zemin
const groundGeo = new THREE.CircleGeometry(75, 64);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x7ba428, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

// İç bölge (daha açık yeşil)
const innerGroundGeo = new THREE.CircleGeometry(55, 64);
const innerGroundMat = new THREE.MeshStandardMaterial({ color: 0x96c93d, roughness: 0.8 });
const innerGround = new THREE.Mesh(innerGroundGeo, innerGroundMat);
innerGround.rotation.x = -Math.PI / 2;
innerGround.position.y = 0.02;
innerGround.receiveShadow = true;
gameplayGroup.add(innerGround);

// Çarpışma listesi
const obstacles = [];

// --- YARDIMCI FONKSİYONLAR ---
function createMesa(x, z, radius, height, color = 0x9b8c75) {
    const group = new THREE.Group();
    // Gövde
    const bodyGeo = new THREE.CylinderGeometry(radius, radius + 0.5, height, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    // Üst çimen
    const topGeo = new THREE.CylinderGeometry(radius + 0.1, radius + 0.1, 0.3, 16);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x8cc63e, roughness: 0.8 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = height + 0.15;
    top.receiveShadow = true;
    group.add(top);

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createHill(x, z, radius, height) {
    const geo = new THREE.ConeGeometry(radius, height, 16, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7ba428, roughness: 0.8 });
    const hill = new THREE.Mesh(geo, mat);
    hill.position.set(x, height / 2, z);
    hill.receiveShadow = true; hill.castShadow = true;
    gameplayGroup.add(hill);
    obstacles.push(hill);
    return hill;
}

function createTree(x, z, scale = 1, type = 'round') {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2.5 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25 * scale;
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);

    if (type === 'round') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.4 });
        for (let i = 0; i < 4; i++) {
            const sGeo = new THREE.SphereGeometry(0.7 * scale - i * 0.1, 8, 6);
            const s = new THREE.Mesh(sGeo, leafMat);
            s.position.set((Math.random() - 0.5) * 0.5 * scale, 2.2 * scale + i * 0.5 * scale, (Math.random() - 0.5) * 0.5 * scale);
            s.castShadow = true; s.receiveShadow = true;
            group.add(s);
        }
    } else if (type === 'cone') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
            const cGeo = new THREE.ConeGeometry(0.7 * scale - i * 0.1, 0.9 * scale, 8);
            const c = new THREE.Mesh(cGeo, leafMat);
            c.position.y = 2.0 * scale + i * 0.7 * scale;
            c.castShadow = true; c.receiveShadow = true;
            group.add(c);
        }
    } else if (type === 'weeping') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3f, roughness: 0.5 });
        const topGeo = new THREE.SphereGeometry(1.0 * scale, 8, 6);
        const top = new THREE.Mesh(topGeo, leafMat);
        top.position.y = 3.0 * scale;
        top.castShadow = true; top.receiveShadow = true;
        group.add(top);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const vineGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.5 * scale, 4);
            const vine = new THREE.Mesh(vineGeo, leafMat);
            vine.position.set(Math.cos(angle) * 0.6 * scale, 1.8 * scale, Math.sin(angle) * 0.6 * scale);
            vine.rotation.z = (Math.random() - 0.5) * 0.6;
            vine.rotation.x = (Math.random() - 0.5) * 0.6;
            vine.castShadow = true;
            group.add(vine);
        }
    }

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(trunk);
    return group;
}

function createBigMushroom(x, z, scale = 1) {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.35 * scale, 0.45 * scale, 2.5 * scale, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 1.25 * scale; stem.castShadow = true; stem.receiveShadow = true;
    group.add(stem);
    const capGeo = new THREE.SphereGeometry(1.0 * scale, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.3, metalness: 0.1 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 2.5 * scale; cap.castShadow = true; cap.receiveShadow = true;
    group.add(cap);
    for (let i = 0; i < 6; i++) {
        const dotGeo = new THREE.SphereGeometry(0.12 * scale, 4);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const angle = (i / 6) * Math.PI * 2;
        dot.position.set(Math.cos(angle) * 0.6 * scale, 2.8 * scale, Math.sin(angle) * 0.6 * scale);
        group.add(dot);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(stem);
    return group;
}

function createRockPlatform(x, z, scale = 1) {
    const geo = new THREE.CylinderGeometry(0.9 * scale, 1.1 * scale, 0.6 * scale, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5, metalness: 0.2 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 0.3 * scale, z);
    rock.castShadow = true; rock.receiveShadow = true;
    gameplayGroup.add(rock);
    obstacles.push(rock);
    return rock;
}

function createBoulder(x, z, scale = 1) {
    const geo = new THREE.IcosahedronGeometry(0.7 * scale, 0);
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
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.5, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.25; group.add(stem);
    const headGeo = new THREE.SphereGeometry(0.16, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.6; group.add(head);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createBush(x, z, scale = 1) {
    const group = new THREE.Group();
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3a6b1e, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
        const sGeo = new THREE.SphereGeometry(0.35 * scale, 6);
        const s = new THREE.Mesh(sGeo, bushMat);
        s.position.set((Math.random() - 0.5) * 0.5 * scale, 0.2 * scale, (Math.random() - 0.5) * 0.5 * scale);
        s.castShadow = true; s.receiveShadow = true;
        group.add(s);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createWoodenBridge(x, z, rotY = 0, length = 5) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    for (let side = -1; side <= 1; side += 2) {
        const railGeo = new THREE.BoxGeometry(length, 0.1, 0.2);
        const rail = new THREE.Mesh(railGeo, woodMat);
        rail.position.set(0, 0.5, side * 0.6);
        rail.castShadow = true; rail.receiveShadow = true;
        group.add(rail);
        // Direkler
        for (let j = 0; j < 3; j++) {
            const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 4);
            const post = new THREE.Mesh(postGeo, woodMat);
            post.position.set(-length / 2 + j * (length / 2), 0.3, side * 0.6);
            post.castShadow = true;
            group.add(post);
        }
    }
    // Tabandan çıtalar
    for (let i = 0; i < length * 2; i++) {
        const slatGeo = new THREE.BoxGeometry(0.25, 0.06, 1.2);
        const slat = new THREE.Mesh(slatGeo, woodMat);
        slat.position.set(-length / 2 + i * 0.5 + 0.25, 0.15, 0);
        slat.castShadow = true; slat.receiveShadow = true;
        group.add(slat);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

// --- NEHİR (AKAN SU) ---
const riverSegments = [];
const riverPath = [
    [-40, -35], [-35, -28], [-30, -22], [-25, -16], [-20, -10],
    [-15, -5], [-10, -1], [-5, 3], [0, 6], [5, 10],
    [10, 15], [15, 20], [20, 26], [25, 32], [30, 38]
];

function createRiverSegment(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);

    const geo = new THREE.BoxGeometry(2.8, 0.08, length);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x4499dd,
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.75
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
    water.rotation.y = angle;
    water.receiveShadow = true;
    gameplayGroup.add(water);
    riverSegments.push({ mesh: water, baseY: 0.06, speed: 0.3 + Math.random() * 0.5, offset: Math.random() * Math.PI * 2 });
    return water;
}

// Nehir kenarı taşları
function createRiverRock(x, z) {
    const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.25, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 0.05, z);
    rock.castShadow = true; rock.receiveShadow = true;
    gameplayGroup.add(rock);
    return rock;
}

// --- HARİTAYI OLUŞTUR ---

// Mesalar (yüksek düzlükler)
createMesa(20, 20, 6, 4, 0x9b8c75);
createMesa(-22, -15, 7, 5, 0xa89070);
createMesa(18, -20, 5, 3.5, 0x8b7d6b);
createMesa(-18, 22, 6.5, 4.5, 0x968870);
createMesa(0, 30, 4, 3, 0xa09078);

// Tepeler
createHill(-35, 30, 8, 6);
createHill(35, -30, 7, 5);
createHill(-30, -35, 9, 7);
createHill(32, 32, 6, 4.5);
createHill(0, -40, 8, 6);
createHill(-40, 0, 7, 5);

// Nehir
for (let i = 0; i < riverPath.length - 1; i++) {
    createRiverSegment(
        riverPath[i][0], riverPath[i][1],
        riverPath[i + 1][0], riverPath[i + 1][1]
    );
}

// Nehir kenarı taşları
for (let i = 0; i < 80; i++) {
    const t = i / 80;
    const idx = Math.floor(t * (riverPath.length - 1));
    const frac = t * (riverPath.length - 1) - idx;
    const x = riverPath[idx][0] + (riverPath[Math.min(idx + 1, riverPath.length - 1)][0] - riverPath[idx][0]) * frac;
    const z = riverPath[idx][1] + (riverPath[Math.min(idx + 1, riverPath.length - 1)][1] - riverPath[idx][1]) * frac;
    const side = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 0.8);
    const perpX = -(riverPath[Math.min(idx + 1, riverPath.length - 1)][0] - riverPath[idx][0]) / Math.max(Math.abs(riverPath[Math.min(idx + 1, riverPath.length - 1)][0] - riverPath[idx][0]), 0.1);
    const perpZ = (riverPath[Math.min(idx + 1, riverPath.length - 1)][1] - riverPath[idx][1]) / Math.max(Math.abs(riverPath[Math.min(idx + 1, riverPath.length - 1)][1] - riverPath[idx][1]), 0.1);
    createRiverRock(x + perpX * side * 2.5, z + perpZ * side * 2.5);
}

// Köprüler (nehir üzerinde)
createWoodenBridge(-15, -3, -0.5, 6);
createWoodenBridge(12, 17, 0.6, 5.5);
createWoodenBridge(-5, 5, 0.3, 5);

// Ağaçlar (bolca)
const treePositions = [
    [-28, 15], [30, -15], [-25, -25], [28, 25], [-32, 8], [33, -8],
    [-20, 35], [20, -32], [-35, -20], [35, 18], [-10, 40], [15, -38],
    [-38, -10], [38, -22], [-15, 42], [22, 35], [-42, 15], [40, 10],
    [-33, 33], [33, -33], [-28, -30], [30, 28], [-40, 28], [28, -40],
    [8, 42], [-8, -42], [42, -15], [-45, 0], [45, 5], [-5, -44]
];
treePositions.forEach(p => createTree(p[0], p[1], 0.8 + Math.random() * 0.6, ['round', 'cone', 'weeping'][Math.floor(Math.random() * 3)]));

// Büyük mantarlar
createBigMushroom(-12, -8, 1.3);
createBigMushroom(14, 8, 1.1);
createBigMushroom(-8, 15, 1.2);
createBigMushroom(10, -12, 1.0);
createBigMushroom(25, -10, 1.4);
createBigMushroom(-25, 10, 1.1);
createBigMushroom(0, 20, 1.3);

// Taş platformlar
for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 35;
    createRockPlatform(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.5 + Math.random() * 1.2);
}

// Kayalar
for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 40;
    createBoulder(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.5 + Math.random() * 1.5);
}

// Çalılıklar
for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * 45;
    createBush(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.6 + Math.random() * 1.2);
}

// Çiçekler
for (let i = 0; i < 120; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 48;
    createFlower(Math.cos(angle) * radius, Math.sin(angle) * radius, [0xffaa88, 0xffcc44, 0xff6699, 0xff8844, 0xffff66][Math.floor(Math.random() * 5)]);
}

// --- LOBİ ODASI ---
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
    { x: 0, z: 47.5 }, { x: -3.5, z: 49.5 }, { x: 3.5, z: 49.5 }, { x: 0, z: 52.0 }
];
for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(padPositions[i].x, 0.1, padPositions[i].z);
    lobbyGroup.add(pad);
    pads.push(pad);
}

// MODEL FABRİKASI
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
        if (respawnCountdown <= 0) { clearInterval(respawnTimer); respawn(); }
    }, 1000);
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
        if (pX + 0.25 >= box.min.x && pX - 0.25 <= box.max.x && pZ + 0.25 >= box.min.z && pZ - 0.25 <= box.max.z) {
            if (pY >= box.max.y - 0.4) { if (box.max.y > highestCeil) highestCeil = box.max.y; }
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
    lobbyGroup.visible = false; gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    gameplayGroup.updateMatrixWorld(true);
};
window.createRoom = function() { isOnlineMode = true; socket.emit('createRoom', { maxPlayers: 4 }); };
window.joinRoom = function() { const code = document.getElementById('room-code-input').value.trim(); if(code.length === 5) { isOnlineMode = true; socket.emit('joinRoom', code); } };
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
    gameplayGroup.visible = false; lobbyGroup.visible = true;
    rabbit.position.set(padPositions[0].x, 0.2, padPositions[0].z);
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    let padIndex = 1;
    Object.keys(data.players).forEach((id) => {
        if (id !== socket.id && padIndex < 4) {
            const pos = padPositions[padIndex];
            addOtherPlayer(id, pos.x, 0.2, pos.z); padIndex++;
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
    lobbyGroup.visible = false; gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    Object.keys(allPlayers).forEach((id) => { if (id !== socket.id) addOtherPlayer(id, 0, 0, 0); });
    gameActive = true; isDead = false;
    gameplayGroup.updateMatrixWorld(true);
});

function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const modelData = createRabbitModel(false);
    modelData.mesh.position.set(x, y, z); scene.add(modelData.mesh);
    otherPlayers[id] = { mesh: modelData.mesh, visual: modelData.visual, head: modelData.head, isAttacking: false, attackAnimTime: 0 };
}

socket.on('playerMoved', (playerInfo) => {
    if (gameActive && otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        otherPlayers[playerInfo.id].mesh.rotation.y = playerInfo.ry;
    }
});
socket.on('playerAttacked', (id) => {
    if (gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; }
});
socket.on('knockback', (angle) => {
    if (!gameActive || isDead) return;
    rabbit.position.x += Math.sin(angle) * 2.0; rabbit.position.z += Math.cos(angle) * 2.0;
    socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
});
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; } });
socket.on('hostDisconnected', () => { alert('Oda sahibi oyundan ayrıldı. Lobiye dönülüyor.'); location.reload(); });

// KONTROLLER
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

let cameraAngleY = 0, cameraAngleX = 0.3, cameraDistance = 6, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
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
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005; cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005;
            cameraAngleX = Math.max(0.1, Math.min(1.1, cameraAngleX));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break;
        }
    }
}, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });

document.getElementById('jump-button').addEventListener('touchstart', (e) => {
    e.preventDefault(); if (gameActive && !isDead && jumpCount < 2) { velocityY = jumpForce; jumpCount++; }
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
                    const angle = Math.atan2(otherPos.x - rabbit.position.x, otherPos.z - rabbit.position.z);
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

    // Nehir animasyonu
    const time = Date.now() * 0.001;
    riverSegments.forEach(seg => {
        seg.mesh.position.y = seg.baseY + Math.sin(time * seg.speed + seg.offset) * 0.04;
    });

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
            const nextX = rabbit.position.x + dirX * 10.0 * deltaTime;
            const nextZ = rabbit.position.z + dirZ * 10.0 * deltaTime;
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
        if (rabbit.position.y <= currentFloorY) { rabbit.position.y = currentFloorY; velocityY = 0; jumpCount = 0; }

        if (isOnlineMode) {
            Object.keys(otherPlayers).forEach((id) => {
                const other = otherPlayers[id].mesh;
                const dist = rabbit.position.distanceTo(other.position);
                if (dist < 1.2 && dist > 0.01) {
                    const angle = Math.atan2(rabbit.position.x - other.position.x, rabbit.position.z - other.position.z);
                    const pushX = Math.sin(angle) * 0.05; const pushZ = Math.cos(angle) * 0.05;
                    rabbit.position.x += pushX; rabbit.position.z += pushZ;
                    other.position.x -= pushX; other.position.z -= pushZ;
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