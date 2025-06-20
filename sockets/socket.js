const  poolPromise  = require('../db/sql');
module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('🟢 Client connected');

        // ✅ Thí sinh tham gia phòng riêng theo UserId
        socket.on('join-room', (userId) => {
            socket.join("user-" + userId);
            console.log(`👤 User ${userId} joined room: user-${userId}`);
        });

        // ✅ Admin bắt đầu vòng thi (broadcast toàn bộ)
        socket.on('start-round', (round) => {
            console.log("🟡 Vòng thi bắt đầu:", round);
            io.emit('round-started', round);
        });

        // ✅ Admin gửi câu hỏi cho tất cả (nếu muốn broadcast)
        socket.on('show-question', (index) => {
            console.log("📨 Admin chuyển sang câu:", index);
            io.emit('show-question', index);
        });

        // ✅ Gửi câu hỏi chỉ cho thí sinh cụ thể
        socket.on('show-question-for', ({ userId, round }) => {
            console.log(`📩 Gửi câu hỏi round ${round} cho user ${userId}`);
            io.to("user-" + userId).emit('show-question', round);
        });


//
       socket.on("request-user-summary", async () => {
    try {
        const pool = await poolPromise;

        // Lấy toàn bộ user đã trả lời ít nhất 1 câu
        const users = await pool.request().query(`
            SELECT DISTINCT UserId FROM Answers
        `);

        for (const row of users.recordset) {
            const userId = row.UserId;

            const result = await pool.request()
                .input("UserId", userId)
                .query(`
                    SELECT Q.Content, Q.CorrectAnswer, A.SelectedAnswer
                    FROM Answers A
                    JOIN Questions Q ON A.QuestionId = Q.QuestionId
                    WHERE A.UserId = @UserId
                    ORDER BY A.AnswerTime ASC
                `);

            // Gửi kết quả về đúng thí sinh
            io.to("user-" + userId).emit("summary-user-answers", result.recordset);
        }

        console.log("📤 Gửi kết quả đáp án đã chọn cho thí sinh");
    } catch (err) {
        console.error("❌ Lỗi khi tổng kết điểm:", err);
    }
});




        // ✅ Nhận và broadcast đáp án (nếu cần)
        socket.on('submit-answer', (data) => {
            io.emit('update-answer', data); // hoặc ghi riêng từng user nếu cần
        });

        // ✅ Gửi kết quả cuối vòng
        socket.on('show-results', () => {
            io.emit('display-results');
        });

        // ✅ Hiển thị đáp án
        socket.on("show-answer", (data) => {
            io.emit("show-answer", data);
        });

        // ✅ Kết thúc vòng
        socket.on("end-round", (round) => {
            io.emit("round-ended", round);
        });

        socket.on("start-timer", (round) => {
            io.emit("start-timer", round);
        });

    });
};
