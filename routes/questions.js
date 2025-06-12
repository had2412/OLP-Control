const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

router.get('/random/:round', async (req, res) => {
    const round = req.params.round;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT TOP 10 * FROM Questions WHERE Round = ${round} ORDER BY NEWID()`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send('Error loading questions: ' + err.message);
    }
});

module.exports = router;
