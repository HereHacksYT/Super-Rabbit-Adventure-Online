const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Odaları ve o odadaki oyuncuları tutan büyük hafıza
let rooms = {}; 

io.on('connection', (socket) => {
    let currentRoom = null;

    // 1. ODA OLUŞTURMA İŞLEMİ
    socket.on('createRoom', () => {
        // Rastgele 5 harfli oda kodu üret (Örn: ABCDE)
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = {};
        
        currentRoom = roomCode;
        socket.join(roomCode);
        
        // Oluşturan oyuncuyu ekle
        rooms[roomCode][socket.id] = { id: socket.id, x: 0, y: 0, z: 0, ry: 0, isAttacking: false };
        
        socket.emit('roomJoined', { roomCode: roomCode, players: rooms[roomCode] });
    });

    // 2. ODAYA KATILMA İŞLEMİ
    socket.on('joinRoom', (roomCode) => {
        roomCode = roomCode.toUpperCase();
        
        if (rooms[roomCode]) {
            currentRoom = roomCode;
            socket.join(roomCode);
            
            // Yeni oyuncuyu oda listesine kaydet
            rooms[roomCode][socket.id] = { id: socket.id, x: 0, y: 0, z: 0, ry: 0, isAttacking: false };
            
            // Kendisine odadaki eski oyuncuları yolla
            socket.emit('roomJoined', { roomCode: roomCode, players: rooms[roomCode] });
            
            // Odadaki diğer kişilere yeni birinin geldiğini bildir
            socket.to(roomCode).emit('newPlayer', rooms[roomCode][socket.id]);
        } else {
            socket.emit('roomError', 'Oda bulunamadı! Kod yanlış olabilir.');
        }
    });

    // 3. HAREKET SENKRONİZASYONU (Sadece aynı odadakilere)
    socket.on('playerMovement', (movementData) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom][socket.id]) {
            rooms[currentRoom][socket.id].x = movementData.x;
            rooms[currentRoom][socket.id].y = movementData.y;
            rooms[currentRoom][socket.id].z = movementData.z;
            rooms[currentRoom][socket.id].ry = movementData.ry;
            
            socket.to(currentRoom).emit('playerMoved', rooms[currentRoom][socket.id]);
        }
    });

    // 4. KAFA ATMA SENKRONİZASYONU (Sadece aynı odadakilere)
    socket.on('playerAttack', () => {
        if (currentRoom) {
            socket.to(currentRoom).emit('playerAttacked', socket.id);
        }
    });

    // 5. OYUNDAN ÇIKMA DURUMU
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom][socket.id]) {
            delete rooms[currentRoom][socket.id];
            socket.to(currentRoom).emit('playerDisconnected', socket.id);
            
            // Odada hiç kimse kalmadıysa odayı tamamen silerek sunucuyu rahatlatıyoruz
            if (Object.keys(rooms[currentRoom]).length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Lobili sunucu ${PORT} portunda aktif!`);
});