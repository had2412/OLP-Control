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
        socket.on('start-round', async (round) => {
    console.log("🟡 Vòng thi bắt đầu:", round);

    // ✅ Xóa toàn bộ dữ liệu cũ trong bảng Answers
    try {
        const pool = await poolPromise;
        await pool.request().query('DELETE FROM Answers');
        console.log("🧹 Đã xóa toàn bộ dữ liệu trong bảng Answers.");
    } catch (err) {
        console.error("❌ Lỗi khi xóa dữ liệu Answers:", err);
    }

    // Tiếp tục gửi sự kiện như cũ
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

socket.on("get-student-results", async () => {
    try {
        const pool = await poolPromise;

        // 1. Lấy danh sách tất cả thí sinh đã làm bài
        const users = await pool.request().query(`
            SELECT DISTINCT U.UserId, U.FullName
            FROM Answers A
            JOIN Users U ON A.UserId = U.UserId
        `);

        const allResults = [];

        for (const user of users.recordset) {
            const userId = user.UserId;
            const fullName = user.FullName;

            // 2. Lấy tất cả câu trả lời của user
            const answers = await pool.request()
                .input("UserId", userId)
                .query(`
                    SELECT Q.Content, Q.CorrectAnswer, A.SelectedAnswer
                    FROM Answers A
                    JOIN Questions Q ON A.QuestionId = Q.QuestionId
                    WHERE A.UserId = @UserId
                    ORDER BY A.AnswerTime ASC
                `);

            const details = answers.recordset.map((row, idx) => {
                return {
                    index: idx + 1,
                    question: row.Content,
                    correctAnswer: row.CorrectAnswer,
                    selectedAnswer: row.SelectedAnswer,
                    isCorrect: row.CorrectAnswer === row.SelectedAnswer
                };
            });

            const total = details.length;
            const correct = details.filter(d => d.isCorrect).length;
            const score = correct * 10;

            allResults.push({
                fullName,
                total,
                correct,
                score,
                details
            });
        }

        // 3. Gửi kết quả về tất cả client (hoặc socket.to("room") nếu cần riêng)
        io.emit("summary-all-users", allResults);

        console.log("✅ Đã gửi kết quả tổng hợp thí sinh.");
    } catch (err) {
        console.error("❌ Lỗi khi tổng kết thí sinh:", err);
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
