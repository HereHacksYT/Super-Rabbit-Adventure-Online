// client.js - PINCH-TO-ZOOM KAMERA VE KAFA ATMA ANİMASYONU DAHİL SİSTEM

// 1. ONLINE SUNUCU BAĞLANTISI
const socket = io();

socket.on('connect', () => {
    console.log('Sunucuya online olarak bağlanıldı! ID:', socket.id);
});

// 2. 3D SAHNE VE KAMERA AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 3. RENDERER (EKRANA ÇİZİCİ) AYARI
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

// 4. IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); 
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// 5. OYUN ZEMİNİ
const floorGeometry = new THREE.PlaneGeometry(60, 60);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// HARİTADAKİ RENKLİ KUTULAR
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

// SALLANAN DUMMY (KUKLA)
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

// 6. ANA KARAKTER: GÖRÜNÜR AYAKLI İNCE TAVŞAN MODELİ
const rabbit = new THREE.Group();
rabbit.position.set(0, 0, 0); 
scene.add(rabbit);

const rabbitVisualGroup = new THREE.Group();
rabbit.add(rabbitVisualGroup);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); 
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa }); 
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });   

// Gövde
const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.75), bodyMat);
body.position.y = 0.4; 
body.castShadow = true;
rabbitVisualGroup.add(body);

// Kafa
const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bodyMat);
head.position.y = 0.95; 
head.position.z = 0.1; 
head.castShadow = true;
rabbitVisualGroup.add(head);

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
const earL = new THREE.Mesh(earGeo, bodyMat);
earL.position.set(-0.16, 0.45, -0.05); 
head.add(earL);

const earR = new THREE.Mesh(earGeo, bodyMat);
earR.position.set(0.16, 0.45, -0.05); 
head.add(earR);

// Kuyruk
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), bodyMat);
tail.position.set(0, 0.25, -0.4); 
rabbitVisualGroup.add(tail);

// Ayaklar
const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.34); 
const footMat = new THREE.MeshStandardMaterial({ color: 0xdddddd }); 
const createFoot = (x, z) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x, 0.08, z); 
    foot.castShadow = true;
    rabbit.add(foot);
    return foot;
};
const footFL = createFoot(-0.32, 0.22); 
const footFR = createFoot(0.32, 0.22);  
const footBL = createFoot(-0.32, -0.22); 
const footBR = createFoot(0.32, -0.22);  

// VURMA EFEKTİ (Halkası)
const attackGeometry = new THREE.RingGeometry(0.2, 0.8, 16);
const attackMaterial = new THREE.MeshBasicMaterial({ color: 0xff1111, transparent: true, opacity: 0, side: THREE.DoubleSide });
const attackEffect = new THREE.Mesh(attackGeometry, attackMaterial);
scene.add(attackEffect);
attackEffect.rotation.x = Math.PI / 2; 

let isAttacking = false;
let attackAnimTime = 0;

// ÇARPIŞMA (COLLISION) KONTROLÜ
function checkCollision(newX, newY, newZ) {
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.35, newY + 0.1, newZ - 0.4), 
        new THREE.Vector3(newX + 0.35, newY + 1.1, newZ + 0.4)
    );
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (newY >= obstacleBox.max.y - 0.15) {
                continue; 
            }
            return true; 
        }
    }
    return false; 
}

// YÜKSEKLİK BULUCU
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

// JOYSTICK HAREKET SİSTEMİ
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

// --- GÜNCELLENEN KAMERA DÖNDÜRME VE YAKINLAŞTIRMA (ZOOM) SİSTEMİ ---
let cameraAngleY = 0; 
let cameraAngleX = 0.4; 
let cameraDistance = 7.5; // Kamera başlangıç uzaklığı
let touchStartX = 0, touchStartY = 0;
let startTouchDistance = 0; // Pinch zoom için iki parmak arası mesafe takipçisi
let isTurningCamera = false;
let isZooming = false;

window.addEventListener('touchstart', (e) => {
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    
    // EĞER ÇİFT PARMAK VARSA (PINCH-TO-ZOOM BAŞLANGICI)
    if (e.touches.length === 2 && !zone.contains(e.target) && !jumpBtn.contains(e.target) && !attackBtn.contains(e.target)) {
        isZooming = true;
        isTurningCamera = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startTouchDistance = Math.sqrt(dx * dx + dy * dy); // İki parmak arası ilk mesafe
        return;
    }

    // TEK PARMAK VARSA VE BUTONLARDA DEĞİLSE (DÖNDÜRME)
    if (e.touches.length === 1 && !zone.contains(e.target) && !jumpBtn.contains(e.target) && !attackBtn.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY; 
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    // 1. PINCH ZOOM ÇALIŞIYORSA
    if (isZooming && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        const distanceDelta = startTouchDistance - currentDistance;
        cameraDistance += distanceDelta * 0.03; // Yakınlaşma hızı ayarı
        
        // Kamera sınırları: En fazla 3 birim yakınlaşsın, en fazla 15 birim uzaklaşsın
        cameraDistance = Math.max(3.0, Math.min(15.0, cameraDistance)); 
        
        startTouchDistance = currentDistance;
        return;
    }

    // 2. TEK PARMAK ÇEVİRME ÇALIŞIYORSA
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

// 8. OYUN DÖNGÜSÜ VE ANİMASYONLAR
const speed = 0.15;
let legWiggle = 0;

function animate() {
    requestAnimationFrame(animate);

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

        // Ayaklar Yürüme Yaylanması
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

    // --- KAFA ATMA ANİMASYONU MOTORU (GÜNCELLENDİ) ---
    if (isAttacking) {
        attackAnimTime += 0.2; // Kafa atma hızı ayarı

        // Sinüs dalgası ile kafa atma hareketi oluşturma:
        // Önce ileri hızlıca uzayacak, sonra geri çekilecek.
        const headButtFactor = Math.sin(attackAnimTime * Math.PI); 

        if (attackAnimTime <= 1.0) {
            // Görsel grubu (kafa ve gövdeyi) ileri doğru (Z ekseninde) fırlat ve kafayı öne bük
            rabbitVisualGroup.position.z = headButtFactor * 0.5; // İleri uzama miktarı
            head.position.z = 0.1 + headButtFactor * 0.25;      // Kafayı ekstra öne çıkar
            head.rotation.x = headButtFactor * 0.4;             // Kafayı aşağı/öne doğru bük (Kafa Atma)
            
            // Efekt halkasını da kafa atışıyla senkronize şekilde öne koy
            const attackOffsetX = Math.sin(rabbit.rotation.y) * (1.0 + rabbitVisualGroup.position.z);
            const attackOffsetZ = Math.cos(rabbit.rotation.y) * (1.0 + rabbitVisualGroup.position.z);
            attackEffect.position.set(rabbit.position.x + attackOffsetX, rabbit.position.y, rabbit.position.z + attackOffsetZ);
            attackEffect.scale.set(attackAnimTime * 1.5, attackAnimTime * 1.5, attackAnimTime * 1.5);
            attackMaterial.opacity = 1.0 - attackAnimTime;
        } else {
            // Animasyon tamamlandı, her şeyi sıfırla
            isAttacking = false;
            rabbitVisualGroup.position.z = 0;
            head.position.z = 0.1;
            head.rotation.x = 0;
            attackMaterial.opacity = 0;
        }
    }

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
    }
    
    // Ölçek sönümleme (Yalnızca kafa atmıyorken esneklik uygulasın)
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