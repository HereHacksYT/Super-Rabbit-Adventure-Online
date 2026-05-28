const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Bütün dosyalar aynı yerde olduğu için doğrudan bulunduğumuz klasörü servis ediyoruz
app.use(express.static(__dirname));

// Ana sayfaya girildiğinde direkt yanındaki index.html'i açmasını söylüyoruz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// MULTIPLAYER (ONLINE) OYUNCU LİSTESİ
let players = {};

io.on('connection', (socket) => {
    console.log('Yeni bir oyuncu bağlandı! ID:', socket.id);

    // Yeni gelen oyuncunun başlangıç verileri
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        z: 0,
        ry: 0,
        isAttacking: false
    };

    // Yeni gelene mevcut herkesi gönder
    socket.emit('currentPlayers', players);

    // Diğerlerine yeni birinin geldiğini bildir
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Hareket verilerini senkronize et
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].ry = movementData.ry;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Kafa atma animasyonunu senkronize et
    socket.on('playerAttack', () => {
        if (players[socket.id]) {
            socket.broadcast.emit('playerAttacked', socket.id);
        }
    });

    // Çıkış işlemi
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı! ID:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda sorunsuz başladı!`);
});
