const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const answerRoutes = require('./routes/answers');
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: '*' }
});

require('./sockets/socket')(io);

app.use(cors());
app.use(express.json());

app.use('/api/questions', require('./routes/questions'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/answers', answerRoutes);
app.use('/api/users', require('./routes/users'));
const questionRoutes = require('./routes/questions');
app.use('/api/questions', questionRoutes);
server.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000');
});
