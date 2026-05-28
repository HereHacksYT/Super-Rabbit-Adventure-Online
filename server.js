const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {}; 

io.on('connection', (socket) => {
    let currentRoom = null;

    // 1. 5 HANELİ SAYISAL ODA OLUŞTURMA
    socket.on('createRoom', () => {
        // 10000 ile 99999 arasında tamamen rastgele 5 haneli sayı üretir
        const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
        
        rooms[roomCode] = {
            hostId: socket.id, // Odayı kuran lider
            isStarted: false,  // Oyun başladı mı?
            players: {}
        };
        
        currentRoom = roomCode;
        socket.join(roomCode);
        
        rooms[roomCode].players[socket.id] = { id: socket.id, x: 0, y: 0, z: 0, ry: 0, isAttacking: false };
        
        // Kurucuya lider olduğunu ve odayı kurduğunu bildiriyoruz
        socket.emit('roomCreated', { roomCode: roomCode, players: rooms[roomCode].players });
    });

    // 2. ODAYA KATILMA İŞLEMİ
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            if (rooms[roomCode].isStarted) {
                socket.emit('roomError', 'Bu oyun zaten başladı, lobiye giremezsin!');
                return;
            }

            currentRoom = roomCode;
            socket.join(roomCode);
            
            rooms[roomCode].players[socket.id] = { id: socket.id, x: 0, y: 0, z: 0, ry: 0, isAttacking: false };
            
            // Odadaki herkese oyuncu listesinin güncel halini gönder (Bekleme odası sayacı için)
            io.to(roomCode).emit('roomUpdate', { roomCode: roomCode, players: rooms[roomCode].players, hostId: rooms[roomCode].hostId });
        } else {
            socket.emit('roomError', 'Oda bulunamadı! Sayıları kontrol et.');
        }
    });

    // 3. KURUCUNUN MAÇI BAŞLATMASI (SUPER BEAR MANTIĞI)
    socket.on('startGameSignal', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].hostId === socket.id) {
            rooms[currentRoom].isStarted = true;
            // Odadaki herkese "Lobi ekranını kapatın, oyun başladı!" sinyali gönderilir
            io.to(currentRoom).emit('gameStartedAtAll', rooms[currentRoom].players);
        }
    });

    // 4. HAREKETLER (Sadece oyun başladıktan sonra iletilir)
    socket.on('playerMovement', (movementData) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].isStarted && rooms[currentRoom].players[socket.id]) {
            rooms[currentRoom].players[socket.id].x = movementData.x;
            rooms[currentRoom].players[socket.id].y = movementData.y;
            rooms[currentRoom].players[socket.id].z = movementData.z;
            rooms[currentRoom].players[socket.id].ry = movementData.ry;
            
            socket.to(currentRoom).emit('playerMoved', rooms[currentRoom].players[socket.id]);
        }
    });

    // 5. KAFA ATMA
    socket.on('playerAttack', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].isStarted) {
            socket.to(currentRoom).emit('playerAttacked', socket.id);
        }
    });

    // 6. KOPMA / ÇIKMA
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            
            // Eğer çıkan kişi liderse odadaki başka birini lider yap veya dağıt
            if (rooms[currentRoom].hostId === socket.id) {
                const remainingIds = Object.keys(rooms[currentRoom].players);
                if (remainingIds.length > 0) {
                    rooms[currentRoom].hostId = remainingIds[0];
                    io.to(currentRoom).emit('roomUpdate', { roomCode: currentRoom, players: rooms[currentRoom].players, hostId: rooms[currentRoom].hostId });
                }
            } else {
                io.to(currentRoom).emit('roomUpdate', { roomCode: currentRoom, players: rooms[currentRoom].players, hostId: rooms[currentRoom].hostId });
            }

            socket.to(currentRoom).emit('playerDisconnected', socket.id);
            
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Sayı kodlu lobi sunucusu aktif! Port: ${PORT}`);
});