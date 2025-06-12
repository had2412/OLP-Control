const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: '*' }
});

require('./sockets/socket')(io);

app.use(cors());
app.use(express.json());

app.use('/api/questions', require('./routes/questions'));
app.use('/api/answers', require('./routes/answers'));
app.use('/api/scores', require('./routes/scores'));

server.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000');
});
