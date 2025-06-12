const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

router.post('/', async (req, res) => {
    const { userId, questionId, selectedAnswer } = req.body;

    try {
        const pool = await poolPromise;

        const correct = await pool.request()
            .input('qid', questionId)
            .query('SELECT CorrectAnswer FROM Questions WHERE QuestionId = @qid');

        const isCorrect = (correct.recordset[0].CorrectAnswer === selectedAnswer);

        await pool.request()
            .input('uid', userId)
            .input('qid', questionId)
            .input('ans', selectedAnswer)
            .input('iscorrect', isCorrect)
            .query(`
                INSERT INTO Answers (UserId, QuestionId, SelectedAnswer, IsCorrect, AnswerTime)
                VALUES (@uid, @qid, @ans, @iscorrect, GETDATE())
            `);

        res.json({ status: 'ok', isCorrect });
    } catch (err) {
        res.status(500).send('Error saving answer: ' + err.message);
    }
});

module.exports = router;
