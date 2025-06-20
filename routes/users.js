const express = require('express');
const router = express.Router();
const poolPromise = require('../db/sql');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = password; // nếu có hash thì thay thế tại đây

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', username)
            .input('password', hashedPassword)
            .query(`
                SELECT UserId, FullName, Role 
                FROM Users 
                WHERE Username = @username AND PasswordHash = @password
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = result.recordset[0];
        res.json(user);
    } catch (err) {
        res.status(500).send("Login error: " + err.message);
    }
});

module.exports = router;
