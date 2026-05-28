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

// 3D SAHNE AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 100, 350);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
sunLight.position.set(100, 120, 80);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// --- ANA GRUP ---
const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

// Devasa ana zemin (çimen)
const groundGeo = new THREE.CircleGeometry(150, 128);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x7ba428, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

// İç bölge (daha açık)
const innerGroundGeo = new THREE.CircleGeometry(110, 128);
const innerGroundMat = new THREE.MeshStandardMaterial({ color: 0x96c93d, roughness: 0.85 });
const innerGround = new THREE.Mesh(innerGroundGeo, innerGroundMat);
innerGround.rotation.x = -Math.PI / 2;
innerGround.position.y = 0.02;
innerGround.receiveShadow = true;
gameplayGroup.add(innerGround);

// Çarpışma ve portal listeleri
const obstacles = [];
const portals = [];

// --- BÖLGE İNŞA FONKSİYONLARI ---

// Ağaç (merkez orman)
function createTree(x, z, scale = 1, type = 'round') {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2.5 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25 * scale; trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    if (type === 'round') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.4 });
        for (let i = 0; i < 4; i++) {
            const sGeo = new THREE.SphereGeometry(0.65 * scale - i * 0.1, 8, 6);
            const s = new THREE.Mesh(sGeo, leafMat);
            s.position.set((Math.random() - 0.5) * 0.6 * scale, 2.0 * scale + i * 0.5 * scale, (Math.random() - 0.5) * 0.6 * scale);
            s.castShadow = true; s.receiveShadow = true;
            group.add(s);
        }
    } else if (type === 'cone') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
            const cGeo = new THREE.ConeGeometry(0.65 * scale - i * 0.1, 0.8 * scale, 8);
            const c = new THREE.Mesh(cGeo, leafMat);
            c.position.y = 1.9 * scale + i * 0.65 * scale;
            c.castShadow = true; c.receiveShadow = true;
            group.add(c);
        }
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(trunk);
    return group;
}

// Çiçek
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

// Çalı
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

// Kaya
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

// Portal (ışınlanma halkası)
function createPortal(x, z, targetX, targetZ, color = 0x00ffff) {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.0, 0.15, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);
    // Işık huzmesi
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.3 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 1.25;
    group.add(pillar);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    portals.push({ mesh: group, target: new THREE.Vector3(targetX, 0, targetZ), color: color });
    return group;
}

// --- BÖLGE 1: MERKEZ ORMAN (Başlangıç) ---
for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 35;
    createTree(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.8 + Math.random() * 0.8, Math.random() > 0.5 ? 'round' : 'cone');
}
for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 40;
    createFlower(Math.cos(angle) * radius, Math.sin(angle) * radius, [0xffaa88, 0xffcc44, 0xff6699][Math.floor(Math.random() * 3)]);
}
for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 45;
    createBush(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.6 + Math.random() * 1.0);
}
for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 12 + Math.random() * 42;
    createBoulder(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.5 + Math.random() * 1.5);
}

// Merkezdeki ana portallar (diğer bölgelere)
createPortal(0, -25, 0, -130, 0xff8844);   // Güney Çöl
createPortal(25, 0, 130, 0, 0x44ff44);     // Doğu Mantar
createPortal(-25, 0, -130, 0, 0xff4444);   // Batı Volkan
createPortal(0, 25, 0, 130, 0x44ffff);     // Kuzey Kar
createPortal(18, 18, 90, 90, 0xcc44ff);    // KB Kristal (daha yakın)
createPortal(-18, 18, -90, 90, 0xffaa00);  // GD Harabeler

// --- BÖLGE 2: KUZEY KARLI DAĞLAR (z = 130) ---
const snowGroundGeo = new THREE.CircleGeometry(40, 64);
const snowGroundMat = new THREE.MeshStandardMaterial({ color: 0xe0f0ff, roughness: 0.6 });
const snowGround = new THREE.Mesh(snowGroundGeo, snowGroundMat);
snowGround.rotation.x = -Math.PI / 2;
snowGround.position.set(0, 0, 130);
snowGround.receiveShadow = true;
gameplayGroup.add(snowGround);

for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 30;
    const x = Math.cos(angle) * radius;
    const z = 130 + Math.sin(angle) * radius;
    const tree = createTree(x, z, 0.9 + Math.random() * 0.7, 'cone');
    tree.children[0].material.color.set(0x6B4226); // koyu gövde
}
for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 32;
    const iceGeo = new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.5, 0);
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, roughness: 0.1, metalness: 0.3, emissive: 0x112233, emissiveIntensity: 0.2 });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.position.set(Math.cos(angle) * radius, 0.2, 130 + Math.sin(angle) * radius);
    ice.castShadow = true; ice.receiveShadow = true;
    gameplayGroup.add(ice);
    obstacles.push(ice);
}
createPortal(0, 130, 0, 20, 0x44ffff); // Geri dönüş portalı

// --- BÖLGE 3: GÜNEY ÇÖL (z = -130) ---
const sandGroundGeo = new THREE.CircleGeometry(45, 64);
const sandGroundMat = new THREE.MeshStandardMaterial({ color: 0xedc9af, roughness: 0.9 });
const sandGround = new THREE.Mesh(sandGroundGeo, sandGroundMat);
sandGround.rotation.x = -Math.PI / 2;
sandGround.position.set(0, 0, -130);
sandGround.receiveShadow = true;
gameplayGroup.add(sandGround);

for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 35;
    const x = Math.cos(angle) * radius;
    const z = -130 + Math.sin(angle) * radius;
    const cactusGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25; trunk.castShadow = true; trunk.receiveShadow = true;
    cactusGroup.add(trunk);
    // Kollar
    for (let j = 0; j < 3; j++) {
        const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6);
        const arm = new THREE.Mesh(armGeo, trunkMat);
        arm.position.set((Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6);
        arm.rotation.z = (Math.random() - 0.5) * 0.8;
        arm.rotation.x = (Math.random() - 0.5) * 0.8;
        arm.castShadow = true;
        cactusGroup.add(arm);
    }
    cactusGroup.position.set(x, 0, z);
    gameplayGroup.add(cactusGroup);
    obstacles.push(trunk);
}
createPortal(0, -130, 0, -20, 0xff8844);

// --- BÖLGE 4: DOĞU MANTAR ORMANI (x = 130) ---
const mushGroundGeo = new THREE.CircleGeometry(40, 64);
const mushGroundMat = new THREE.MeshStandardMaterial({ color: 0x7a5c8a, roughness: 0.85 });
const mushGround = new THREE.Mesh(mushGroundGeo, mushGroundMat);
mushGround.rotation.x = -Math.PI / 2;
mushGround.position.set(130, 0, 0);
mushGround.receiveShadow = true;
gameplayGroup.add(mushGround);

for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 30;
    const x = 130 + Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const stemGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.0 + Math.random() * 2.5, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 1.2; stem.castShadow = true; stem.receiveShadow = true;
    const capGeo = new THREE.SphereGeometry(0.9 + Math.random() * 0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: [0xff5555, 0x55ff55, 0x5555ff, 0xff55ff][Math.floor(Math.random() * 4)], roughness: 0.3 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = stem.position.y + 1.5; cap.castShadow = true;
    const mushGroup = new THREE.Group();
    mushGroup.add(stem);
    mushGroup.add(cap);
    mushGroup.position.set(x, 0, z);
    gameplayGroup.add(mushGroup);
    obstacles.push(stem);
}
createPortal(130, 0, 20, 0, 0x44ff44);

// --- BÖLGE 5: BATI VOLKANİK (x = -130) ---
const lavaGroundGeo = new THREE.CircleGeometry(40, 64);
const lavaGroundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
const lavaGround = new THREE.Mesh(lavaGroundGeo, lavaGroundMat);
lavaGround.rotation.x = -Math.PI / 2;
lavaGround.position.set(-130, 0, 0);
lavaGround.receiveShadow = true;
gameplayGroup.add(lavaGround);

for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 15 + Math.random() * 20;
    const x = -130 + Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const poolGeo = new THREE.CircleGeometry(2 + Math.random() * 3, 32);
    const poolMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.9, roughness: 0.2 });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.05, z);
    gameplayGroup.add(pool);
}
for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 32;
    const x = -130 + Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rockGeo = new THREE.IcosahedronGeometry(0.6 + Math.random() * 1.2, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, 0.3, z);
    rock.castShadow = true; rock.receiveShadow = true;
    gameplayGroup.add(rock);
    obstacles.push(rock);
}
createPortal(-130, 0, -20, 0, 0xff4444);

// --- BÖLGE 6: KUZEYBATI KRİSTAL MAĞARALAR (x = 90, z = 90) ---
const crystalGroundGeo = new THREE.CircleGeometry(35, 64);
const crystalGroundMat = new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.7 });
const crystalGround = new THREE.Mesh(crystalGroundGeo, crystalGroundMat);
crystalGround.rotation.x = -Math.PI / 2;
crystalGround.position.set(90, 0, 90);
crystalGround.receiveShadow = true;
gameplayGroup.add(crystalGround);

for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 28;
    const x = 90 + Math.cos(angle) * radius;
    const z = 90 + Math.sin(angle) * radius;
    const crystalGeo = new THREE.OctahedronGeometry(0.3 + Math.random() * 0.7, 0);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xcc88ff, roughness: 0.2, metalness: 0.4, emissive: 0x220044, emissiveIntensity: 0.5 });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(x, 0.4, z);
    crystal.castShadow = true; crystal.receiveShadow = true;
    crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    gameplayGroup.add(crystal);
    obstacles.push(crystal);
}
createPortal(90, 90, 15, 15, 0xcc44ff);

// --- BÖLGE 7: GÜNEYDOĞU HARABELER (x = -90, z = -90) ---
const ruinGroundGeo = new THREE.CircleGeometry(35, 64);
const ruinGroundMat = new THREE.MeshStandardMaterial({ color: 0x8b7d6b, roughness: 0.9 });
const ruinGround = new THREE.Mesh(ruinGroundGeo, ruinGroundMat);
ruinGround.rotation.x = -Math.PI / 2;
ruinGround.position.set(-90, 0, -90);
ruinGround.receiveShadow = true;
gameplayGroup.add(ruinGround);

for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * Math.PI * 2;
    const radius = 12 + Math.random() * 18;
    const x = -90 + Math.cos(angle) * radius;
    const z = -90 + Math.sin(angle) * radius;
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 3.5 + Math.random() * 2, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.7 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(x, 1.8, z);
    pillar.castShadow = true; pillar.receiveShadow = true;
    gameplayGroup.add(pillar);
    obstacles.push(pillar);
}
createPortal(-90, -90, -15, -15, 0xffaa00);

// --- LOBİ ODASI (aynı) ---
const lobbyGroup = new THREE.Group();
scene.add(lobbyGroup);
const cylinderGeo = new THREE.CylinderGeometry(12, 12, 15, 32, 1, true);
const cylinderMat = new THREE.MeshStandardMaterial({ color: 0x00a2ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1 });
const lobbyRoom = new THREE.Mesh(cylinderGeo, cylinderMat);
lobbyRoom.position.set(0, 7.5, 50);
lobbyGroup.add(lobbyRoom);
const lobbyFloorGeo = new THREE.CylinderGeometry(12, 12, 0.5, 32);
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.5 });
const lobbyFloorMesh = new THREE.Mesh(lobbyFloorGeo, lobbyFloorMat);
lobbyFloorMesh.position.set(0, -0.25, 50);
lobbyGroup.add(lobbyFloorMesh);
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
        if (id !== socket.id && padIndex < 4) { const pos = padPositions[padIndex]; addOtherPlayer(id, pos.x, 0.2, pos.z); padIndex++; }
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
socket.on('playerAttacked', (id) => { if (gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; } });
socket.on('knockback', (angle) => {
    if (!gameActive || isDead) return;
    rabbit.position.x += Math.sin(angle) * 2.0; rabbit.position.z += Math.cos(angle) * 2.0;
    socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
});
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; } });
socket.on('hostDisconnected', () => { alert('Oda sahibi oyundan ayrıldı.'); location.reload(); });

// KONTROLLER
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
let joystickActive = false, moveX = 0, moveZ = 0;
zone.addEventListener('touchstart', (e) => { if(!gameActive || isDead) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive && !isDead) {
        for (let i = 0; i < e.touches.length; i++) { if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; } }
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
let cameraAngleY = 0, cameraAngleX = 0.4, cameraDistance = 7, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
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
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005;
            cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX));
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

// ANA DÖNGÜ + PORTAL KONTROLÜ
let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    let hasMoved = false;

    // Portal kontrolü (ışınlanma)
    if (gameActive && !isDead) {
        const now = Date.now() / 1000;
        for (let i = 0; i < portals.length; i++) {
            const p = portals[i];
            const dist = new THREE.Vector2(rabbit.position.x - p.mesh.position.x, rabbit.position.z - p.mesh.position.z).length();
            if (dist < 2.5 && (now - lastTeleportTime > teleportCooldown)) {
                lastTeleportTime = now;
                // Kararma efekti
                document.getElementById('death-screen').style.display = 'flex';
                document.getElementById('death-screen').style.background = 'rgba(0,0,0,0.95)';
                document.querySelector('.death-text').innerText = 'YÜKLENİYOR...';
                document.getElementById('countdown-display').innerText = '';
                setTimeout(() => {
                    rabbit.position.x = p.target.x;
                    rabbit.position.z = p.target.z;
                    document.getElementById('death-screen').style.display = 'none';
                }, 800);
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
            const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
            const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
            const dirX = (forwardX * -moveZ) - (rightX * moveX);
            const dirZ = (forwardZ * -moveZ) - (rightZ * moveX);
            const nextX = rabbit.position.x + dirX * 12.0 * deltaTime;
            const nextZ = rabbit.position.z + dirZ * 12.0 * deltaTime;
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