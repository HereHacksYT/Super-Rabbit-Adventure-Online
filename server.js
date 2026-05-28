const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// "Cannot GET" hatasını çözmek için public klasörünün yolunu garantiye alıyoruz
app.use(express.static(path.join(__dirname)))); 
app.use(express.static(path.join(__dirname, 'public')));

// Eğer doğrudan ana dizine (/) istek atılırsa index.html dosyasını zorla gönder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            // Eğer index.html public klasörünün içindeyse orayı dener:
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });
});

// Bağlı olan tüm online oyuncuları tutan liste
let players = {};

io.on('connection', (socket) => {
    console.log('Yeni bir oyuncu bağlandı! ID:', socket.id);

    // Yeni gelen oyuncuya başlangıç pozisyonu ver ve listeye ekle
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        z: 0,
        ry: 0,
        isAttacking: false
    };

    // Yeni bağlanan oyuncuya mevcut tüm oyuncuları gönder
    socket.emit('currentPlayers', players);

    // Diğer tüm oyunculara yeni birinin geldiğini haber ver
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Oyuncu hareket ettiğinde konumunu güncelle ve herkese yayınla
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].ry = movementData.ry;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Oyuncu kafa attığında diğerlerine haber ver
    socket.on('playerAttack', () => {
        if (players[socket.id]) {
            socket.broadcast.emit('playerAttacked', socket.id);
        }
    });

    // Oyuncu oyundan çıktığında listeden sil ve herkese bildir
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı! ID:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda online!`);
});
