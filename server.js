const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

// Her şey aynı klasörde olduğu için ana dizini dışarı açıyoruz
app.use(express.static(__dirname));

// Online oyuncu bağlantı kontrolü
io.on('connection', (socket) => {
    console.log('Bir tavşan bağlandı! ID:', socket.id);

    socket.on('disconnect', () => {
        console.log('Bir tavşan oyundan çıktı:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Super Rabbit sunucusu ${PORT} portunda çalışıyor!`);
});