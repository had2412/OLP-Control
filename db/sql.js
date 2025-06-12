const sql = require('mssql');

const config = {
    user: 'sa',
    password: '123123', // đúng như SSMS
    server: 'localhost',
    port: 1433,          // dùng cổng cố định vừa cấu hình
    database: 'OLYMPIC CONTEST CONTROL',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('✅ SQL Connected!');
        return pool;
    })
    .catch(err => console.error('❌ SQL Connection Error:', err));

module.exports = poolPromise;
