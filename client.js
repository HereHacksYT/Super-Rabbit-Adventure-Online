const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false;
let maxPlayersLimit = 4;
let isDead = false;
let respawnTimer = null;
let respawnCountdown = 15;
let lastTeleportTime = 0;
const teleportCooldown = 3;
let isModerator = false;
let infiniteJump = false;

let joystickActive = false;
let moveX = 0;
let moveZ = 0;

const monkeys = [];
let hasKey = false;
let cageOpened = false;

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
const portals = [];

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
});

const blockGrassTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6daa2e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgb(${100 + Math.random()*40}, ${150 + Math.random()*60}, ${30 + Math.random()*30})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 4, 6);
    }
});

const rainforestGroundTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3d5a1e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const shade = 50 + Math.random() * 40;
        const g = 80 + Math.random() * 40;
        const b = 20 + Math.random() * 25;
        ctx.fillStyle = `rgb(${shade}, ${g}, ${b})`;
        ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
});

const mossyStoneTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
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
        }
    }
});

const dirtTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8B6B4D';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
        const shade = 100 + Math.random() * 50;
        ctx.fillStyle = `rgb(${shade}, ${shade*0.7}, ${shade*0.4})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 3, 3);
    }
});

const woodTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c49a6c';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, 0, 2, h);
    }
});

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
        }
    }
});

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
        }
    }
});

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

const leafTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3d7a1c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = `rgb(${40 + Math.random()*30}, ${100 + Math.random()*50}, ${20 + Math.random()*20})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 2, 3);
    }
});

const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.9 });
groundTexture.repeat.set(12, 12);
const rainforestGroundMat = new THREE.MeshStandardMaterial({ map: rainforestGroundTexture, roughness: 0.85 });
rainforestGroundTexture.repeat.set(16, 16);
const blockGrassMat = new THREE.MeshStandardMaterial({ map: blockGrassTexture, roughness: 0.85 });
blockGrassTexture.repeat.set(8, 8);
const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTexture, roughness: 0.75 });
dirtTexture.repeat.set(4, 4);
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.65 });
const stoneWallMat = new THREE.MeshStandardMaterial({ map: stoneTexture, roughness: 0.6 });
const mossyWallMat = new THREE.MeshStandardMaterial({ map: mossyStoneTexture, roughness: 0.65 });
const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture, roughness: 0.7 });
const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture, roughness: 0.4 });
const roofMat = new THREE.MeshStandardMaterial({ map: roofTileTexture, roughness: 0.55 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.15, metalness: 1.0, emissive: 0xff8800, emissiveIntensity: 1.2 });

const modMenuHTML = `<div id="mod-menu" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(0,0,0,0.95); padding:25px; border-radius:15px; z-index:30; color:white; text-align:center; border:2px solid gold; min-width:250px;">
    <h2 style="color:gold; margin-bottom:15px;">🔧 Mod Menü</h2>
    <p id="mod-coords" style="color:#ffeb3b; font-size:16px; margin:10px 0;"></p>
    <button id="btn-infinite-jump" style="padding:12px 20px; margin:8px; background:#444; color:white; border:1px solid white; border-radius:8px; cursor:pointer; width:90%;">999 Zıplama: KAPALI</button>
    <button onclick="closeModMenu()" style="padding:12px 20px; margin:8px; background:#c44; color:white; border:1px solid white; border-radius:8px; cursor:pointer; width:90%;">Kapat</button>
</div>`;
document.body.insertAdjacentHTML('beforeend', modMenuHTML);

window.closeModMenu = function() { document.getElementById('mod-menu').style.display = 'none'; };
document.getElementById('btn-infinite-jump').addEventListener('click', function() {
    infiniteJump = !infiniteJump;
    this.textContent = '999 Zıplama: ' + (infiniteJump ? 'AÇIK' : 'KAPALI');
    this.style.background = infiniteJump ? '#4a4' : '#444';
});

window.openModPrompt = function() {
    const code = prompt('Mod kodu:');
    if (code === '1234') { isModerator = true; document.getElementById('mod-menu').style.display = 'block'; }
    else { alert('Hatalı kod!'); }
};

document.addEventListener('touchmove', function(e) {
    if (!e.target.closest('#joystick-zone') && !e.target.closest('.action-btn') && !e.target.closest('#mod-btn')) {
        e.preventDefault();
    }
}, { passive: false });

const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' && gameActive && !isDead) {
        e.preventDefault();
        if (infiniteJump || jumpCount < 3) {
            velocityY = jumpForce;
            jumpCount++;
        }
    }
    if ((e.key === 'e' || e.key === 'f') && gameActive && !isDead && !isAttacking) {
        e.preventDefault();
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
    // Işık oyunu için ayna döndürme
    if (lightGameActive && (e.key === 'e' || e.key === 'f')) {
        handleMirrorRotate();
    }
    if (e.key === 'm' && e.ctrlKey && e.shiftKey) {
        const code = prompt('Mod kodu:');
        if (code === '1234') { isModerator = true; document.getElementById('mod-menu').style.display = 'block'; }
    }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

const zone = document.getElementById('joystick-zone');
const stick = document.getElementById('joystick-stick');
const maxRadius = 35;

zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameActive || isDead) return;
    joystickActive = true;
    handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive && !isDead) {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            if (zone.contains(e.touches[i].target)) {
                handleJoystick(e.touches[i].clientX, e.touches[i].clientY);
                break;
            }
        }
    }
}, { passive: false });

zone.addEventListener('touchend', () => {
    joystickActive = false;
    stick.style.transform = 'translate(0px, 0px)';
    moveX = 0; moveZ = 0;
});

function handleJoystick(clientX, clientY) {
    const zoneRect = zone.getBoundingClientRect();
    let dx = clientX - (zoneRect.left + zoneRect.width / 2);
    let dy = clientY - (zoneRect.top + zoneRect.height / 2);
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    moveX = dx / maxRadius;
    moveZ = dy / maxRadius;
}

document.getElementById('jump-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead) {
        if (infiniteJump || jumpCount < 3) {
            velocityY = jumpForce;
            jumpCount++;
        }
    }
}, { passive: false });

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
}, { passive: false });

const squareSize = 94;
const groundGeo = new THREE.PlaneGeometry(squareSize, squareSize);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0);
ground.receiveShadow = true;
gameplayGroup.add(ground);

function createShadowlessWall(x, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geo, stoneWallMat);
    wall.position.set(x, height / 2, z);
    wall.castShadow = false; wall.receiveShadow = false;
    gameplayGroup.add(wall);
    obstacles.push(wall);
    return wall;
}

createShadowlessWall(0, 48, squareSize, 100, 2);
createShadowlessWall(0, -48, squareSize, 100, 2);
createShadowlessWall(48, 0, 2, 100, squareSize);
createShadowlessWall(-48, 0, 2, 100, squareSize);

function createMossyWallSegment(x, z, width, height, depth, rotY = 0) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geo, mossyWallMat);
    wall.position.set(x, height / 2, z);
    wall.rotation.y = rotY;
    wall.castShadow = true; wall.receiveShadow = true;
    gameplayGroup.add(wall);
    obstacles.push(wall);
    return wall;
}

function createEnclosingWalls(minX, minZ, maxX, maxZ, height = 25) {
    const widthX = maxX - minX;
    const widthZ = maxZ - minZ;
    const segLen = 50;
    const topCount = Math.ceil(widthX / segLen);
    const topSegLen = widthX / topCount + 1;
    for (let i = 0; i < topCount; i++) {
        const x = minX + (i + 0.5) * (widthX / topCount);
        createMossyWallSegment(x, maxZ, topSegLen, height, 2, 0);
    }
    const bottomCount = Math.ceil(widthX / segLen);
    const bottomSegLen = widthX / bottomCount + 1;
    for (let i = 0; i < bottomCount; i++) {
        const x = minX + (i + 0.5) * (widthX / bottomCount);
        createMossyWallSegment(x, minZ, bottomSegLen, height, 2, 0);
    }
    const leftCount = Math.ceil(widthZ / segLen);
    const leftSegLen = widthZ / leftCount + 1;
    for (let i = 0; i < leftCount; i++) {
        const z = minZ + (i + 0.5) * (widthZ / leftCount);
        createMossyWallSegment(minX, z, leftSegLen, height, 2, Math.PI/2);
    }
    const rightCount = Math.ceil(widthZ / segLen);
    const rightSegLen = widthZ / rightCount + 1;
    for (let i = 0; i < rightCount; i++) {
        const z = minZ + (i + 0.5) * (widthZ / rightCount);
        createMossyWallSegment(maxX, z, rightSegLen, height, 2, Math.PI/2);
    }
}

function createBigGrassBlock(x, z, width, depth, height) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeo, dirtMat);
    body.position.y = height / 2;
    body.castShadow = true; body.receiveShadow = true;
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

function createRock(x, z, scale = 1) {
    const geo = new THREE.IcosahedronGeometry(0.8 * scale, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.2 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 0.3 * scale, z);
    rock.castShadow = true; rock.receiveShadow = true;
    rock.rotation.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
    gameplayGroup.add(rock);
    obstacles.push(rock);
    return rock;
}

function createGoldenPortal(x, z, targetX, targetZ) {
    const group = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 32);
    const base = new THREE.Mesh(baseGeo, goldMat);
    base.position.y = 0.25; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    const ringGeo = new THREE.TorusGeometry(0.75, 0.14, 16, 40);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.0;
    group.add(ring);
    const innerGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16);
    const inner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.15, metalness: 1.0, emissive: 0xff8800, emissiveIntensity: 1.0, transparent: true, opacity: 0.6 }));
    inner.position.y = 1.0;
    group.add(inner);
    const topRingGeo = new THREE.TorusGeometry(0.5, 0.08, 8, 24);
    const topRing = new THREE.Mesh(topRingGeo, goldMat);
    topRing.rotation.x = Math.PI / 2; topRing.position.y = 1.8;
    group.add(topRing);
    const topBallGeo = new THREE.SphereGeometry(0.2, 16, 12);
    const topBall = new THREE.Mesh(topBallGeo, goldMat);
    topBall.position.y = 1.9;
    group.add(topBall);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    portals.push({ mesh: group, target: new THREE.Vector3(targetX, 0, targetZ), color: 0xffcc00 });
    return group;
}

function createSign(x, z, text, rotY = 0) {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 3.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.75; pole.castShadow = true;
    group.add(pole);
    const boardGeo = new THREE.BoxGeometry(4.0, 1.2, 0.2);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.7 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.y = 3.0; board.castShadow = true; board.receiveShadow = true;
    group.add(board);
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c49a6c';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#2d1a0a';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const textTexture = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: textTexture });
    const textPlaneGeo = new THREE.PlaneGeometry(3.8, 1.0);
    const textPlane = new THREE.Mesh(textPlaneGeo, textMat);
    textPlane.position.set(0, 3.0, 0.11);
    group.add(textPlane);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    return group;
}

let rainParticles = null;
function createRainSystem(x, z, width, depth) {
    if (rainParticles) { gameplayGroup.remove(rainParticles); }
    const particleCount = 5000;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = x + (Math.random() - 0.5) * width;
        positions[i * 3 + 1] = Math.random() * 60;
        positions[i * 3 + 2] = z + (Math.random() - 0.5) * depth;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.25, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    rainParticles = new THREE.Points(geo, mat);
    gameplayGroup.add(rainParticles);
    return rainParticles;
}

function updateRain(active, x, z, width, depth) {
    if (!rainParticles) return;
    rainParticles.visible = active;
    if (!active) return;
    const positions = rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] -= 0.6 + Math.random() * 0.4;
        if (positions[i * 3 + 1] < 0) {
            positions[i * 3] = x + (Math.random() - 0.5) * width;
            positions[i * 3 + 1] = 50 + Math.random() * 10;
            positions[i * 3 + 2] = z + (Math.random() - 0.5) * depth;
        }
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
}

const rfMinX = 75, rfMaxX = 325, rfMinZ = 75, rfMaxZ = 325;
const rfCenterX = (rfMinX + rfMaxX) / 2;
const rfCenterZ = (rfMinZ + rfMaxZ) / 2;
const rfWidth = rfMaxX - rfMinX;
const rfDepth = rfMaxZ - rfMinZ;

const rfGroundGeo = new THREE.PlaneGeometry(rfWidth, rfDepth);
const rfGround = new THREE.Mesh(rfGroundGeo, rainforestGroundMat);
rfGround.rotation.x = -Math.PI / 2;
rfGround.position.set(rfCenterX, 0, rfCenterZ);
rfGround.receiveShadow = true;
gameplayGroup.add(rfGround);

createEnclosingWalls(rfMinX, rfMinZ, rfMaxX, rfMaxZ, 25);
createRainSystem(rfCenterX, rfCenterZ, rfWidth, rfDepth);

for (let row = -100; row <= 100; row += 30) {
    for (let col = -100; col <= 100; col += 30) {
        if (Math.abs(row) <= 30 && Math.abs(col) <= 30) continue;
        createBigTree(rfCenterX + col, rfCenterZ + row, 1.5 + Math.random() * 1.0);
    }
}
for (let row = -90; row <= 90; row += 45) {
    for (let col = -90; col <= 90; col += 45) {
        createRock(rfCenterX + col + 10, rfCenterZ + row + 10, 0.8 + Math.random() * 0.8);
    }
}

const cubeMinX = 165, cubeMaxX = 185, cubeMinZ = 125, cubeMaxZ = 155, cubeHeight = 25;
const cubeGeo = new THREE.BoxGeometry(cubeMaxX - cubeMinX, cubeHeight, cubeMaxZ - cubeMinZ);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
const cube = new THREE.Mesh(cubeGeo, cubeMat);
cube.position.set((cubeMinX + cubeMaxX) / 2, cubeHeight / 2, (cubeMinZ + cubeMaxZ) / 2);
cube.castShadow = true; cube.receiveShadow = true;
gameplayGroup.add(cube);
obstacles.push(cube);

const cubeTopGeo = new THREE.BoxGeometry(cubeMaxX - cubeMinX - 0.2, 0.3, cubeMaxZ - cubeMinZ - 0.2);
const cubeTop = new THREE.Mesh(cubeTopGeo, blockGrassMat);
cubeTop.position.set((cubeMinX + cubeMaxX) / 2, cubeHeight + 0.15, (cubeMinZ + cubeMaxZ) / 2);
cubeTop.receiveShadow = true;
gameplayGroup.add(cubeTop);
obstacles.push(cubeTop);

function createMonkey(x, y, z) {
    const monkeyGroup = new THREE.Group();
    monkeyGroup.name = 'monkey';
    const footGeo = new THREE.BoxGeometry(0.25, 0.15, 0.3);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.6 });
    const footL = new THREE.Mesh(footGeo, footMat);
    footL.position.set(-0.2, 0.1, 0.1);
    monkeyGroup.add(footL);
    const footR = new THREE.Mesh(footGeo, footMat);
    footR.position.set(0.2, 0.1, 0.1);
    monkeyGroup.add(footR);
    const legGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x8B5A3C, roughness: 0.6 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.2, 0.4, 0.05);
    monkeyGroup.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.2, 0.4, 0.05);
    monkeyGroup.add(legR);
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B5A3C, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true; body.receiveShadow = true;
    monkeyGroup.add(body);
    const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x8B5A3C, roughness: 0.6 });
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.45, 1.1, 0);
    armL.rotation.z = 0.5;
    monkeyGroup.add(armL);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.45, 1.1, 0);
    armR.rotation.z = -0.5;
    monkeyGroup.add(armR);
    const bananaGroup = new THREE.Group();
    bananaGroup.position.set(0.65, 1.25, 0.15);
    const bananaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.05, 0.2, 0.05),
        new THREE.Vector3(0, 0.4, 0.1),
        new THREE.Vector3(-0.05, 0.55, 0.05),
        new THREE.Vector3(0, 0.65, 0)
    ]);
    const bananaGeo = new THREE.TubeGeometry(bananaCurve, 8, 0.04, 6, false);
    const bananaMat = new THREE.MeshStandardMaterial({ color: 0xFFE135, roughness: 0.4 });
    const banana = new THREE.Mesh(bananaGeo, bananaMat);
    bananaGroup.add(banana);
    monkeyGroup.add(bananaGroup);
    const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xA0704A, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    head.castShadow = true; head.receiveShadow = true;
    monkeyGroup.add(head);
    const earGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const earMat = new THREE.MeshStandardMaterial({ color: 0xD4956B, roughness: 0.5 });
    const earL2 = new THREE.Mesh(earGeo, earMat);
    earL2.position.set(-0.25, 1.65, 0);
    monkeyGroup.add(earL2);
    const earR2 = new THREE.Mesh(earGeo, earMat);
    earR2.position.set(0.25, 1.65, 0);
    monkeyGroup.add(earR2);
    const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL3 = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL3.position.set(-0.1, 1.6, 0.25);
    monkeyGroup.add(eyeL3);
    const eyeR3 = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR3.position.set(0.1, 1.6, 0.25);
    monkeyGroup.add(eyeR3);
    const noseGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x4A2A1A, roughness: 0.4 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 1.52, 0.28);
    monkeyGroup.add(nose);
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.5, 6);
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x8B5A3C, roughness: 0.6 });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(0, 0.5, -0.35);
    tail.rotation.x = 0.6;
    monkeyGroup.add(tail);
    monkeyGroup.position.set(x, y, z);
    monkeyGroup.userData = {
        homeX: x, homeY: y, homeZ: z, bananaGroup: bananaGroup,
        targetX: x, targetZ: z, speed: 0.25, attackRange: 1.5, chaseRange: 10,
        homeRange: 15, health: 50, maxHealth: 50, isDead: false, deathTime: 0
    };
    gameplayGroup.add(monkeyGroup);
    obstacles.push(monkeyGroup);
    monkeys.push(monkeyGroup);
    return monkeyGroup;
}

createMonkey(175, 25.3, 140);
createMonkey(168, 25.3, 130);
createMonkey(182, 25.3, 150);

const monkeyHealthBarContainer = document.createElement('div');
monkeyHealthBarContainer.id = 'monkey-health-container';
monkeyHealthBarContainer.style.cssText = 'display:none; position:absolute; top:55px; left:15px; z-index:5; width:180px; height:15px; background:rgba(0,0,0,0.6); border-radius:7px; border:1px solid white; overflow:hidden;';
monkeyHealthBarContainer.innerHTML = '<div id="monkey-health-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #f44336, #ff5722); transition:width 0.2s;"></div><div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:10px; text-shadow:0 1px 2px black;" id="monkey-health-text">50/50</div>';
document.body.appendChild(monkeyHealthBarContainer);

let keyMesh = null;
function createKey(x, y, z) {
    const group = new THREE.Group();
    const goldKeyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2, metalness: 0.9, emissive: 0x886600, emissiveIntensity: 0.5 });
    const ringGeo = new THREE.TorusGeometry(0.2, 0.06, 8, 16);
    const ring = new THREE.Mesh(ringGeo, goldKeyMat);
    ring.position.y = 0.6;
    group.add(ring);
    const bodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
    const body = new THREE.Mesh(bodyGeo, goldKeyMat);
    body.position.y = 0.15;
    group.add(body);
    for (let i = 0; i < 2; i++) {
        const toothGeo = new THREE.BoxGeometry(0.1, 0.08, 0.08);
        const tooth = new THREE.Mesh(toothGeo, goldKeyMat);
        tooth.position.set(0.08, 0.0 + i * 0.15, 0);
        group.add(tooth);
    }
    group.position.set(x, y, z);
    group.visible = false;
    gameplayGroup.add(group);
    keyMesh = group;
    return group;
}

const bodyMatRabbit = new THREE.MeshStandardMaterial({ color: 0xffffff });
const otherBodyMatRabbit = new THREE.MeshStandardMaterial({ color: 0xddf0ff });
const noseMatRabbit = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
const eyeMatRabbit = new THREE.MeshBasicMaterial({ color: 0x333333 });

function createRabbitModel(isLocal = false) {
    const group = new THREE.Group(); const visualGroup = new THREE.Group(); group.add(visualGroup);
    const currentMat = isLocal ? bodyMatRabbit : otherBodyMatRabbit;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.75), currentMat);
    body.position.y = 0.4; body.castShadow = true; visualGroup.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), currentMat);
    head.position.y = 0.95; head.position.z = 0.1; head.castShadow = true; visualGroup.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), noseMatRabbit);
    nose.position.y = -0.05; nose.position.z = 0.33; head.add(nose);
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMatRabbit); eyeL.position.set(-0.18, 0.1, 0.25); head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMatRabbit); eyeR.position.set(0.18, 0.1, 0.25); head.add(eyeR);
    const earGeo = new THREE.BoxGeometry(0.12, 0.55, 0.06);
    const earL = new THREE.Mesh(earGeo, currentMat); earL.position.set(-0.16, 0.45, -0.05); head.add(earL);
    const earR = new THREE.Mesh(earGeo, currentMat); earR.position.set(0.16, 0.45, -0.05); head.add(earR);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), currentMat);
    tail.position.set(0, 0.25, -0.4); visualGroup.add(tail);
    const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.34);
    const footMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const fFL = new THREE.Mesh(footGeo, footMat); fFL.position.set(-0.32, 0.08, 0.22); group.add(fFL);
    const fFR = new THREE.Mesh(footGeo, footMat); fFR.position.set(0.32, 0.08, 0.22); group.add(fFR);
    const fBL = new THREE.Mesh(footGeo, footMat); fBL.position.set(-0.32, -0.08, -0.22); group.add(fBL);
    const fBR = new THREE.Mesh(footGeo, footMat); fBR.position.set(0.32, -0.08, -0.22); group.add(fBR);
    return { mesh: group, visual: visualGroup, head: head, feet: [fFL, fFR, fBL, fBR] };
}

function createCage(x, z) {
    const group = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.3 });
    const floorGeo = new THREE.BoxGeometry(3, 0.2, 3);
    const floor = new THREE.Mesh(floorGeo, barMat);
    floor.position.y = 0.1;
    floor.receiveShadow = true;
    group.add(floor);
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(Math.cos(angle) * 1.3, 1.7, Math.sin(angle) * 1.3);
        bar.castShadow = true;
        group.add(bar);
    }
    const bottomRingGeo = new THREE.TorusGeometry(1.3, 0.08, 8, 16);
    const bottomRing = new THREE.Mesh(bottomRingGeo, barMat);
    bottomRing.rotation.x = Math.PI / 2;
    bottomRing.position.y = 0.3;
    group.add(bottomRing);
    const roofGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.15, 8);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xaa8866, roughness: 0.7 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 3.25;
    roof.castShadow = true;
    group.add(roof);
    const lockGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const lockMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3, emissive: 0x330000, emissiveIntensity: 0.5 });
    const lock = new THREE.Mesh(lockGeo, lockMat);
    lock.position.set(0, 1.8, 1.35);
    lock.name = 'lock';
    group.add(lock);
    const captiveModel = createRabbitModel(true);
    const captiveRabbitMesh = captiveModel.mesh;
    captiveRabbitMesh.position.set(0, 0.5, 0);
    captiveRabbitMesh.scale.set(0.9, 0.9, 0.9);
    group.add(captiveRabbitMesh);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    cageGroup = group;
    cageRabbit = captiveRabbitMesh;
    return group;
}

function createParkourStep(x, z, y, w, d) {
    const geo = new THREE.BoxGeometry(w, 0.5, d);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccc99, roughness: 0.4, metalness: 0.1 });
    const step = new THREE.Mesh(geo, mat);
    step.position.set(x, y, z);
    step.castShadow = true;
    step.receiveShadow = true;
    gameplayGroup.add(step);
    obstacles.push(step);
    return step;
}

const parkourData = [
    {x: 167, z: 124}, {x: 171, z: 124}, {x: 175, z: 124}, {x: 179, z: 124},
    {x: 186, z: 128}, {x: 186, z: 133}, {x: 186, z: 138}, {x: 186, z: 143},
    {x: 179, z: 156}, {x: 175, z: 156}, {x: 171, z: 156}, {x: 167, z: 156},
    {x: 164, z: 143}, {x: 164, z: 138}, {x: 164, z: 133}, {x: 164, z: 128}
];

parkourData.forEach((pos, i) => {
    const y = 0.25 + i * (25 / 16);
    createParkourStep(pos.x, pos.z, y, 3, 3);
});

createKey(180, 25.5, 140);
createCage(190, 150);

createWoodenHouse(-25, -20, 0.2);
createWoodenHouse(20, 15, -0.3);
createWoodenHouse(-25, 25, 0.5);

createBigGrassBlock(30, -25, 8, 8, 8);
createBigGrassBlock(-30, -15, 9, 10, 6);
createBigGrassBlock(30, 25, 10, 8, 7);
createBigGrassBlock(-30, -30, 9, 9, 10);
createBigGrassBlock(25, 0, 8, 8, 6);

createBigTree(-35, -35, 2);
createBigTree(35, -30, 1.8);
createBigTree(-30, 35, 2.2);
createBigTree(35, 35, 2);
createBigTree(-40, 10, 1.8);
createBigTree(40, -10, 2);
createBigTree(-40, -15, 2);
createBigTree(40, 15, 2);
createBigTree(-15, -40, 1.8);
createBigTree(15, 40, 1.8);

createGoldenPortal(0, 40, 200, 80);
createSign(0, 43, "Yağmurlu Orman", Math.PI);
createGoldenPortal(200, 80, 0, 37);
createSign(200, 76, "Geri Dön", 0);

const coordSpan = document.createElement('span');
coordSpan.id = 'coords-display';
coordSpan.style.marginLeft = '15px';
coordSpan.style.color = '#ffeb3b';
document.getElementById('game-info-ui').appendChild(coordSpan);

const localPlayer = createRabbitModel(true);
const rabbit = localPlayer.mesh; const rabbitVisualGroup = localPlayer.visual; const head = localPlayer.head;
const [footFL, footFR, footBL, footBR] = localPlayer.feet;
scene.add(rabbit);

let otherPlayers = {};
let isAttacking = false, attackAnimTime = 0;
let myHealth = 100; const maxHealth = 100;
let inRainforest = false;

function showModButton() { document.getElementById('mod-btn').style.display = 'flex'; }

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
    showModButton();
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
    showModButton();
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

let cameraAngleY = 0, cameraAngleX = 0.4, cameraDistance = 10, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
window.addEventListener('touchstart', (e) => {
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    if (e.touches.length === 1 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jBtn.contains(e.touches[i].target) && !aBtn.contains(e.touches[i].target)) {
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005;
            cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX));
            touchStartX = e.touches[i].clientX;
            touchStartY = e.touches[i].clientY;
            break;
        }
    }
}, { passive: true });

window.addEventListener('touchend', () => { isTurningCamera = false; });

let monkeyAttackCooldown = 0;
function updateAllMonkeys(deltaTime) {
    if (monkeyAttackCooldown > 0) monkeyAttackCooldown -= deltaTime;
    let allDead = monkeys.length > 0;
    monkeys.forEach((monkey) => {
        const ud = monkey.userData;
        const monkeyPos = monkey.position;
        const playerPos = rabbit.position;
        const dist = new THREE.Vector2(monkeyPos.x - playerPos.x, monkeyPos.z - playerPos.z).length();
        const distFromHome = new THREE.Vector2(monkeyPos.x - ud.homeX, monkeyPos.z - ud.homeZ).length();
        if (ud.isDead) {
            if (Date.now() - ud.deathTime > 60000) {
                ud.isDead = false;
                ud.health = ud.maxHealth;
                monkey.visible = true;
                monkey.position.set(ud.homeX, ud.homeY, ud.homeZ);
            }
            return;
        }
        allDead = false;
        if (dist < ud.chaseRange && distFromHome < ud.homeRange) {
            const angle = Math.atan2(playerPos.x - monkeyPos.x, playerPos.z - monkeyPos.z);
            ud.targetX = monkeyPos.x + Math.sin(angle) * ud.speed;
            ud.targetZ = monkeyPos.z + Math.cos(angle) * ud.speed;
            monkey.rotation.y = angle;
            if (dist < ud.attackRange && monkeyAttackCooldown <= 0) {
                monkeyAttackCooldown = 1.5;
                myHealth -= 10;
                updateHealthBar();
                if (myHealth <= 0) { myHealth = 0; die(); }
            }
        } else if (distFromHome > 0.5) {
            const angle = Math.atan2(ud.homeX - monkeyPos.x, ud.homeZ - monkeyPos.z);
            ud.targetX = monkeyPos.x + Math.sin(angle) * ud.speed;
            ud.targetZ = monkeyPos.z + Math.cos(angle) * ud.speed;
            monkey.rotation.y = angle;
        }
        monkey.position.x += (ud.targetX - monkeyPos.x) * 0.1;
        monkey.position.z += (ud.targetZ - monkeyPos.z) * 0.1;
        monkey.position.y = ud.homeY + Math.abs(Math.sin(Date.now() * 0.005 + ud.homeX)) * 0.2;
        if (dist < ud.chaseRange) {
            monkeyHealthBarContainer.style.display = 'block';
            const healthPercent = (ud.health / ud.maxHealth) * 100;
            document.getElementById('monkey-health-fill').style.width = healthPercent + '%';
            document.getElementById('monkey-health-text').innerText = ud.health + '/' + ud.maxHealth;
        }
        if (isAttacking && dist < ud.attackRange + 0.5 && attackAnimTime < 0.2) {
            ud.health -= 25;
            if (ud.health <= 0) {
                ud.health = 0;
                ud.isDead = true;
                ud.deathTime = Date.now();
                monkey.visible = false;
                monkeyHealthBarContainer.style.display = 'none';
            }
        }
    });
    if (allDead && !hasKey && keyMesh) {
        keyMesh.visible = true;
    }
    if (keyMesh && keyMesh.visible && !hasKey) {
        const keyDist = rabbit.position.distanceTo(keyMesh.position);
        if (keyDist < 2.0) {
            hasKey = true;
            keyMesh.visible = false;
            keyMesh.position.set(0, 0, 0);
            keyMesh.scale.set(0.5, 0.5, 0.5);
            rabbit.add(keyMesh);
            keyMesh.position.set(0, 2.0, 0);
            keyMesh.visible = true;
        }
    }
    if (hasKey && cageGroup && !cageOpened) {
        const cageDist = rabbit.position.distanceTo(cageGroup.position);
        if (cageDist < 3.0) {
            cageOpened = true;
            gameplayGroup.remove(cageGroup);
            cageGroup = null;
            cageRabbit = null;
            if (keyMesh) {
                rabbit.remove(keyMesh);
                keyMesh = null;
            }
            hasKey = false;
            showMessage('Pamuk Kurtuldu! 🎉');
        }
    }
}

function showMessage(text) {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:48px; font-weight:bold; text-shadow:0 0 20px gold; z-index:100; pointer-events:none;';
    msg.innerText = text;
    document.body.appendChild(msg);
    setTimeout(() => {
        msg.style.transition = 'opacity 1s';
        msg.style.opacity = '0';
        setTimeout(() => document.body.removeChild(msg), 1000);
    }, 2000);
}

// ===================== IŞIK YANSITMA OYUNU (X:310 Z:100) =====================
const lightGameZone = { x: 310, z: 100 };
let lightGameActive = false, lightGameCompleted = false, hasSecondKey = false, currentLevel = 0, mirrors = [], rayLines = [];
const levels = [
    { sourceAngle: 0, targetPos: { x: 7, z: 0 }, mirrors: [{ x: 3, z: 2, angle: Math.PI/4, fixed: false }] },
    { sourceAngle: Math.PI/4, targetPos: { x: -2, z: 5 }, mirrors: [{ x: 1, z: 1, angle: Math.PI/4, fixed: false }, { x: 4, z: 3, angle: -Math.PI/4, fixed: false }] },
    { sourceAngle: Math.PI/2, targetPos: { x: 0, z: -4 }, mirrors: [{ x: 2, z: -1, angle: Math.PI/4, fixed: true }, { x: -1, z: 2, angle: -Math.PI/4, fixed: false }, { x: -3, z: -2, angle: Math.PI/4, fixed: false }] }
];
function createMirrorLight(x, z, angle, fixed) {
    const group = new THREE.Group();
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xffaa66, metalness: 0.9 });
    const surface = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), mirrorMat);
    surface.position.y = 0.2;
    group.add(surface);
    group.position.set(lightGameZone.x + x, 0.2, lightGameZone.z + z);
    group.rotation.y = angle;
    gameplayGroup.add(group);
    if (!fixed) group.userData = { selectable: true };
    return group;
}
function drawRayLight(from, to) {
    const points = [new THREE.Vector3(from.x + lightGameZone.x, 0.4, from.y + lightGameZone.z), new THREE.Vector3(to.x + lightGameZone.x, 0.4, to.y + lightGameZone.z)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xff3366 }));
    gameplayGroup.add(line);
    rayLines.push(line);
}
function updateLaserLight() {
    rayLines.forEach(l => gameplayGroup.remove(l));
    rayLines = [];
    let pos = new THREE.Vector2(0, 0), dir = new THREE.Vector2(Math.sin(levels[currentLevel].sourceAngle), Math.cos(levels[currentLevel].sourceAngle));
    const target = new THREE.Vector2(levels[currentLevel].targetPos.x, levels[currentLevel].targetPos.z);
    for (let b = 0; b < 20; b++) {
        let minT = Infinity, hitMirror = null, hitPoint = null, newDir = null;
        for (let m of mirrors) {
            const mpos = new THREE.Vector2(m.position.x - lightGameZone.x, m.position.z - lightGameZone.z);
            const normal = new THREE.Vector2(Math.sin(m.rotation.y), Math.cos(m.rotation.y));
            const toMirror = new THREE.Vector2(mpos.x - pos.x, mpos.y - pos.y);
            const t = toMirror.dot(normal) / dir.dot(normal);
            if (t > 0.001) {
                const intersect = pos.clone().add(dir.clone().multiplyScalar(t));
                const along = intersect.clone().sub(mpos).dot(new THREE.Vector2(-normal.y, normal.x));
                if (Math.abs(along) < 0.7 && t < minT) {
                    minT = t; hitMirror = m; hitPoint = intersect;
                    const dot = dir.dot(normal);
                    newDir = dir.clone().sub(normal.clone().multiplyScalar(2 * dot)).normalize();
                }
            }
        }
        const toTarget = target.clone().sub(pos);
        const tTarget = toTarget.dot(dir);
        if (tTarget > 0 && tTarget < minT) {
            drawRayLight(pos, pos.clone().add(dir.clone().multiplyScalar(tTarget)));
            if (!lightGameCompleted) {
                if (currentLevel + 1 < levels.length) { currentLevel++; resetLightGame(); initLightLevel(); showMessage(`Seviye ${currentLevel+1}`, 1500); }
                else { lightGameCompleted = true; showMessage("Işık Anahtarı kazanıldı! 🔑", 3000); hasSecondKey = true; const keyReward = new THREE.Mesh(new THREE.TorusGeometry(0.2,0.05,16,32), new THREE.MeshStandardMaterial({color:0xffcc00, metalness:0.9})); keyReward.position.set(0,1.2,0); rabbit.add(keyReward); setTimeout(()=>rabbit.remove(keyReward),8000); }
            }
            return;
        }
        if (hitMirror) { drawRayLight(pos, hitPoint); pos = hitPoint; dir = newDir; }
        else { drawRayLight(pos, pos.clone().add(dir.clone().multiplyScalar(12))); break; }
    }
}
let laserSourceLight = null, laserTargetLight = null;
function initLightLevel() {
    mirrors.forEach(m=>gameplayGroup.remove(m)); mirrors = [];
    if(laserTargetLight) gameplayGroup.remove(laserTargetLight);
    const targetMat = new THREE.MeshStandardMaterial({ color: 0x33ff33, emissive: 0x22ff22 });
    laserTargetLight = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), targetMat);
    laserTargetLight.position.set(lightGameZone.x + levels[currentLevel].targetPos.x, 0.6, lightGameZone.z + levels[currentLevel].targetPos.z);
    gameplayGroup.add(laserTargetLight);
    levels[currentLevel].mirrors.forEach((m,idx)=>{ const mo = createMirrorLight(m.x, m.z, m.angle, m.fixed); mo.userData = { fixed: m.fixed }; mirrors.push(mo); });
    updateLaserLight();
}
function resetLightGame() { mirrors.forEach(m=>gameplayGroup.remove(m)); mirrors = []; rayLines.forEach(l=>gameplayGroup.remove(l)); rayLines = []; if(laserSourceLight) gameplayGroup.remove(laserSourceLight); if(laserTargetLight) gameplayGroup.remove(laserTargetLight); }
function buildLightPlatform() {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(20,0.5,20), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
    platform.position.set(lightGameZone.x,0,lightGameZone.z); platform.receiveShadow=true;
    gameplayGroup.add(platform);
    const grid = new THREE.GridHelper(20,20,0x88aaff,0x335588); grid.position.set(lightGameZone.x,0.26,lightGameZone.z);
    gameplayGroup.add(grid);
    const srcMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff2200 });
    laserSourceLight = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), srcMat);
    laserSourceLight.position.set(lightGameZone.x,0.6,lightGameZone.z);
    gameplayGroup.add(laserSourceLight);
}
function checkLightProximity() {
    if(lightGameCompleted) return;
    const dist = Math.hypot(rabbit.position.x - lightGameZone.x, rabbit.position.z - lightGameZone.z);
    if(!lightGameActive && dist<5) { lightGameActive=true; currentLevel=0; buildLightPlatform(); initLightLevel(); showMessage("Işık oyunu başladı! Aynalara yaklaşıp E ile döndür.", 3500); }
    else if(lightGameActive && dist>8) { resetLightGame(); lightGameActive=false; }
}
function handleMirrorRotate() {
    if(!lightGameActive) return;
    let closest=null, minD=2.5;
    for(let m of mirrors) if(!m.userData.fixed) { const d = Math.hypot(rabbit.position.x - m.position.x, rabbit.position.z - m.position.z); if(d<minD) { minD=d; closest=m; } }
    if(closest) { closest.rotation.y += Math.PI/4; updateLaserLight(); showMessage("Ayna döndürüldü", 800); }
}
// ==========================================================================

let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    let hasMoved = false;
    
    checkLightProximity();
    updateAllMonkeys(deltaTime);
    
    let finalMoveX = 0, finalMoveZ = 0;
    if (joystickActive) { finalMoveX = moveX; finalMoveZ = moveZ; }
    if (keys['w'] || keys['arrowup']) finalMoveZ = -1;
    if (keys['s'] || keys['arrowdown']) finalMoveZ = 1;
    if (keys['a'] || keys['arrowleft']) finalMoveX = -1;
    if (keys['d'] || keys['arrowright']) finalMoveX = 1;
    document.getElementById('coords-display').innerText = `X:${Math.round(rabbit.position.x)} Y:${Math.round(rabbit.position.y)} Z:${Math.round(rabbit.position.z)}`;
    const modCoordEl = document.getElementById('mod-coords');
    if (modCoordEl && isModerator) modCoordEl.innerText = `X:${Math.round(rabbit.position.x)} Y:${Math.round(rabbit.position.y)} Z:${Math.round(rabbit.position.z)}`;
    const inRFX = rabbit.position.x > rfMinX && rabbit.position.x < rfMaxX;
    const inRFZ = rabbit.position.z > rfMinZ && rabbit.position.z < rfMaxZ;
    inRainforest = inRFX && inRFZ;
    updateRain(inRainforest, rfCenterX, rfCenterZ, rfWidth, rfDepth);
    if (inRainforest) { scene.fog = new THREE.Fog(0x556633, 40, 120); ambientLight.intensity = 0.4; }
    else { scene.fog = new THREE.Fog(0x87CEEB, 120, 400); ambientLight.intensity = 0.7; }
    if (gameActive && !isDead) {
        const now = Date.now() / 1000;
        for (let i = 0; i < portals.length; i++) {
            const p = portals[i];
            const dist = new THREE.Vector2(rabbit.position.x - p.mesh.position.x, rabbit.position.z - p.mesh.position.z).length();
            if (dist < 2.5 && (now - lastTeleportTime > teleportCooldown)) {
                lastTeleportTime = now;
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
        if (Math.abs(finalMoveX) > 0.05 || Math.abs(finalMoveZ) > 0.05) {
            const fx = Math.sin(cameraAngleY), fz = Math.cos(cameraAngleY);
            const rx = Math.sin(cameraAngleY + Math.PI / 2), rz = Math.cos(cameraAngleY + Math.PI / 2);
            const dx = (fx * -finalMoveZ) - (rx * finalMoveX);
            const dz = (fz * -finalMoveZ) - (rz * finalMoveX);
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