const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

router.get('/question/:round/:index', async (req, res) => {
    const round = parseInt(req.params.round);
    const index = parseInt(req.params.index);
    if (round > 20) {
        return res.status(400).send("Chỉ có 10 câu hỏi. Đã vượt giới hạn.");
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Round', round)
            .query('SELECT * FROM Questions WHERE Round = @Round ORDER BY QuestionId');

        const questions = result.recordset;
        if (index >= questions.length) {
            return res.status(404).send("Câu hỏi không tồn tại");
        }

        res.json(questions[index]);
    } catch (err) {
        res.status(500).send("Lỗi: " + err.message);
    }
});

// trong routes/questions.js hoặc routes/round2.js
router.get('/round2/:index', async (req, res) => {
    const index = parseInt(req.params.index);
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM Questions_V2 ORDER BY QuestionId');

        const questions = result.recordset;
        if (index >= questions.length) {
            return res.status(404).send("Không có câu hỏi.");
        }

        res.json(questions[index]);
    } catch (err) {
        res.status(500).send("Lỗi khi truy vấn: " + err.message);
    }
});




router.get('/all', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Questions ORDER BY QuestionId DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Lỗi: " + err.message);
    }
});

// Thêm câu hỏi
router.post('/', async (req, res) => {
    const { Round, Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Round", Round)
            .input("Content", Content)
            .input("OptionA", OptionA)
            .input("OptionB", OptionB)
            .input("OptionC", OptionC)
            .input("OptionD", OptionD)
            .input("CorrectAnswer", CorrectAnswer)
            .query(`
                INSERT INTO Questions (Round, Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer)
                VALUES (@Round, @Content, @OptionA, @OptionB, @OptionC, @OptionD, @CorrectAnswer)
            `);
        res.send("✅ Thêm câu hỏi thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi thêm câu hỏi: " + err.message);
    }
});

// Cập nhật câu hỏi
router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const { Round, Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Id", id)
            .input("Round", Round)
            .input("Content", Content)
            .input("OptionA", OptionA)
            .input("OptionB", OptionB)
            .input("OptionC", OptionC)
            .input("OptionD", OptionD)
            .input("CorrectAnswer", CorrectAnswer)
            .query(`
                UPDATE Questions SET 
                Round = @Round,
                Content = @Content,
                OptionA = @OptionA,
                OptionB = @OptionB,
                OptionC = @OptionC,
                OptionD = @OptionD,
                CorrectAnswer = @CorrectAnswer
                WHERE QuestionId = @Id
            `);
        res.send("✅ Cập nhật thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi cập nhật: " + err.message);
    }
});

// Xóa câu hỏi
router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Id", id)
            .query('DELETE FROM Questions WHERE QuestionId = @Id');
        res.send("✅ Xóa thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi xóa câu hỏi: " + err.message);
    }
});

module.exports = router;
