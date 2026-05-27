// 1. ONLINE SUNUCU BAĞLANTISI
const socket = io();

socket.on('connect', () => {
    console.log('Sunucuya online olarak bağlanıldı! ID:', socket.id);
});

// 2. 3D SAHNE VE KAMERA AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); // Gökyüzü rengi (Gri/Mavi)

// Kamera açısı (Bakış açısı, ekran oranı, yakınlık, uzaklık)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10); // Kamerayı arkaya ve yukarı alıyoruz
camera.lookAt(0, 0, 0); // Kamera merkeze baksın

// 3. RENDERER (EKRANA ÇİZİCİ) AYARI
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Gölgeleri açıyoruz
document.getElementById('canvas-container').appendChild(renderer.domElement);

// 4. IŞIKLANDIRMA (3D Dünyanın görünmesi için şart)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Genel yumuşak ışık
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); // Güneş ışığı gibi dik ışık
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
scene.add(dirLight);

// 5. OYUN ZEMİNİ (Düzlük/Harita)
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); // Yeşil çimen rengi
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Zemini yatay yapıyoruz
floor.receiveShadow = true;
scene.add(floor);

// 6. ANA KARAKTER (Geçici 3D Küp Tavşan)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Kırmızı renk
const rabbit = new THREE.Mesh(geometry, material);
rabbit.position.y = 0.5; // Zeminin tam üstünde dursun
rabbit.castShadow = true;
scene.add(rabbit);

// 7. EKRAN YENİLEME VE ANİMASYON DÖNGÜSÜ (Oyunun akıcı dönmesi için)
function animate() {
    requestAnimationFrame(animate);

    // Test amaçlı: Karakter kendi etrafında hafifçe dönsün
    rabbit.rotation.y += 0.01;

    // Sahneyi kameradan göründüğü şekliyle çiz
    renderer.render(scene, camera);
}

// Oyunu ve döngüyü başlat
animate();

// 8. EKRAN BOYUTU DEĞİŞTİĞİNDE (Telefon yan çevrildiğinde vb.) AYARLAR
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
