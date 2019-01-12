const mysql = require('mysql');
const process = require('process');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ANIMALS = fs.readFileSync(path.resolve(__dirname + '/animals.txt'))
    .toString().split('\n').filter(str => str.length > 0);

const CODE_MAX_LEN = 65535;         // TEXT
const OUTPUT_MAX_LEN = 16777215;    // MEDIUMBLOB
const CFLAGS_MAX_LEN = 100;
const ARGS_MAX_LEN = 100;

if (!process.env.DB_URL) {
    console.error('Error! Must specify DB_URL enviroment variable');
    process.exit(1);
}

const dbUrl = new url.URL(process.env.DB_URL);

if (!dbUrl.host || !dbUrl.username || !dbUrl.password) {
    console.error('Please specify host, user, and password in DB_URL');
    process.exit(1);
}

// Note: be sure to update migrations.js as well!
const pool = mysql.createPool({
  connectionLimit: 20,
  host: dbUrl.host,
  user: dbUrl.username,
  password: dbUrl.password,
  database: 'cfiddle',
});

function genProgramId(compiler, cflags, code, args) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({ compiler, cflags, code, args }));
    return hash.digest('base64');
}

function getProgram(compiler, cflags, code, args) {
    const id = genProgramId(compiler, cflags, code, args);
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM programs WHERE id = ?', id, (err, res) => {
            if (err) throw err;
            else if (res) resolve(res[0]);
            else resolve(null);
        });
    });
}

function getProgramByAlias(alias) {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM programs WHERE alias = ?', alias, (err, res) => {
            if (err) throw err;
            else if (res) resolve(res[0]);
            else resolve(null);
        });
    });
}

function insertProgram(compiler, cflags, code, args, source_ip, source_user_agent) {
    // When storing a program, we generate its id as a SHA-256 hash of all the
    // parameters the client sent us. The chance of a collision is extremely
    // low, and this allows us to not add duplicate entries in the database if
    // someone were to run the same code several times. Because a long hash
    // doesn't make for a good URL for a program, we also generate a unique
    // "alias" containing 3 names of animals. This is what is shown to users
    // (the hash ID is never shown).
    const id = genProgramId(compiler, cflags, code, args);
    const alias = Array.from({length: 3},
        () => ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
    ).join('-');
    return new Promise((resolve, reject) => {
        function tryInsert() {
            // Try generating an alias and insert into it into the database. If
            // it's already taken, we'll generate a new one later.
            const alias = Array.from({length: 3},
                () => ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
            ).join('-');
            pool.query(
                'INSERT INTO programs SET ?',
                { id, alias, compiler, cflags, code, args, source_ip, source_user_agent },
                error => {
                    if (error && error.sqlMessage === "Duplicate entry '"
                        + alias + "' for key 'alias'") {
                        // If alias is already taken, try a new one
                        tryInsert();
                    } else if (error && error.sqlMessage === "Duplicate entry '"
                        + id + "' for key 'PRIMARY'") {
                        // Return the existing program info
                        resolve(getProgram(compiler, cflags, code, args));
                    } else if (error) {
                        console.error('Error inserting program!');
                        console.error(error);
                    } else {
                        resolve({ id, alias });
                    }
                }
            );
        }
        tryInsert();
    });
}

function createRun(program_id, source_ip, source_user_agent) {
    return new Promise((resolve, reject) => {
        pool.query('INSERT INTO runs SET ?', { program_id, source_ip, source_user_agent },
            (err, res) => {
                if (err) throw err;
                resolve(res.insertId);
            }
        );
    });
}

function updateRun(id, runtime_ms, exit_status, output) {
    return new Promise((resolve, reject) => {
        pool.query('UPDATE runs SET ? WHERE id = ?',
            [{runtime_ms, exit_status, output}, id],
            (err, res) => {
                if (err) throw err;
                resolve();
            }
        );
    });
}

function logView(program_id, source_ip, source_user_agent) {
    return new Promise((resolve, reject) => {
        pool.query('INSERT INTO views SET ?', { program_id, source_ip, source_user_agent },
            (err, res) => {
                if (err) throw err;
                resolve(res.insertId);
            }
        );
    });
}

module.exports = { CODE_MAX_LEN, OUTPUT_MAX_LEN, CFLAGS_MAX_LEN, ARGS_MAX_LEN,
    insertProgram, getProgramByAlias, createRun, updateRun, logView };
