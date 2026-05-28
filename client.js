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
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

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

// HARİTADAKİ RENKLİ KUTULAR (Fizik için)
const obstacles = [];
function createCube(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    mesh.geometry.computeBoundingBox();
    obstacles.push(mesh);
}

createCube(5, 1, -5, 2, 2, 2, 0xff9800);   
createCube(-7, 0.5, -3, 3, 1, 3, 0x00bcd4); 
createCube(0, 1.5, -12, 4, 3, 4, 0x9c27b0); 
createCube(8, 0.5, 6, 2, 1, 2, 0xffeb3b);   

// --- YENİ EKLENEN KISIM: SALLANAN DUMMY (ANTRENMAN KUKLASI) ---
const dummyGeometry = new THREE.BoxGeometry(1.2, 2.5, 1.2);
const dummyMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22 }); // Turuncu
const dummy = new THREE.Mesh(dummyGeometry, dummyMaterial);
dummy.position.set(-8, 1.25, -8); // Haritanın bir köşesine koyalım
dummy.castShadow = true;
dummy.receiveShadow = true;
dummy.geometry.computeBoundingBox();
scene.add(dummy);
obstacles.push(dummy); // Çarpışma fiziği Dummy için de geçerli olsun

let isDummyHit = false;
let dummySwayAngle = 0; // Dummy'nin anlık sallanma açısı
let dummySwayTime = 0;   // Sallanma animasyonunun zamanlayıcısı

// Dummy'ye vurulduğunu tetikleyen fonksiyon
function swayDummy() {
    isDummyHit = true;
    dummySwayTime = 0; // Animasyonu başa sar
}
// -----------------------------------------------------------------

// 6. ANA KARAKTER
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const rabbit = new THREE.Mesh(geometry, material);
rabbit.position.set(0, 0.5, 0);
rabbit.castShadow = true;
scene.add(rabbit);

// Vurma efekti (Karakterin hemen önünde çıkacak kırmızı iz)
const attackGeometry = new THREE.RingGeometry(0.3, 0.8, 16);
const attackMaterial = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0, side: THREE.DoubleSide });
const attackEffect = new THREE.Mesh(attackGeometry, attackMaterial);
scene.add(attackEffect);
attackEffect.rotation.x = Math.PI / 2; // Yere paralel yap

let isAttacking = false;
let attackAnimTime = 0;

// ÇARPIŞMA KONTROL FONKSİYONU
function checkCollision(newX, newY, newZ) {
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.5, newY - 0.5, newZ - 0.5),
        new THREE.Vector3(newX + 0.5, newY + 0.5, newZ + 0.5)
    );

    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) return true; 
    }
    return false;
}

// FİZİK VE YERÇEKİMİ DEĞİŞKENLERİ
let velocityY = 0;
let jumpCount = 0;
const gravity = 0.014;
const jumpForce = 0.32;

// 7. SABİT JOYSTICK HAREKET SİSTEMİ
const zone = document.getElementById('joystick-zone');
const stick = document.getElementById('joystick-stick');
const maxRadius = 35; 

let joystickActive = false;
let moveX = 0, moveZ = 0;

zone.addEventListener('touchstart', (e) => {
    joystickActive = true;
    handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchmove', (e) => {
    if (joystickActive) handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
});
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
        distance = maxRadius;
    }
    stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    moveX = deltaX / maxRadius; moveZ = deltaY / maxRadius;
}

// KAMERA ÇEVİRME VE AKSİYON BUTONLARI KONTROLÜ (GÜNCELLENDİ)
let cameraAngleY = 0; 
let touchStartX = 0;
let isTurningCamera = false;

window.addEventListener('touchstart', (e) => {
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    if (!zone.contains(e.target) && !jumpBtn.contains(e.target) && !attackBtn.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
    }
});

window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jumpBtn.contains(e.touches[i].target) && !attackBtn.contains(e.touches[i].target)) {
            let deltaX = e.touches[i].clientX - touchStartX;
            cameraAngleY -= deltaX * 0.005; 
            touchStartX = e.touches[i].clientX;
            break;
        }
    }
});
window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) isTurningCamera = false;
});

// AKSİYON BUTONLARININ TETİKLEYİCİLERİ
function executeJump() {
    if (jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
    }
}

// YENİ: VURMA (HIT) FONKSİYONU
function executeAttack() {
    if (!isAttacking) {
        isAttacking = true;
        attackAnimTime = 0; // Efekt animasyonunu başlat
        
        // Dummy'ye vurma kontrolü (Yakınlık testi)
        const distToDummy = rabbit.position.distanceTo(dummy.position);
        if (distToDummy < 3) { // 3 birimden daha yakınsa vurabilir
            swayDummy(); // Dummy'nin sallanmasını tetikle
        }
    }
}

const jumpButton = document.getElementById('jump-button');
const attackButton = document.getElementById('attack-button');

jumpButton.addEventListener('touchstart', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('touchstart', (e) => { e.preventDefault(); executeAttack(); });

// 8. EKRAN YENİLEME VE ANİMASYON DÖNGÜSÜ
const speed = 0.15;
const cameraDistance = 10, cameraHeight = 6;    

function animate() {
    requestAnimationFrame(animate);

    // YÜRÜME
    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
        const directionX = (forwardX * -moveZ) - (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) - (rightZ * moveX);
        const nextX = rabbit.position.x + directionX * speed, nextZ = rabbit.position.z + directionZ * speed;
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
        rabbit.rotation.y = Math.atan2(directionX, directionZ);
    }

    // VURMA EFEKTİ ANİMASYONU VE DUMMY SALLANMA MATEMATİĞİ (YENİ)
    if (isAttacking) {
        attackAnimTime += 0.1; // Animasyon hızı
        
        // Efekti karakterin baktığı yönde 1.2 birim önüne yerleştir
        const attackOffsetX = Math.sin(rabbit.rotation.y) * 1.2;
        const attackOffsetZ = Math.cos(rabbit.rotation.y) * 1.2;
        attackEffect.position.set(rabbit.position.x + attackOffsetX, rabbit.position.y, rabbit.position.z + attackOffsetZ);
        attackEffect.scale.set(attackAnimTime, attackAnimTime, attackAnimTime); // Genişle

        // Efekti görünür yap (Sönümlenerek kaybolma)
        const opacity = Math.max(0, 1 - (attackAnimTime / 2));
        attackMaterial.opacity = opacity;

        if (attackAnimTime >= 2.2) { // Efekt süresi bitti
            isAttacking = false;
            attackMaterial.opacity = 0;
        }
    }

    // Dummy'nin Sallanma Matematiği
    if (isDummyHit) {
        dummySwayTime += 0.1;
        
        // Zamanla sönümlenen bir sinüs dalgası: dummySwayTime arttıkça genlik (4) azalır (* 0.95^t)
        dummySwayAngle = Math.sin(dummySwayTime * 1.5) * 4 * Math.pow(0.92, dummySwayTime);
        
        // Dummy'nin dönüş eksenini ayarla (Z ekseninde sağa-sola sallanma)
        dummy.rotation.z = dummySwayAngle * (Math.PI / 180); // Dereceden radyana çevir

        if (Math.abs(dummySwayAngle) < 0.01) { // Sallanma bitti
            isDummyHit = false;
            dummy.rotation.z = 0; // Düzelt
        }
    }
    // -------------------------------------------------------------

    // YERÇEKİMİ VE DÜŞEY ÇARPIŞMA (Mevcut kodlar tıkır tıkır devam)
    velocityY -= gravity; 
    const nextY = rabbit.position.y + velocityY;
    if (checkCollision(rabbit.position.x, nextY, rabbit.position.z)) {
        if (velocityY < 0) { velocityY = 0; jumpCount = 0; } 
        else velocityY = -0.02;
    } else rabbit.position.y = nextY;
    if (rabbit.position.y <= 0.5) { rabbit.position.y = 0.5; velocityY = 0; jumpCount = 0; }

    // KAMERANIN TAKİBİ
    camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * cameraDistance;
    camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * cameraDistance;
    camera.position.y = rabbit.position.y + cameraHeight;
    camera.lookAt(rabbit.position);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});