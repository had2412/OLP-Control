const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

/* ==========================================================
   🧩 VÒNG 1 - BẢNG Questions
   ========================================================== */
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
        if (index >= questions.length) return res.status(404).send("Câu hỏi không tồn tại");
        res.json(questions[index]);
    } catch (err) {
        res.status(500).send("Lỗi: " + err.message);
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

/* ==========================================================
   🟢 VÒNG 2 - BẢNG Questions_V2
   ========================================================== */
router.get('/round2', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT QuestionId, Content, OptionA, OptionB, OptionC, OptionD,
                   CorrectAnswer, Explanation
            FROM Questions_V2
            ORDER BY QuestionId DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Lỗi tải câu hỏi V2: " + err.message);
    }
});

router.post('/round2', async (req, res) => {
    const { Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Content", Content)
            .input("OptionA", OptionA)
            .input("OptionB", OptionB)
            .input("OptionC", OptionC)
            .input("OptionD", OptionD)
            .input("CorrectAnswer", CorrectAnswer)
            .input("Explanation", Explanation)
            .query(`
                INSERT INTO Questions_V2 (Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation)
                VALUES (@Content, @OptionA, @OptionB, @OptionC, @OptionD, @CorrectAnswer, @Explanation)
            `);
        res.send("✅ Thêm câu hỏi Vòng 2 thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi thêm câu hỏi V2: " + err.message);
    }
});

router.put('/round2/:id', async (req, res) => {
    const id = req.params.id;
    const { Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Id", id)
            .input("Content", Content)
            .input("OptionA", OptionA)
            .input("OptionB", OptionB)
            .input("OptionC", OptionC)
            .input("OptionD", OptionD)
            .input("CorrectAnswer", CorrectAnswer)
            .input("Explanation", Explanation)
            .query(`
                UPDATE Questions_V2 SET
                    Content = @Content,
                    OptionA = @OptionA,
                    OptionB = @OptionB,
                    OptionC = @OptionC,
                    OptionD = @OptionD,
                    CorrectAnswer = @CorrectAnswer,
                    Explanation = @Explanation
                WHERE QuestionId = @Id
            `);
        res.send("✅ Cập nhật câu hỏi Vòng 2 thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi cập nhật câu hỏi V2: " + err.message);
    }
});

router.delete('/round2/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Id", id)
            .query('DELETE FROM Questions_V2 WHERE QuestionId = @Id');
        res.send("✅ Xóa câu hỏi Vòng 2 thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi xóa câu hỏi V2: " + err.message);
    }
});

/* ==========================================================
   🟣 VÒNG 3 - BẢNG Questions_V3
   ========================================================== */
router.get('/round3', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT QuestionId, Package, Content, OptionA, OptionB, OptionC, OptionD,
                   CorrectAnswer, Explanation
            FROM Questions_V3
            ORDER BY QuestionId DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Lỗi tải câu hỏi V3: " + err.message);
    }
});

router.post('/round3', async (req, res) => {
    const { Package, Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Package", Package)
            .input("Content", Content)
            .input("OptionA", OptionA)
            .input("OptionB", OptionB)
            .input("OptionC", OptionC)
            .input("OptionD", OptionD)
            .input("CorrectAnswer", CorrectAnswer)
            .input("Explanation", Explanation)
            .query(`
                INSERT INTO Questions_V3 (Package, Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation)
                VALUES (@Package, @Content, @OptionA, @OptionB, @OptionC, @OptionD, @CorrectAnswer, @Explanation)
            `);
        res.send("✅ Thêm câu hỏi Vòng 3 thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi thêm câu hỏi V3: " + err.message);
    }
});

router.put('/round3/:id', async (req, res) => {
    const id = req.params.id;
    const { Package, Content, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Id", id)
            .input("Package", Package)
            .input("Content", Content)
            .input("OptionA", OptionA)
            .input("OptionB", OptionB)
            .input("OptionC", OptionC)
            .input("OptionD", OptionD)
            .input("CorrectAnswer", CorrectAnswer)
            .input("Explanation", Explanation)
            .query(`
                UPDATE Questions_V3 SET
                    Package = @Package,
                    Content = @Content,
                    OptionA = @OptionA,
                    OptionB = @OptionB,
                    OptionC = @OptionC,
                    OptionD = @OptionD,
                    CorrectAnswer = @CorrectAnswer,
                    Explanation = @Explanation
                WHERE QuestionId = @Id
            `);
        res.send("✅ Cập nhật câu hỏi Vòng 3 thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi cập nhật câu hỏi V3: " + err.message);
    }
});

router.delete('/round3/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("Id", id)
            .query('DELETE FROM Questions_V3 WHERE QuestionId = @Id');
        res.send("✅ Xóa câu hỏi Vòng 3 thành công");
    } catch (err) {
        res.status(500).send("❌ Lỗi xóa câu hỏi V3: " + err.message);
    }
});

module.exports = router;
