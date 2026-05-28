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
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(10, 30, 10); dirLight.castShadow = true; scene.add(dirLight);

// --- ASIL OYUN DÜNYASI ---
const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

const floorGeo = new THREE.PlaneGeometry(60, 60);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
gameplayGroup.add(floor);

const obstacles = [];
function createCube(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
    gameplayGroup.add(mesh);
    obstacles.push(mesh);
}
createCube(5, 2, -8, 2, 2, 2, 0xff9800);
createCube(-7, 1, -3, 3, 1, 3, 0x00bcd4);
createCube(0, 3, -15, 4, 3, 4, 0x9c27b0);
createCube(8, 1, 6, 2, 1, 2, 0xffeb3b);

const dummyGeo = new THREE.BoxGeometry(1, 2.5, 1);
const dummyMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 });
const dummy = new THREE.Mesh(dummyGeo, dummyMat);
dummy.position.set(0, 1.25, -5); dummy.castShadow = true;
gameplayGroup.add(dummy);
obstacles.push(dummy);

let isDummyHit = false, dummySwayTime = 0, dummySwayAngle = 0;
function swayDummy() { isDummyHit = true; dummySwayTime = 0; }

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
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (newY >= obstacleBox.max.y - 0.2) continue;
            return true;
        }
    }
    return false;
}

function getFloorY(pX, pY, pZ) {
    gameplayGroup.updateMatrixWorld(true);
    let highestCeil = 0;
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (pX + 0.25 >= obstacleBox.min.x && pX - 0.25 <= obstacleBox.max.x &&
            pZ + 0.25 >= obstacleBox.min.z && pZ - 0.25 <= obstacleBox.max.z) {
            if (pY >= obstacleBox.max.y - 0.4) {
                if (obstacleBox.max.y > highestCeil) highestCeil = obstacleBox.max.y;
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

// Sadece itme, hasar yok
socket.on('knockback', (angle) => {
    if (!gameActive || isDead) return;
    rabbit.position.x += Math.sin(angle) * 2.0;
    rabbit.position.z += Math.cos(angle) * 2.0;
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
        const rabbitWorldPos = new THREE.Vector3(); rabbit.getWorldPosition(rabbitWorldPos);
        const dummyWorldPos = new THREE.Vector3(); dummy.getWorldPosition(dummyWorldPos);
        if (rabbitWorldPos.distanceTo(dummyWorldPos) < 2.5) swayDummy();

        // Diğer oyunculara vurma (sadece itme)
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
        if (isDummyHit) {
            dummySwayTime += 7 * deltaTime; dummySwayAngle = Math.sin(dummySwayTime * 2.0) * 5 * Math.pow(0.90, dummySwayTime); dummy.rotation.z = dummySwayAngle * (Math.PI / 180);
            if (Math.abs(dummySwayAngle) < 0.02) { isDummyHit = false; dummy.rotation.z = 0; }
        }

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