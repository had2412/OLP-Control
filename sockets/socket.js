const poolPromise = require('../db/sql');

module.exports = (io) => {
    const connectedStudents = {}; // Lưu UserId -> FullName
    const round3Students = {};    // Lưu UserId -> FullName cho vòng 3
    const activePackages = {};
    let v3BuzzQueue = [];
    let currentQuestion = null;
    let currentOwnerUserId = null;  // userId của thí sinh "chủ gói" (người chọn gói ban đầu)
    let round2Started = false;
    let round2StartTime = null;
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
             round2StartTime = Date.now();
            await pool.request().query('DELETE FROM Round2Answers');
            console.log("🧹 Đã xóa dữ liệu bảng Round2Answers (vòng 2).");
        }

    } catch (err) {
        console.error("❌ Lỗi khi xóa dữ liệu:", err);
    }

    io.emit('round-started', round);
});

// ✅ Admin bắt đầu làm bài câu tiếp theo
        socket.on('startQuestion', async (round) => {
    console.log("🟡 Vòng thi bắt đầu:", round);

    io.emit('round-started', round);
});



// Khi admin bấm “Bắt đầu vòng 3”
socket.on("v3-start-round", async ({ userId } = {}) => {
    // = {} để tránh lỗi nếu không truyền tham số

    if (userId) {
        console.log(`🔔 Admin bắt đầu vòng 3 cho thí sinh ${userId}`);
    } else {
        console.log(`🔔 Admin bắt đầu vòng 3 cho tất cả thí sinh`);
    }

    // Xóa dữ liệu Round3Answers
    try {
        const pool = await poolPromise;
        await pool.request().query("DELETE FROM Round3Answers"); 
        console.log("🧹 Đã xóa toàn bộ dữ liệu Round3Answers (vòng 3 cũ).");
    } catch (err) {
        console.error("❌ Lỗi khi xóa dữ liệu Round3Answers:", err);
    }

    // Gửi sự kiện:
    if (userId) {
        // Chỉ emit cho 1 thí sinh
        io.to("user-" + userId).emit("v3-start-round", { userId });
    } else {
        // Emit cho tất cả thí sinh
        Object.keys(round3Students).forEach(id => {
            io.to("user-" + id).emit("v3-start-round", { userId: id });
        });
    }
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
        // Đặt biến lưu người bấm chuông đầu tiên
        let firstBuzz;
        let round2QuestionStartTime = null;
        // ✅ Gửi câu hỏi vòng 2
        socket.on("v2-show-question", (question) => {
            firstBuzz = null; // reset
            round2StartTime = Date.now();
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
        io.emit("v2-end-turn", { winner } );
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


        // Khi thí sinh bấm chuông
socket.on("v2-buzz", ({ userId, fullName }) => {
    const buzzTime = Date.now(); // timestamp ms

     // tính thời gian tính từ khi admin bấm bắt đầu vòng 2
    let elapsedSeconds = null;
    if (round2StartTime) {
        elapsedSeconds = (buzzTime - round2StartTime) / 1000; // giây
    }

    // gửi xuống admin hiển thị tên thí sinh + thời gian tính từ lúc start
    io.emit('v2-buzzed', {
        userId,
        fullName,
        elapsedSeconds: elapsedSeconds !== null ? elapsedSeconds.toFixed(2) : null
    });
});

        // ✅ Khi admin chuyển sang câu tiếp theo
        socket.on("v2-next", () => {
            io.emit("v2-timeout-or-next");
        });
        
       // ✅ Thí sinh nộp đáp án
socket.on("v2-submit-answer", async ({ userId, questionId, answer, essay }) => {
    try {
        const pool = await poolPromise;

        // Lấy câu hỏi + đáp án
        const qRes = await pool.request()
            .input("QuestionId", questionId)
            .query("SELECT CorrectAnswer, QuestionType FROM Questions_V2 WHERE QuestionId=@QuestionId");

        if (qRes.recordset.length === 0) return;
        const q = qRes.recordset[0];

        let isCorrect = 0;
        let autoScore = 0;

        // ✅ Chấm điểm tự động
        if (q.QuestionType === "MCQ") {
            if (answer && answer.trim().toUpperCase() === q.CorrectAnswer.trim().toUpperCase()) {
                isCorrect = 1;
                autoScore = 10; // đúng được 10 điểm
            }
        } else if (q.QuestionType === "TEXT") {
    // ✅ Chuẩn hóa tiếng Việt: bỏ dấu, viết thường, gom khoảng trắng
    const normalize = (str) => {
        return (str || "")
            .normalize("NFD") // tách dấu tiếng Việt
            .replace(/[\u0300-\u036f]/g, "") // loại bỏ dấu
            .replace(/\s+/g, " ") // gom khoảng trắng
            .trim()
            .toLowerCase();
    };

    const cleanEssay = normalize(essay);
    const cleanCorrect = normalize(q.CorrectAnswer);

    if (cleanEssay && cleanEssay === cleanCorrect) {
        isCorrect = 1;
        autoScore = 10;
    } else {
        isCorrect = 0;
        autoScore = 0;
    }
}

        await pool.request()
            .input("UserId", userId)
            .input("QuestionId", questionId)
            .input("SelectedAnswer", answer || null)
            .input("EssayAnswer", essay || null)
            .input("IsCorrect", isCorrect)
            .input("Score", autoScore)
            .input("AnswerTime", new Date())
            .query(`
                INSERT INTO Round2Answers (UserId, QuestionId, SelectedAnswer, EssayAnswer, IsCorrect, Score, AnswerTime)
                VALUES (@UserId, @QuestionId, @SelectedAnswer, @EssayAnswer, @IsCorrect, @Score, @AnswerTime)
            `);

        console.log(`✅ V2: Chấm tự động ${q.QuestionType} cho ${userId} — Điểm: ${autoScore}`);

        // Gửi kết quả ngay cho admin
        io.emit("v2-auto-score", { userId, questionId, isCorrect, autoScore });
    } catch (err) {
        console.error("❌ Lỗi chấm điểm tự động V2:", err);
    }
});


// ✅ Thí sinh nộp đáp án → dừng timer admin
socket.on("v2-stop-timer-admin", ({ questionId, userId }) => {
    io.emit("v2-stop-timer-admin", { questionId, userId });
});


// ✅ Admin yêu cầu lấy kết quả
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
                    SELECT Q.Content, Q.CorrectAnswer, Q.QuestionType,
                           A.SelectedAnswer, A.EssayAnswer,
                           A.IsCorrect, A.Score, A.AnswerTime
                    FROM Round2Answers A
                    JOIN Questions_V2 Q ON A.QuestionId = Q.QuestionId
                    WHERE A.UserId = @UserId
                    ORDER BY A.AnswerTime ASC
                `);

            const details = answers.recordset.map((row, idx) => ({
                index: idx + 1,
                question: row.Content,
                correctAnswer: row.CorrectAnswer,
                questionType: row.QuestionType,   // 👈 thêm loại câu hỏi
                selectedAnswer: row.SelectedAnswer,
                essayAnswer: row.EssayAnswer,     // 👈 thêm bài tự luận
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
        

        // ✅ Thí sinh tham gia vòng 3
        socket.on("v3-join", ({ userId, fullName }) => {
            round3Students[userId] = fullName;
            socket.join("user-" + userId);
            console.log(`⭐ Thí sinh vào vòng 3: ${fullName} (${userId})`);

            // Báo cho admin biết có thí sinh mới
            io.emit("v3-student-joined", { userId, fullName });
        });

        // ✅ Admin yêu cầu danh sách thí sinh
        socket.on("v3-get-students", () => {
            const list = Object.entries(round3Students).map(([id, name]) => ({ id, name }));
            socket.emit("v3-student-list", list);
        });

       // ✅ Thí sinh chọn gói câu hỏi
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

        // Lưu lại gói và câu hỏi hiện tại
        activePackages[userId] = {
            current: 0,
            questions,
            points,
            star: false // Ngôi sao hy vọng
        };
        currentOwnerUserId = userId;
        // Câu hỏi đầu tiên
        const first = questions[0];

        // 🔑 Lưu câu hỏi hiện tại toàn cục (để khi người khác giành quyền sẽ gửi lại được)
        currentQuestion = {
            QuestionId: first.QuestionId,
            Content: first.Content,
            OptionA: first.OptionA,
            OptionB: first.OptionB,
            OptionC: first.OptionC,
            OptionD: first.OptionD,
            Order: 1,
            points,
            userId,          // thí sinh ban đầu chọn gói
            fullName,
            starUsed: activePackages[userId].star
        };
         console.log(`📦 ${fullName} (${userId}) đã chọn gói ${points}, currentOwnerUserId=${currentOwnerUserId}, currentQuestion=${currentQuestion.QuestionId}`);

        // Gửi câu hỏi đầu tiên cho thí sinh và admin
        io.to("user-" + userId).emit("v3-show-question", currentQuestion);
        io.emit("v3-admin-show-question", currentQuestion);

        console.log(`📦 ${fullName} (${userId}) đã chọn gói ${points}, gửi câu 1`);
    } catch (err) {
        console.error("❌ Lỗi khi xử lý v3-select-package:", err);
    }
});


        // ✅ Admin xác nhận người giành quyền (người khác) - alias allow-answer (không bắt buộc)
        socket.on("v3-allow-answer", ({ userId, fullName }) => {
            if (currentQuestion) {
                io.to("user-" + userId).emit("v3-show-question", currentQuestion);
                console.log(`✅ Admin xác nhận (allow-answer): ${fullName} (${userId}) được trả lời`);
            }
            io.emit("v3-current-contestant", { userId, fullName });
        });

        // ✅ Admin chuyển sang câu tiếp theo (dùng currentOwnerUserId - *không* dùng user của buzzer)
    socket.on("v3-next-question", () => {
        if (!currentOwnerUserId || !activePackages[currentOwnerUserId]) {
            console.warn("⚠️ v3-next-question: không có owner hoặc activePackages trống");
            return;
        }

        const pkg = activePackages[currentOwnerUserId];
        pkg.current++;

        if (pkg.current >= pkg.questions.length) {
            io.emit("v3-package-done", { userId: currentOwnerUserId, fullName: round3Students[currentOwnerUserId] });
            // kết thúc gói -> reset trạng thái
            currentQuestion = null;
            currentOwnerUserId = null;
            v3BuzzQueue = [];
            io.emit("v3-buzz-list", { buzzers: [] });
            return;
        }

        const q = pkg.questions[pkg.current];
        currentQuestion = {
            QuestionId: q.QuestionId,
            Content: q.Content,
            OptionA: q.OptionA,
            OptionB: q.OptionB,
            OptionC: q.OptionC,
            OptionD: q.OptionD,
            Order: pkg.current + 1,
            points: pkg.points,
            userId: currentOwnerUserId,
            fullName: round3Students[currentOwnerUserId],
            starUsed: pkg.star
        };

        // phát câu mới cho chủ gói và admin
        io.to("user-" + currentOwnerUserId).emit("v3-show-question", currentQuestion);
        io.emit("v3-admin-show-question", currentQuestion);

        // reset queue mỗi khi sang câu mới
        v3BuzzQueue = [];
        io.emit("v3-buzz-list", { buzzers: [] });

        console.log(`➡️ Đã gửi câu ${currentQuestion.Order} cho ${currentQuestion.fullName} (${currentOwnerUserId})`);
    });

 //Admin lùi câu về trước
    socket.on("v3-prev-question", () => {
    if (!currentOwnerUserId || !activePackages[currentOwnerUserId]) {
        console.warn("⚠️ v3-prev-question: không có owner hoặc activePackages trống");
        return;
    }

    const pkg = activePackages[currentOwnerUserId];

    // Lùi về câu trước
    if (pkg.current <= 0) {
        console.warn("⚠️ v3-prev-question: đang ở câu đầu tiên, không thể lùi");
        return;
    }

    pkg.current--; // lùi index

    const q = pkg.questions[pkg.current];
    currentQuestion = {
        QuestionId: q.QuestionId,
        Content: q.Content,
        OptionA: q.OptionA,
        OptionB: q.OptionB,
        OptionC: q.OptionC,
        OptionD: q.OptionD,
        Order: pkg.current + 1,
        points: pkg.points,
        userId: currentOwnerUserId,
        fullName: round3Students[currentOwnerUserId],
        starUsed: pkg.star
    };

    // phát câu mới cho chủ gói và admin
    io.to("user-" + currentOwnerUserId).emit("v3-show-question", currentQuestion);
    io.emit("v3-admin-show-question", currentQuestion);

    // reset queue mỗi khi sang câu mới
    v3BuzzQueue = [];
    io.emit("v3-buzz-list", { buzzers: [] });

    console.log(`⬅️ Đã lùi về câu ${currentQuestion.Order} cho ${currentQuestion.fullName} (${currentOwnerUserId})`);
});


        // ✅ Ngôi sao hy vọng
        socket.on("v3-set-star", ({ userId }) => {
    if (!activePackages[userId]) return;

    // nếu đã dùng rồi thì bỏ qua
    if (activePackages[userId].star) {
        console.log(`⚠️ ${round3Students[userId]} đã dùng sao hy vọng trước đó, bỏ qua`);
        return;
    }

    activePackages[userId].star = true;
    io.emit("v3-star-set", { userId, fullName: round3Students[userId] });
    console.log(`🌟 ${round3Students[userId]} đã chọn Ngôi sao hy vọng`);
});

        // ✅ Khi thí sinh nộp đáp án
socket.on("v3-submit-answer", async ({ userId, questionId, answer }) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("QuestionId", questionId)
            .query("SELECT CorrectAnswer FROM Questions_V3 WHERE QuestionId = @QuestionId");

        if (result.recordset.length === 0) return;
        const correctAnswer = result.recordset[0].CorrectAnswer;
        const isCorrect = (answer === correctAnswer) ? 1 : 0;

        // ✅ Lấy thứ tự câu hỏi (Order) hiện tại
        const currentPkg = activePackages[userId];
        const order = currentPkg?.current ?? 0; // 0-based index
        const packagePoints = currentPkg?.points ?? 0;

        // ✅ Bảng điểm chi tiết theo gói
        const scoreMap = {
            40: [10, 10, 20],
            60: [10, 20, 30],
            80: [20, 20, 40]
        };

        let baseScore = scoreMap[packagePoints]?.[order] ?? 0; // điểm cho câu hiện tại
        let score = 0;

        if (isCorrect) {
            score = baseScore;
            if (currentPkg.star) score *= 2; // ngôi sao hy vọng nhân đôi
        } else {
            if (currentPkg.star) score = -baseScore; // sai thì trừ tương ứng
        }

        // ✅ Lưu vào DB
        await pool.request()
            .input("UserId", userId)
            .input("QuestionId", questionId)
            .input("SelectedAnswer", answer)
            .input("IsCorrect", isCorrect)
            .input("Score", score)
            .input("AnswerTime", new Date())
            .query(`
                INSERT INTO Round3Answers (UserId, QuestionId, SelectedAnswer, IsCorrect, Score, AnswerTime)
                VALUES (@UserId, @QuestionId, @SelectedAnswer, @IsCorrect, @Score, @AnswerTime)
            `);

        console.log(`✅ V3: ${round3Students[userId]} trả lời ${answer} (${isCorrect ? "Đúng" : "Sai"}), điểm = ${score}`);

        io.emit("v3-answer-result", {
            userId,
            fullName: round3Students[userId],
            questionId,
            answer,
            correctAnswer,
            isCorrect,
            score
        });

        // Nếu sai → mở cho thí sinh khác giành quyền
        if (!isCorrect) {
            io.emit("v3-open-for-others", {
                questionId,
                fullName: round3Students[userId],
                ownerId: currentOwnerUserId,
                message: `Câu hỏi vẫn mở cho các thí sinh khác giành quyền trả lời!`
            });
        }
    } catch (err) {
        console.error("❌ Lỗi khi lưu đáp án V3:", err);
    }
});


        // Khi thí sinh bấm chuông
        socket.on("v3-buzz", ({ userId }) => {
            if (!userId) return;
            if (!round3Students[userId]) {
                console.warn(`⚠️ v3-buzz: không tìm thấy user ${userId} trong round3Students`);
                return;
            }
            console.log(`🔔 ${round3Students[userId]} bấm chuông giành quyền`);
            // tránh duplicate
            if (!v3BuzzQueue.includes(userId)) v3BuzzQueue.push(userId);

            io.emit("v3-buzz-list", {
                buzzers: v3BuzzQueue.map(id => ({
                    userId: id,
                    fullName: round3Students[id]
                }))
            });
        });

        // Khi admin gửi câu hỏi cho 1 thí sinh
        socket.on("v3-send-question", ({ userId, question }) => {
            currentQuestion = question; // Lưu câu hỏi hiện tại
            io.to("user-" + userId).emit("v3-show-question", question);
        });

         // ✅ Khi admin xác nhận ai được trả lời (clone currentQuestion sang user mới)
    socket.on("v3-buzzer-confirmed", ({ userId, fullName }) => {
        console.log(`🔐 v3-buzzer-confirmed nhận: ${fullName} (${userId}) - currentQuestion=${currentQuestion ? currentQuestion.QuestionId : 'null'}`);

        if (currentQuestion) {
            // nếu thí sinh giành quyền chưa có activePackage thì tạo tạm để tính điểm
            if (!activePackages[userId]) {
                activePackages[userId] = {
                    current: currentQuestion.Order - 1,
                    questions: [currentQuestion],
                    points: currentQuestion.points || 0,
                    star: false
                };
                console.log(`ℹ️ Đã tạo activePackage tạm cho ${fullName} (${userId})`);
            }else {
    // nếu đã có package thì giữ nguyên trạng thái star
    activePackages[userId].current = currentQuestion.Order - 1;
    activePackages[userId].questions.push(currentQuestion);
}

            // gửi 1 bản sao của currentQuestion nhưng set userId/fullName thành thí sinh mới
            const questionForNew = {
                QuestionId: currentQuestion.QuestionId,
                Content: currentQuestion.Content,
                OptionA: currentQuestion.OptionA,
                OptionB: currentQuestion.OptionB,
                OptionC: currentQuestion.OptionC,
                OptionD: currentQuestion.OptionD,
                Order: currentQuestion.Order,
                points: currentQuestion.points,
                userId,    // thí sinh giành quyền
                fullName,
                starUsed: true 
            };

            io.to("user-" + userId).emit("v3-show-question", questionForNew);
            console.log(`✅ Admin xác nhận: ${fullName} (${userId}) được trả lời`);
        } else {
            console.warn("⚠️ Không có currentQuestion để gửi cho thí sinh (kiểm tra flow v3-select-package/v3-next-question)");
        }

        // broadcast ai được quyền
        io.emit("v3-buzzer-confirmed", { userId, fullName });

        // remove user khỏi queue
        v3BuzzQueue = v3BuzzQueue.filter(id => id !== userId);
        io.emit("v3-buzz-list", {
            buzzers: v3BuzzQueue.map(id => ({ userId: id, fullName: round3Students[id] }))
        });
    });

        // ✅ Admin yêu cầu lấy kết quả tổng kết vòng 3
        socket.on("v3-get-results", async () => {
            try {
                const pool = await poolPromise;

                // Lấy danh sách thí sinh đã có kết quả vòng 3
                const users = await pool.request().query(`
                    SELECT DISTINCT U.UserId, U.FullName
                    FROM Round3Answers A
                    JOIN Users U ON A.UserId = U.UserId
                `);

                if (users.recordset.length === 0) {
                    socket.emit("v3-result-table", []); // Gửi mảng rỗng nếu chưa có ai
                    return;
                }

                const allResults = [];

                for (const user of users.recordset) {
                    const answers = await pool.request()
                        .input("UserId", user.UserId)
                        .query(`
                            SELECT Q.Content, Q.CorrectAnswer, A.SelectedAnswer, A.IsCorrect, A.Score, A.AnswerTime
                            FROM Round3Answers A
                            JOIN Questions_V3 Q ON A.QuestionId = Q.QuestionId
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

                    const totalScore = details.reduce((sum, d) => sum + d.score, 0);

                    allResults.push({
                        fullName: user.FullName,   // 🔑 map lại key chuẩn cho client
                        total: details.length,
                        score: totalScore,
                        details
                    });
                }

                // Gửi kết quả cho tất cả admin đang mở trang
                io.emit("v3-result-table", allResults);
                console.log("📊 Đã gửi bảng tổng kết vòng 3:", allResults);

            } catch (err) {
                console.error("❌ Lỗi khi lấy kết quả vòng 3:", err);
            }
});


// ✅ Tổng kết điểm của cả 3 vòng
socket.on("get-final-summary", async () => {
    try {
        const pool = await poolPromise;

        // ===== Lấy danh sách thí sinh =====
        const users = await pool.request().query(`
            SELECT UserId, FullName FROM Users WHERE Role = 'ThiSinh'
        `);

        const finalResults = [];

        for (const user of users.recordset) {
            const userId = user.UserId;
            const fullName = user.FullName;

            // ===== Vòng 1 =====
            const v1 = await pool.request()
                .input("UserId", userId)
    .query(`
        SELECT COUNT(*) AS Correct
        FROM Answers
        WHERE UserId = @UserId AND IsCorrect = 1
    `);
            const v1Score = v1.recordset[0].Correct * 10;

            // ===== Vòng 2 =====
            const v2 = await pool.request()
                .input("UserId", userId)
                .query(`
                    SELECT ISNULL(SUM(Score),0) AS TotalScore
                    FROM Round2Answers
                    WHERE UserId = @UserId
                `);
            const v2Score = v2.recordset[0].TotalScore;

            // ===== Vòng 3 =====
            const v3 = await pool.request()
                .input("UserId", userId)
                .query(`
                    SELECT ISNULL(SUM(Score),0) AS TotalScore
                    FROM Round3Answers
                    WHERE UserId = @UserId
                `);
            const v3Score = v3.recordset[0].TotalScore;

            // ===== Tổng điểm =====
            finalResults.push({
                userId,
                fullName,
                v1Score,
                v2Score,
                v3Score,
                totalScore: v1Score + v2Score + v3Score
            });
        }

        // Gửi kết quả về cho tất cả client
        io.emit("final-summary-results", finalResults);
        console.log("🏆 Đã gửi tổng kết cuối cùng cho cả 3 vòng");
    } catch (err) {
        console.error("❌ Lỗi khi tổng kết 3 vòng:", err);
    }
});



    });
};
