const url = require('url');
const mysql = require('mysql');
const migration = require('mysql-migrations');

if (!process.env.DB_URL) {
    console.error('Error! Must specify DB_URL enviroment variable');
    process.exit(1);
}

const dbUrl = new url.URL(process.env.DB_URL);

if (!dbUrl.host || !dbUrl.username || !dbUrl.password) {
    console.error('Please specify host, user, and password in DB_URL');
    process.exit(1);
}

const pool = mysql.createPool({
    connectionLimit: 20,
    host: dbUrl.host,
    user: dbUrl.username,
    password: dbUrl.password,
    database: 'cplayground',
    multipleStatements: true,
});

migration.init(pool, __dirname + '/migrations');
