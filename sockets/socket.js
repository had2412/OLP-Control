module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('🟢 Client connected');

        socket.on('start-round', (round) => {
            io.emit('round-started', round);
        });

        socket.on('next-question', (index) => {
            io.emit('show-question', index);
        });

        socket.on('submit-answer', (data) => {
            io.emit('update-answer', data);
        });

        socket.on('show-results', () => {
            io.emit('display-results');
        });
    });
};
