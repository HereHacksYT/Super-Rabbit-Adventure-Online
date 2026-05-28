// 7. EKRAN YENİLEME VE ANİMASYON DÖNGÜSÜ
const speed = 0.15; // Tavşanın yürüme hızı

function animate() {
    requestAnimationFrame(animate);

    // Joystick hareket ediyorsa küpü çimenlerin üzerinde yürüt
    if (joystickActive) {
        rabbit.position.x += moveX * speed;
        rabbit.position.z += moveZ * speed;
        
        // Karakter hareket ettiği yöne doğru hafifçe baksın
        rabbit.rotation.y = Math.atan2(-moveX, -moveZ);
    }

    // --- YENİ EKLENEN KAMERA TAKİP SİSTEMİ ---
    // Kamera her zaman tavşanın 10 birim arkasında (z) ve 7 birim yukarısında (y) kalsın
    camera.position.x = rabbit.position.x;
    camera.position.y = rabbit.position.y + 7;
    camera.position.z = rabbit.position.z + 10;

    // Kamera her zaman tavşanın olduğu merkeze baksın
    camera.lookAt(rabbit.position);
    // -----------------------------------------

    renderer.render(scene, camera);
}

animate();
