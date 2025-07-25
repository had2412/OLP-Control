const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

// ===========================
// Ghi câu trả lời thí sinh
// ===========================
router.post('/', async (req, res) => {
    const { userId, questionId, selectedAnswer, timeTaken } = req.body;

    if (!userId || !questionId) {
        return res.status(400).json({ error: 'Thiếu userId hoặc questionId' });
    }

    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('qid', questionId)
            .query('SELECT CorrectAnswer FROM Questions WHERE QuestionId = @qid');

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });
        }

        const correctAnswer = result.recordset[0].CorrectAnswer;

        const isCorrect = (selectedAnswer && correctAnswer === selectedAnswer) ? true : false;

        await pool.request()
            .input('uid', userId)
            .input('qid', questionId)
            .input('ans', selectedAnswer === "" ? null : selectedAnswer)
            .input('iscorrect', isCorrect)
            .input('timems', timeTaken ?? null) // <-- thêm dòng này
            .query(`
                INSERT INTO Answers (UserId, QuestionId, SelectedAnswer, IsCorrect, AnswerTime, TimeTaken)
                VALUES (@uid, @qid, @ans, @iscorrect, GETDATE(), @timems)
            `);

        res.json({ status: 'ok', isCorrect });
    } catch (err) {
        console.error("❌ Lỗi khi ghi câu trả lời:", err);
        res.status(500).send('Lỗi ghi câu trả lời: ' + err.message);
    }
});


// ===========================
// Tổng kết 10 câu gần nhất
// ===========================
router.get('/summary/recent', async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            WITH RankedAnswers AS (
                SELECT A.*, 
                       ROW_NUMBER() OVER (PARTITION BY A.UserId ORDER BY A.AnswerTime DESC) AS rn
                FROM Answers A
            )
            SELECT RA.UserId, U.FullName,
                   COUNT(*) AS Total,
                   SUM(CASE WHEN RA.IsCorrect = 1 THEN 1 ELSE 0 END) AS CorrectAnswers,
                   MIN(RA.AnswerTime) AS FirstAnswerTime,
                   MAX(RA.AnswerTime) AS LastAnswerTime,
                   SUM(RA.TimeTaken) AS TotalTimeTaken
            FROM RankedAnswers RA
            JOIN Users U ON RA.UserId = U.UserId
            WHERE RA.rn <= 10
            GROUP BY RA.UserId, U.FullName
        `);

        const summary = result.recordset.map(row => ({
            UserId: row.UserId,
            FullName: row.FullName, 
            Total: row.Total,
            CorrectAnswers: row.CorrectAnswers,
            Score: row.CorrectAnswers * 10,
            TimeTakenSeconds: Math.floor((row.TotalTimeTaken || 0) / 1000)
        }));

        res.json(summary);
    } catch (err) {
        console.error("❌ Lỗi khi tổng kết điểm:", err);
        res.status(500).send("Lỗi tổng kết điểm: " + err.message);
    }
});


// ===========================
// Tổng kết chi tiết 10 câu
// ===========================
router.get('/summary/detail/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);

    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('UserId', userId)
            .query(`
                WITH RankedAnswers AS (
                    SELECT A.*, 
                           ROW_NUMBER() OVER (PARTITION BY A.UserId ORDER BY A.AnswerTime DESC) AS rn
                    FROM Answers A
                    WHERE A.UserId = @UserId
                )
                SELECT TOP 10 
                       Q.Content,
                       Q.OptionA, Q.OptionB, Q.OptionC, Q.OptionD,
                       Q.CorrectAnswer,
                       RA.SelectedAnswer,
                       RA.TimeTaken,
                       CASE 
                           WHEN RA.SelectedAnswer IS NULL THEN 'Sai'
                           WHEN RA.SelectedAnswer = Q.CorrectAnswer THEN 'Đúng'
                           ELSE 'Sai'
                       END AS Result
                FROM RankedAnswers RA
                JOIN Questions Q ON Q.QuestionId = RA.QuestionId
                WHERE RA.rn <= 10
                ORDER BY RA.AnswerTime DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("❌ Lỗi khi tổng kết chi tiết:", err);
        res.status(500).send("Lỗi tổng kết chi tiết: " + err.message);
    }
});

module.exports = router;
