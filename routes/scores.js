const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

router.get('/rankings', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT U.UserId, U.FullName, SUM(IIF(A.IsCorrect = 1, Q.Point, 0)) AS TotalScore
            FROM Users U
            LEFT JOIN Answers A ON U.UserId = A.UserId
            LEFT JOIN Questions Q ON A.QuestionId = Q.QuestionId
            WHERE Q.Round = 1
            GROUP BY U.UserId, U.FullName
            ORDER BY TotalScore DESC
        `);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).send('Error loading scores: ' + err.message);
    }
});

module.exports = router;
