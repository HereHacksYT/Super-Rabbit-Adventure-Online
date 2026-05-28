// client.js - MULTIPLAYER (ONLINE) SİSTEMLİ & GÖRÜNMEZ EFEKTLİ TAVŞAN

const socket = io();

// 3D SAHNE AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); 
renderer.shadowMap.enabled = true; 
document.getElementById('canvas-container').appendChild(renderer.domElement);

function enterFullScreen() {
    const doc = document.documentElement;
    if (doc.requestFullscreen) doc.requestFullscreen();
    else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
}
document.addEventListener('touchstart', enterFullScreen, { once: true });

// IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); 
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
scene.add(dirLight);

// OYUN ZEMİNİ
const floorGeometry = new THREE.PlaneGeometry(60, 60);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// HARİTADAKİ RENKLİ KUTULAR (ENGEL/PLATFORMLAR)
const obstacles = [];
function createCube(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y / 2, z); 
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mesh.geometry.computeBoundingBox();
    obstacles.push(mesh); 
}

createCube(5, 2, -8, 2, 2, 2, 0xff9800);     
createCube(-7, 1, -3, 3, 1, 3, 0x00bcd4);    
createCube(0, 3, -15, 4, 3, 4, 0x9c27b0);    
createCube(8, 1, 6, 2, 1, 2, 0xffeb3b);      

// SALLANAN KUKLA (DUMMY)
const dummyGeometry = new THREE.BoxGeometry(1, 2.5, 1);
const dummyMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22 }); 
const dummy = new THREE.Mesh(dummyGeometry, dummyMaterial);
dummy.position.set(0, 1.25, -5); 
dummy.castShadow = true;
dummy.receiveShadow = true;
dummy.geometry.computeBoundingBox();
scene.add(dummy);
obstacles.push(dummy); 

let isDummyHit = false;
let dummySwayAngle = 0;
let dummySwayTime = 0;

function swayDummy() {
    isDummyHit = true;
    dummySwayTime = 0; 
}

// ORTAK MATERYALLER (Tavşan Tasarımı İçin)
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); 
const otherBodyMat = new THREE.MeshStandardMaterial({ color: 0xddf0ff }); // Online gelen rakipler hafif mavi/gri tonlu olsun ayrışsın diye
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa }); 
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });   

// TAVŞAN MODELİ OLUŞTURUCU FONKSİYON (Hem sen hem diğer oyuncular için)
function createRabbitModel(isLocal = false) {
    const group = new THREE.Group();
    const visualGroup = new THREE.Group();
    group.add(visualGroup);

    const currentMat = isLocal ? bodyMat : otherBodyMat;

    // Gövde
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.75), currentMat);
    body.position.y = 0.4; 
    body.castShadow = true;
    visualGroup.add(body);

    // Kafa
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), currentMat);
    head.position.y = 0.95; 
    head.position.z = 0.1; 
    head.castShadow = true;
    visualGroup.add(head);

    // Burun
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), noseMat);
    nose.position.y = -0.05; 
    nose.position.z = 0.33; 
    head.add(nose); 

    // Gözler
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.18, 0.1, 0.25); 
    head.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.18, 0.1, 0.25);
    head.add(eyeR);

    // Kulaklar
    const earGeo = new THREE.BoxGeometry(0.12, 0.55, 0.06);
    const earL = new THREE.Mesh(earGeo, currentMat);
    earL.position.set(-0.16, 0.45, -0.05); 
    head.add(earL);

    const earR = new THREE.Mesh(earGeo, currentMat);
    earR.position.set(0.16, 0.45, -0.05); 
    head.add(earR);

    // Kuyruk
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), currentMat);
    tail.position.set(0, 0.25, -0.4); 
    visualGroup.add(tail);

    // Büyük Ayaklar
    const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.34); 
    const footMat = new THREE.MeshStandardMaterial({ color: 0xcccccc }); 
    
    const fFL = new THREE.Mesh(footGeo, footMat); fFL.position.set(-0.32, 0.08, 0.22); group.add(fFL);
    const fFR = new THREE.Mesh(footGeo, footMat); fFR.position.set(0.32, 0.08, 0.22); group.add(fFR);
    const fBL = new THREE.Mesh(footGeo, footMat); fBL.position.set(-0.32, -0.08, -0.22); group.add(fBL);
    const fBR = new THREE.Mesh(footGeo, footMat); fBR.position.set(0.32, -0.08, -0.22); group.add(fBR);

    return {
        mesh: group,
        visual: visualGroup,
        head: head,
        feet: [fFL, fFR, fBL, fBR]
    };
}

// ANA KARAKTERİMİZİ OLUŞTURMA
const localPlayer = createRabbitModel(true);
const rabbit = localPlayer.mesh;
const rabbitVisualGroup = localPlayer.visual;
const head = localPlayer.head;
const footFL = localPlayer.feet[0], footFR = localPlayer.feet[1], footBL = localPlayer.feet[2], footBR = localPlayer.feet[3];
scene.add(rabbit);

// ONLINE DİĞER OYUNCULARIN LİSTESİ
let otherPlayers = {};

// --- VURMA EFEKTİ DÜZELTİLDİ (TAMAMEN GÖRÜNMEZ / ÇOK HAFİF ŞEFFAF YAPILDI) ---
const attackGeometry = new THREE.RingGeometry(0.1, 0.4, 16); // Boyutu küçültüldü ve dikey saptırma kaldırıldı
const attackMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000, 
    transparent: true, 
    opacity: 0.0, // İstediğin gibi tamamen görünmez yapıldı! (Görmek istersen 0.1 yapabilirsin)
    side: THREE.DoubleSide 
});
const attackEffect = new THREE.Mesh(attackGeometry, attackMaterial);
scene.add(attackEffect);
attackEffect.rotation.x = Math.PI / 2; 

let isAttacking = false;
let attackAnimTime = 0;

// ÇARPIŞMA FİZİĞİ
function checkCollision(newX, newY, newZ) {
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.35, newY + 0.1, newZ - 0.4), 
        new THREE.Vector3(newX + 0.35, newY + 1.1, newZ + 0.4)
    );
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (newY >= obstacleBox.max.y - 0.15) continue; 
            return true; 
        }
    }
    return false; 
}

// PLATFORM YÜKSEKLİK BULUCU
function getPlatformY(x, z) {
    let highestPlatformY = 0;
    const playerBox = new THREE.Box3(
        new THREE.Vector3(x - 0.3, -100, z - 0.3),
        new THREE.Vector3(x + 0.3, 100, z + 0.3)
    );
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.min.x < obstacleBox.max.x && playerBox.max.x > obstacleBox.min.x &&
            playerBox.min.z < obstacleBox.max.z && playerBox.max.z > obstacleBox.min.z) {
            if (obstacleBox.max.y > highestPlatformY) {
                highestPlatformY = obstacleBox.max.y;
            }
        }
    }
    return highestPlatformY; 
}

// HAREKET DEĞİŞKENLERİ
let velocityY = 0;
let jumpCount = 0;
const gravity = 0.014;
const jumpForce = 0.32; 

// JOYSTICK SİSTEMİ
const zone = document.getElementById('joystick-zone');
const stick = document.getElementById('joystick-stick');
const maxRadius = 35; 

let joystickActive = false;
let moveX = 0, moveZ = 0;

zone.addEventListener('touchstart', (e) => {
    joystickActive = true;
    handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (joystickActive) {
        for (let i = 0; i < e.touches.length; i++) {
            if (zone.contains(e.touches[i].target)) {
                handleJoystick(e.touches[i].clientX, e.touches[i].clientY);
                break;
            }
        }
    }
}, { passive: true });

zone.addEventListener('touchend', () => {
    joystickActive = false;
    stick.style.transform = 'translate(0px, 0px)';
    moveX = 0; moveZ = 0;
});

function handleJoystick(clientX, clientY) {
    const zoneRect = zone.getBoundingClientRect();
    const centerX = zoneRect.left + zoneRect.width / 2;
    const centerY = zoneRect.top + zoneRect.height / 2;
    let deltaX = clientX - centerX, deltaY = clientY - centerY;
    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
    }
    stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    moveX = deltaX / maxRadius; moveZ = deltaY / maxRadius;
}

// KAMERA DÖNDÜRME VE PINCH ZOOM SİSTEMİ
let cameraAngleY = 0; 
let cameraAngleX = 0.4; 
let cameraDistance = 7.5; 
let touchStartX = 0, touchStartY = 0;
let startTouchDistance = 0; 
let isTurningCamera = false;
let isZooming = false;

window.addEventListener('touchstart', (e) => {
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    
    if (e.touches.length === 2 && !zone.contains(e.target) && !jumpBtn.contains(e.target) && !attackBtn.contains(e.target)) {
        isZooming = true;
        isTurningCamera = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startTouchDistance = Math.sqrt(dx * dx + dy * dy);
        return;
    }

    if (e.touches.length === 1 && !zone.contains(e.target) && !jumpBtn.contains(e.target) && !attackBtn.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY; 
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (isZooming && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const distanceDelta = startTouchDistance - currentDistance;
        cameraDistance += distanceDelta * 0.03; 
        cameraDistance = Math.max(3.0, Math.min(15.0, cameraDistance)); 
        startTouchDistance = currentDistance;
        return;
    }

    if (!isTurningCamera) return;
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jumpBtn.contains(e.touches[i].target) && !attackBtn.contains(e.touches[i].target)) {
            let deltaX = e.touches[i].clientX - touchStartX;
            let deltaY = e.touches[i].clientY - touchStartY;
            
            cameraAngleY -= deltaX * 0.005; 
            cameraAngleX += deltaY * 0.005; 
            cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX)); 
            
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            break;
        }
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) isZooming = false;
    if (e.touches.length === 0) isTurningCamera = false;
});

// ZIPLAMA VE VURMA TETİKLEYİCİLERİ
function executeJump() {
    if (jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
    }
}

function executeAttack() {
    if (!isAttacking) {
        isAttacking = true;
        attackAnimTime = 0; 
        
        // Sunucuya kafa attığımızı bildiriyoruz!
        socket.emit('playerAttack');

        const distToDummy = rabbit.position.distanceTo(dummy.position);
        if (distToDummy < 2.5) { 
            swayDummy(); 
        }
    }
}

const jumpButton = document.getElementById('jump-button');
const attackButton = document.getElementById('attack-button');

jumpButton.addEventListener('touchend', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('touchend', (e) => { e.preventDefault(); executeAttack(); });
jumpButton.addEventListener('click', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('click', (e) => { e.preventDefault(); executeAttack(); });

// --- 3. ONLINE (SOCKET.IO) ALICI MOTORLARI ---

// Sunucudaki mevcut oyuncuları yükle
socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id !== socket.id) {
            addOtherPlayer(players[id]);
        }
    });
});

// Oyuna yeni biri girdiğinde onu haritaya ekle
socket.on('newPlayer', (playerInfo) => {
    addOtherPlayer(playerInfo);
});

// Bir oyuncu hareket ettiğinde konumunu güncelle
socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        otherPlayers[playerInfo.id].mesh.rotation.y = playerInfo.ry;
    }
});

// Başka bir oyuncu kafa attığında onun animasyonunu oynat
socket.on('playerAttacked', (id) => {
    if (otherPlayers[id]) {
        otherPlayers[id].isAttacking = true;
        otherPlayers[id].attackAnimTime = 0;
    }
});

// Biri oyundan çıktığında haritadan sil
socket.on('playerDisconnected', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id].mesh);
        delete otherPlayers[id];
    }
});

function addOtherPlayer(playerInfo) {
    const modelData = createRabbitModel(false);
    modelData.mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    modelData.mesh.rotation.y = playerInfo.ry;
    scene.add(modelData.mesh);
    
    otherPlayers[playerInfo.id] = {
        mesh: modelData.mesh,
        visual: modelData.visual,
        head: modelData.head,
        isAttacking: false,
        attackAnimTime: 0
    };
}

// 8. OYUN DÖNGÜSÜ VE ANİMASYONLAR
const speed = 0.15;
let legWiggle = 0;

function animate() {
    requestAnimationFrame(animate);

    let hasMoved = false;

    // JOYSTICK HAREKET MOTORU
    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
        const directionX = (forwardX * -moveZ) - (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) - (rightZ * moveX);
        
        const nextX = rabbit.position.x + directionX * speed;
        const nextZ = rabbit.position.z + directionZ * speed;
        
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
        
        rabbit.rotation.y = Math.atan2(directionX, directionZ);
        hasMoved = true;

        if (jumpCount === 0 && !isAttacking) { 
            legWiggle += 0.25;
            footFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
            footBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        }
    } else {
        if (jumpCount === 0 && !isAttacking) {
            footFL.position.y = 0.08; footFR.position.y = 0.08;
            footBL.position.y = 0.08; footBR.position.y = 0.08;
        }
    }

    // LOCAL PLAYER KAFA ATMA ANİMASYONU
    if (isAttacking) {
        attackAnimTime += 0.2; 
        const headButtFactor = Math.sin(attackAnimTime * Math.PI); 

        if (attackAnimTime <= 1.0) {
            rabbitVisualGroup.position.z = headButtFactor * 0.5; 
            head.position.z = 0.1 + headButtFactor * 0.25;      
            head.rotation.x = headButtFactor * 0.4;             
            
            const attackOffsetX = Math.sin(rabbit.rotation.y) * (1.0 + rabbitVisualGroup.position.z);
            const attackOffsetZ = Math.cos(rabbit.rotation.y) * (1.0 + rabbitVisualGroup.position.z);
            attackEffect.position.set(rabbit.position.x + attackOffsetX, rabbit.position.y, rabbit.position.z + attackOffsetZ);
            attackEffect.scale.set(attackAnimTime * 1.5, attackAnimTime * 1.5, attackAnimTime * 1.5);
        } else {
            isAttacking = false;
            rabbitVisualGroup.position.z = 0;
            head.position.z = 0.1;
            head.rotation.x = 0;
        }
    }

    // ONLINE GELEN OYUNCULARIN KAFA ATMA ANİMASYONUNU OYNATMA
    Object.keys(otherPlayers).forEach((id) => {
        const p = otherPlayers[id];
        if (p.isAttacking) {
            p.attackAnimTime += 0.2;
            const factor = Math.sin(p.attackAnimTime * Math.PI);
            if (p.attackAnimTime <= 1.0) {
                p.visual.position.z = factor * 0.5;
                p.head.position.z = 0.1 + factor * 0.25;
                p.head.rotation.x = factor * 0.4;
            } else {
                p.isAttacking = false;
                p.visual.position.z = 0;
                p.head.position.z = 0.1;
                p.head.rotation.x = 0;
            }
        }
    });

    // DUMMY SALLANMA
    if (isDummyHit) {
        dummySwayTime += 0.12;
        dummySwayAngle = Math.sin(dummySwayTime * 2.0) * 5 * Math.pow(0.90, dummySwayTime);
        dummy.rotation.z = dummySwayAngle * (Math.PI / 180);
        if (Math.abs(dummySwayAngle) < 0.02) { 
            isDummyHit = false;
            dummy.rotation.z = 0;
        }
    }

    // BLOK ÜSTÜ DURMA VE YERÇEKİMİ FİZİĞİ
    velocityY -= gravity; 
    const potentialNextY = rabbit.position.y + velocityY;
    const targetPlatformY = getPlatformY(rabbit.position.x, rabbit.position.z);
    const finalGroundY = targetPlatformY; 

    if (potentialNextY <= finalGroundY) {
        rabbit.position.y = finalGroundY; 
        if (velocityY < -0.05) {
             rabbitVisualGroup.scale.set(1.15, 0.85, 1.15); 
        }
        velocityY = 0; 
        jumpCount = 0; 
    } else {
        rabbit.position.y = potentialNextY;
        hasMoved = true; // Zıplama/Düşme esnasında da koordinat gönderilmeli
    }
    
    // SUNUCUYA ANLIK VERİ GÖNDERME (Eğer pozisyon değiştiyse)
    if (hasMoved || isAttacking) {
        socket.emit('playerMovement', {
            x: rabbit.position.x,
            y: rabbit.position.y,
            z: rabbit.position.z,
            ry: rabbit.rotation.y
        });
    }

    if (!isAttacking) {
        rabbitVisualGroup.scale.x += (1.0 - rabbitVisualGroup.scale.x) * 0.15;
        rabbitVisualGroup.scale.y += (1.0 - rabbitVisualGroup.scale.y) * 0.15;
        rabbitVisualGroup.scale.z += (1.0 - rabbitVisualGroup.scale.z) * 0.15;
    }

    if (jumpCount > 0) {
        if (velocityY > 0 && !isAttacking) {
            rabbitVisualGroup.scale.set(0.9, 1.15, 0.9); 
        }
        footFL.position.y = 0.15; footFR.position.y = 0.15;
        footBL.position.y = 0.15; footBR.position.y = 0.15;
    }

    // DİKEY VE YATAY HAREKETLİ KAMERA MATEMATİĞİ
    camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    camera.position.y = rabbit.position.y + Math.sin(cameraAngleX) * cameraDistance;
    camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});