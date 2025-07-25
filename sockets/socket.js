const poolPromise = require('../db/sql');

module.exports = (io) => {
    const connectedStudents = {}; // Lưu UserId -> FullName
    const activePackages = {};
    io.on('connection', (socket) => {
        console.log('🟢 Client connected');

        // ✅ Khi thí sinh tham gia
        socket.on('join-room', (userId, fullName) => {
            socket.join("user-" + userId);
            connectedStudents[userId] = fullName;
            console.log(`👤 Thí sinh: ${fullName} (${userId}) đã vào phòng`);
        });

        // ✅ Admin yêu cầu danh sách thí sinh đang online
        socket.on("v2-request-students", () => {
            const list = Object.entries(connectedStudents).map(([id, name]) => ({ id, name }));
            socket.emit("v2-student-list", list);
        });

        // ✅ Admin bắt đầu vòng thi
        socket.on('start-round', async (round) => {
    console.log("🟡 Vòng thi bắt đầu:", round);

    try {
        const pool = await poolPromise;

        if (round === 1) {
            await pool.request().query('DELETE FROM Answers');
            console.log("🧹 Đã xóa dữ liệu bảng Answers (vòng 1).");
        }

        if (round === 2) {
            await pool.request().query('DELETE FROM Round2Answers');
            console.log("🧹 Đã xóa dữ liệu bảng Round2Answers (vòng 2).");
        }

    } catch (err) {
        console.error("❌ Lỗi khi xóa dữ liệu:", err);
    }

    io.emit('round-started', round);
});



        // ✅ Hiển thị câu hỏi vòng 1
        socket.on('show-question', (index) => {
            console.log("📨 Admin chuyển sang câu:", index);
            io.emit('show-question', index);
        });

        socket.on("prev-question", (index) => {
            console.log("↩️ Admin lùi lại về câu:", index);
            io.emit("show-question", index);
        });

        socket.on('show-question-for', ({ userId, round }) => {
            console.log(`📩 Gửi câu hỏi round ${round} cho user ${userId}`);
            io.to("user-" + userId).emit('show-question', round);
        });

        socket.on("get-student-results", async () => {
            try {
                const pool = await poolPromise;
                const users = await pool.request().query(`
                    SELECT DISTINCT U.UserId, U.FullName
                    FROM Answers A
                    JOIN Users U ON A.UserId = U.UserId
                `);

                const allResults = [];

                for (const user of users.recordset) {
                    const userId = user.UserId;
                    const fullName = user.FullName;

                    const answers = await pool.request()
                        .input("UserId", userId)
                        .query(`
                            SELECT Q.Content, Q.CorrectAnswer, A.SelectedAnswer, A.TimeTaken
                            FROM Answers A
                            JOIN Questions Q ON A.QuestionId = Q.QuestionId
                            WHERE A.UserId = @UserId
                            ORDER BY A.AnswerTime ASC
                        `);

                    const details = answers.recordset.map((row, idx) => ({
                        index: idx + 1,
                        question: row.Content,
                        correctAnswer: row.CorrectAnswer,
                        selectedAnswer: row.SelectedAnswer,
                        isCorrect: row.CorrectAnswer === row.SelectedAnswer,
                        timeTaken: row.TimeTaken || 0
                    }));

                    const total = details.length;
                    const correct = details.filter(d => d.isCorrect).length;
                    const score = correct * 10;
                    const totalTime = details.reduce((sum, d) => sum + d.timeTaken, 0);

                    allResults.push({ fullName, total, correct, score, details, totalTime });
                }

                io.emit("summary-all-users", allResults);
                console.log("✅ Đã gửi kết quả tổng hợp thí sinh.");
            } catch (err) {
                console.error("❌ Lỗi khi tổng kết thí sinh:", err);
            }
        });

        socket.on('submit-answer', (data) => {
            io.emit('update-answer', data);
        });

        socket.on('show-results', () => {
            io.emit('display-results');
        });

        socket.on("show-answer", (data) => {
            io.emit("show-answer", data);
        });

        socket.on("end-round", (round) => {
            io.emit("round-ended", round);
        });

        socket.on("start-timer", (round) => {
            io.emit("start-timer", round);
        });

        socket.on("clear-student-summary", () => {
            io.emit("clear-student-summary");
        });

        // ========== VÒNG 2 ==========

        // ✅ Gửi câu hỏi vòng 2
        socket.on("v2-show-question", (question) => {
            io.emit("v2-show-question", question);
        });

        // ✅ Xác nhận người giành quyền
        socket.on("v2-confirm-winner", (winner) => {
            io.emit("v2-confirm-winner", winner);
        });

        // ✅ Bắt đầu đếm giờ trả lời
        socket.on("v2-start-timer", ({ duration, winner }) => {
            io.emit("v2-start-timer", { duration, winner });
        });

        // ✅ Kết thúc lượt
        socket.on("v2-end-turn", (winner) => {
            io.emit("v2-end-turn", winner);
        });

        // ✅ Gửi điểm
        socket.on("v2-submit-score", async ({ userId, score }) => {
    try {
        const pool = await poolPromise;

        // ✅ Update điểm cho câu trả lời mới nhất (ORDER BY AnswerTime DESC)
        await pool.request()
            .input("UserId", userId)
            .input("Score", score)
            .query(`
                UPDATE Round2Answers
                SET Score = @Score
                WHERE AnswerId = (
                    SELECT TOP 1 AnswerId
                    FROM Round2Answers
                    WHERE UserId = @UserId
                    ORDER BY AnswerTime DESC
                )
            `);

        console.log(`✅ Admin đã chấm điểm: ${userId} = ${score}`);
        io.emit("v2-score", { userId, score });
    } catch (err) {
        console.error("❌ Lỗi khi chấm điểm vòng 2:", err);
    }
});


        // ✅ Khi thí sinh bấm chuông (có thể thêm nếu dùng phần cứng)
        socket.on("v2-buzz", (userId, fullName) => {
            io.emit("v2-buzzed", fullName);
        });

        // ✅ Khi admin chuyển sang câu tiếp theo
        socket.on("v2-next", () => {
            io.emit("v2-timeout-or-next");
        });
        
        socket.on("v2-submit-answer", async ({ userId, questionId, answer }) => {
    try {
        const pool = await poolPromise;

        // ✅ Truy vấn đáp án đúng từ bảng Questions_V2
        const result = await pool.request()
            .input("QuestionId", questionId)
            .query("SELECT CorrectAnswer FROM Questions_V2 WHERE QuestionId = @QuestionId");

        if (result.recordset.length === 0) {
            console.warn("⚠️ Không tìm thấy câu hỏi.");
            return;
        }

        const correctAnswer = result.recordset[0].CorrectAnswer;
        const isCorrect = (answer === correctAnswer) ? 1 : 0;

        // ✅ Insert dữ liệu kèm IsCorrect
        await pool.request()
            .input("UserId", userId)
            .input("QuestionId", questionId)
            .input("SelectedAnswer", answer)
            .input("IsCorrect", isCorrect)
            .input("AnswerTime", new Date())
            .query(`
                INSERT INTO Round2Answers (UserId, QuestionId, SelectedAnswer, IsCorrect, AnswerTime)
                VALUES (@UserId, @QuestionId, @SelectedAnswer, @IsCorrect, @AnswerTime)
            `);

        console.log(`✅ Đáp án được lưu từ User ${userId}: ${answer} (${isCorrect ? "Đúng" : "Sai"})`);
    } catch (err) {
        console.error("❌ Lỗi lưu đáp án vòng 2:", err);
    }
});

socket.on("v2-get-results", async () => {
    try {
        const pool = await poolPromise;

        const users = await pool.request().query(`
            SELECT DISTINCT U.UserId, U.FullName
            FROM Round2Answers A
            JOIN Users U ON A.UserId = U.UserId
        `);

        const allResults = [];

        for (const user of users.recordset) {
            const answers = await pool.request()
                .input("UserId", user.UserId)
                .query(`
                    SELECT Q.Content, Q.CorrectAnswer, A.SelectedAnswer, A.IsCorrect, A.Score, A.AnswerTime
                    FROM Round2Answers A
                    JOIN Questions_V2 Q ON A.QuestionId = Q.QuestionId
                    WHERE A.UserId = @UserId
                    ORDER BY A.AnswerTime ASC
                `);

            const details = answers.recordset.map((row, idx) => ({
                index: idx + 1,
                question: row.Content,
                correctAnswer: row.CorrectAnswer,
                selectedAnswer: row.SelectedAnswer,
                isCorrect: row.IsCorrect,
                score: row.Score || 0,
                answerTime: row.AnswerTime
            }));

            const total = details.length;
            const correct = details.filter(d => d.isCorrect).length;
            const totalScore = details.reduce((sum, d) => sum + d.score, 0);

            allResults.push({
                fullName: user.FullName,
                total,
                correct,
                score: totalScore,
                details
            });
        }

        io.emit("v2-result-table", allResults);
    } catch (err) {
        console.error("❌ Lỗi khi lấy kết quả vòng 2:", err);
    }
});

// ========== VÒNG 3 ==========

  // ✅ Khi thí sinh chọn gói câu hỏi
        socket.on("v3-select-package", async ({ userId, fullName, points }) => {
            try {
                const pool = await poolPromise;

                const result = await pool.request()
                    .input("Package", points)
                    .query(`
                        SELECT TOP 3 *
                        FROM Questions_V3
                        WHERE Package = @Package
                        ORDER BY OrderInPackage ASC
                    `);

                const questions = result.recordset;

                if (questions.length === 0) {
                    io.to("user-" + userId).emit("v3-error", "Không tìm thấy câu hỏi cho gói bạn chọn.");
                    return;
                }

                activePackages[userId] = {
                    current: 0,
                    questions
                };

                const first = questions[0];
                io.to("user-" + userId).emit("v3-show-question", {
                    QuestionId: first.QuestionId,
                    Content: first.Content,
                    OptionA: first.OptionA,
                    OptionB: first.OptionB,
                    OptionC: first.OptionC,
                    OptionD: first.OptionD,
                    Order: 1
                });

                console.log(`📦 Đã gửi câu đầu tiên cho ${userId} trong gói ${points}`);
            } catch (err) {
                console.error("❌ Lỗi khi xử lý v3-select-package:", err);
            }
        });
    });
};
