const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

router.get('/question/:round/:index', async (req, res) => {
    const round = parseInt(req.params.round);
    const index = parseInt(req.params.index);
    if (round > 10) {
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


module.exports = router;
