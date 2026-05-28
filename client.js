// client.js - TAM VE GÜNCEL KOD (KALİTELİ TAVŞAN VE YATAY MOD SAKİTİ)

// 1. ONLINE SUNUCU BAĞLANTISI
const socket = io();

socket.on('connect', () => {
    console.log('Sunucuya online olarak bağlanıldı! ID:', socket.id);
});

// 2. 3D SAHNE VE KAMERA AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); // Gökyüzü rengi

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 3. RENDERER (EKRANA ÇİZİCİ) AYARI
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Çözünürlük netliği için
renderer.shadowMap.enabled = true; // Gölgeleri aktif et
document.getElementById('canvas-container').appendChild(renderer.domElement);

// OYUNU YATAY MODA ZORLAMAK İÇİN TAM EKRAN KONTROLÜ
function enterFullScreen() {
    const doc = document.documentElement;
    if (doc.requestFullscreen) doc.requestFullscreen();
    else if (doc.mozRequestFullScreen) doc.mozRequestFullScreen();
    else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
    else if (doc.msRequestFullscreen) doc.msRequestFullscreen();
}
// Ekranın dikey kalmasını engellemek için dokunmayı bekleyelim
document.addEventListener('touchstart', enterFullScreen, { once: true });

// 4. IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Genel yumuşak ışık
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); // Güneş ışığı
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// 5. OYUN ZEMİNİ
const floorGeometry = new THREE.PlaneGeometry(60, 60);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); // Yeşil çimen
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Yere ser
floor.receiveShadow = true; // Gölgeleri kabul et
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
    
    // Çarpışmaları hesaplamak için her kutunun sınır alanını oluşturuyoruz
    mesh.geometry.computeBoundingBox();
    obstacles.push(mesh); // Fizik kontrolü için listeye ekle
}

// Renkli kutular yerinde kalıyor
createCube(5, 1, -8, 2, 2, 2, 0xff9800);   
createCube(-7, 0.5, -3, 3, 1, 3, 0x00bcd4); 
createCube(0, 1.5, -15, 4, 3, 4, 0x9c27b0); 
createCube(8, 0.5, 6, 2, 1, 2, 0xffeb3b);   

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

// 6. ANA KARAKTER: DETAYLI BLOK TAVŞAN YAPIMI (Eski Kırmızı Küp Tamamen Silindi)
const rabbit = new THREE.Group(); // Tüm parçaları bu grupta toplayacağız
rabbit.position.set(0, 0.5, 0); // Başlangıç noktası
scene.add(rabbit);

// Tavşan materyalleri (Low-poly estetiği)
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); // Beyaz kürk
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa }); // Pembe burun
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });   // Koyu gözler

// --- Tavşan Parçaları ---
// Gövde (Biraz daha tombul bir blok)
const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.8), bodyMat);
body.position.y = 0.5; // Ayakların üstünde dursun
body.castShadow = true;
rabbit.add(body);

// Kafa (Küp şeklinde ama şirin)
const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), bodyMat);
head.position.y = 1.2; // Gövdenin üstü
head.position.z = 0.1; // Hafif öne doğru
head.castShadow = true;
rabbit.add(head);

// Burun (Küçük pembe küp)
const nose = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), noseMat);
nose.position.y = 1.15; // Kafanın ön altı
nose.position.z = 0.45; // Kafanın tam önü
head.add(nose); // Kafaya bağla

// Gözler (İki küçük blocky göz)
const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.2, 0.1, 0.3); // Kafa içinde pozisyon
head.add(eyeL);

const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
eyeR.position.set(0.2, 0.1, 0.3);
head.add(eyeR);

// Kulaklar (Uzun ve blocky)
const earGeo = new THREE.BoxGeometry(0.18, 0.7, 0.1);
const earL = new THREE.Mesh(earGeo, bodyMat);
earL.position.set(-0.2, 0.5, -0.1); // Kafa üstünde sol
head.add(earL);

const earR = new THREE.Mesh(earGeo, bodyMat);
earR.position.set(0.2, 0.5, -0.1); // Kafa üstünde sağ
head.add(earR);

// Kuyruk (Şirin blocky kuyruk)
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), bodyMat);
tail.position.set(0, 0.3, -0.5); // Gövdenin arkası
rabbit.add(tail);

// Ayaklar (Dört küçük blocky ayak)
const footGeo = new THREE.BoxGeometry(0.25, 0.2, 0.4);
const footMat = new THREE.MeshStandardMaterial({ color: 0xdddddd }); // Hafif gri
const createFoot = (x, z) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x, 0.1, z); // Tam yerde
    foot.castShadow = true;
    rabbit.add(foot);
    return foot;
};
const footFL = createFoot(-0.3, 0.3); // Ön sol
const footFR = createFoot(0.3, 0.3);  // Ön sağ
const footBL = createFoot(-0.3, -0.3); // Arka sol
const footBR = createFoot(0.3, -0.3);  // Arka sağ

// VURMA EFEKTİ (Karakterin önünde açılan kırmızı daire)
const attackGeometry = new THREE.RingGeometry(0.2, 0.8, 16);
const attackMaterial = new THREE.MeshBasicMaterial({ color: 0xff1111, transparent: true, opacity: 0, side: THREE.DoubleSide });
const attackEffect = new THREE.Mesh(attackGeometry, attackMaterial);
scene.add(attackEffect);
attackEffect.rotation.x = Math.PI / 2; // Yere ser

let isAttacking = false;
let attackAnimTime = 0;

// ÇARPIŞMA KONTROLÜ
function checkCollision(newX, newY, newZ) {
    // Tavşan grubunun sınırlarına göre sanal bir kutu oluşturuyoruz
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.5, newY - 0.5, newZ - 0.5),
        new THREE.Vector3(newX + 0.5, newY + 0.5, newZ + 0.5)
    );
    // Haritadaki tüm blokları tek tek kontrol et
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) return true; // Çarpışma var!
    }
    return false; // Çarpışma yoksa yürümeye izin ver
}

// HAREKET DEĞİŞKENLERİ
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

// KAMERA ÇEVİRME SİSTEMİ
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
}, { passive: true });

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
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) isTurningCamera = false;
});

// ZIPLAMA VE VURMA FONKSİYONLARI
function executeJump() {
    // SADECE YERDEYKEN VEYA İLK ZIPLAMADAYKEN İZİN VER (Düzeltildi)
    if (jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
    }
}

function executeAttack() {
    if (!isAttacking) {
        isAttacking = true;
        attackAnimTime = 0; // Efekt animasyonunu başlat
        const distToDummy = rabbit.position.distanceTo(dummy.position);
        if (distToDummy < 2.5) { // 2.5 birimden yakınsa
            swayDummy(); // Dummy'nin sallanmasını tetikle
        }
    }
}

const jumpButton = document.getElementById('jump-button');
const attackButton = document.getElementById('attack-button');

// Mobil dokunmatik ekranlar için çift tıklama engelleme
jumpButton.addEventListener('touchend', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('touchend', (e) => { e.preventDefault(); executeAttack(); });

// Tıklama olayını da garantiye alalım (Ne olur ne olmaz)
jumpButton.addEventListener('click', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('click', (e) => { e.preventDefault(); executeAttack(); });

// 8. OYUN DÖNGÜSÜ (GÜNCELLENDİ)
const speed = 0.15;
const cameraDistance = 8, cameraHeight = 5;    

function animate() {
    requestAnimationFrame(animate);

    // HAREKET (Duvarlardan geçemez, tırmanabilir)
    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
        const directionX = (forwardX * -moveZ) - (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) - (rightZ * moveX);
        
        const nextX = rabbit.position.x + directionX * speed;
        const nextZ = rabbit.position.z + directionZ * speed;
        
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
        
        // Tavşanı gidiş yönüne döndür
        rabbit.rotation.y = Math.atan2(directionX, directionZ);
    }

    // HIT ANİMASYONU (GÜNCELLENDİ: Tavşanın önüne yerleştirildi)
    if (isAttacking) {
        attackAnimTime += 0.15;
        // Efekti karakterin tam önüne (1.0 birim) yerleştir
        const attackOffsetX = Math.sin(rabbit.rotation.y) * 1.0;
        const attackOffsetZ = Math.cos(rabbit.rotation.y) * 1.0;
        
        attackEffect.position.set(rabbit.position.x + attackOffsetX, rabbit.position.y - 0.4, rabbit.position.z + attackOffsetZ);
        attackEffect.scale.set(attackAnimTime, attackAnimTime, attackAnimTime); // Genişle

        // Efekti görünür yap (Sönümlenerek kaybolma)
        const opacity = Math.max(0, 1 - (attackAnimTime / 2));
        attackMaterial.opacity = opacity;

        if (attackAnimTime >= 2.0) { // Efekt süresi bitti
            isAttacking = false;
            attackMaterial.opacity = 0;
        }
    }

    // DUMMY ANİMASYONU (Mevcut)
    if (isDummyHit) {
        dummySwayTime += 0.12;
        // Z ekseninde sönümlenen sinüs dalgası hareketi
        dummySwayAngle = Math.sin(dummySwayTime * 2.0) * 5 * Math.pow(0.90, dummySwayTime);
        dummy.rotation.z = dummySwayAngle * (Math.PI / 180);
        if (Math.abs(dummySwayAngle) < 0.02) { // Sallanma bitti
            isDummyHit = false;
            dummy.rotation.z = 0;
        }
    }

    // YERÇEKİMİ VE YER FİZİĞİ (GÜNCELLENDİ: Havadayken zıplama düzeltildi)
    velocityY -= gravity; 
    const nextY = rabbit.position.y + velocityY;
    if (checkCollision(rabbit.position.x, nextY, rabbit.position.z)) {
        if (velocityY < 0) { velocityY = 0; jumpCount = 0; } // Blok üstüne düştüyse zıplama hakkı yenilenir
        else velocityY = -0.02; // Alttan kafayı vurduysa aşağı düşmeye başlasın
    } else rabbit.position.y = nextY;
    
    // Tavşanın çimenlerin altına düşmesini engelle
    if (rabbit.position.y <= 0.5) {
        rabbit.position.y = 0.5;
        velocityY = 0;
        jumpCount = 0; // Çimenlere değdiğinde zıplama hakkı yenilenir
    }

    // KAMERANIN SAKİN TAKİBİ
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