const crypto = require('crypto');

module.exports = {
    async up(conn, callback) {
        // Create new files table
        await new Promise((resolve) => conn.query(`
            CREATE TABLE files (
                id binary(16) NOT NULL,
                name varchar(40) NOT NULL,
                contents mediumblob NOT NULL,
                source_ip varchar(40) NOT NULL,
                created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY file (name, contents)
            );
        `, () => resolve()));

        // Backfill the files table with existing files from the programs table
        await new Promise((resolve) => conn.query(`
            INSERT INTO files (id, name, contents)
            SELECT UNHEX(REPLACE(UUID(), "-", "")), existing_files.*
            FROM (
                SELECT DISTINCT include_file_name, include_file_data
                FROM programs
                WHERE include_file_name IS NOT NULL AND include_file_name != ""
            ) AS existing_files;
        `, () => resolve()));

        // Update programs table to reference the new files
        await new Promise((resolve) => conn.query(`
            ALTER TABLE programs
            ADD COLUMN include_file_id binary(16) AFTER include_file_data,
            ADD CONSTRAINT include_file_id_fk FOREIGN KEY (include_file_id) REFERENCES files(id);
        `, () => resolve()));
        await new Promise((resolve) => conn.query(`
            UPDATE programs
            LEFT JOIN files ON programs.include_file_name = files.name AND programs.include_file_data = files.contents
            SET programs.include_file_id = files.id;
        `, () => resolve()));

        // Recalculate program hashes based on the new include_file_id column
        const programRows = await new Promise((resolve, reject) => conn.query(
            'SELECT id, compiler, cflags, code, args, include_file_id FROM programs',
            (err, res) => {
                if (err) reject(err);
                resolve(res);
            },
        ));
        await Promise.all(programRows.map((row) => new Promise((resolve, reject) => {
            const newHash = crypto.createHash('sha256');
            newHash.update(JSON.stringify({
                compiler: row.compiler,
                cflags: row.cflags,
                code: row.code,
                args: row.args,
                includeFileId: row.include_file_id && row.include_file_id.toString('hex'),
            }));
            conn.query(
                'UPDATE programs SET hash = ? WHERE id = ?',
                [newHash.digest('base64'), row.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                },
            );
        })));

        // Drop now-redundant name and data columns
        await new Promise((resolve) => conn.query(`
            ALTER TABLE programs
            DROP COLUMN include_file_name,
            DROP COLUMN include_file_data;
        `, () => resolve()));

        callback();
    },
    async down(conn, callback) {
        // Revert structural changes
        await new Promise((resolve, reject) => conn.query(`
            ALTER TABLE programs
            ADD COLUMN include_file_name varchar(30) NOT NULL AFTER include_file_id,
            ADD COLUMN include_file_data MEDIUMBLOB NOT NULL AFTER include_file_name;

            UPDATE programs
            INNER JOIN files ON programs.include_file_id = files.id
            SET programs.include_file_name = files.name, programs.include_file_data = files.contents;

            ALTER TABLE programs
            DROP CONSTRAINT include_file_id_fk,
            DROP COLUMN include_file_id;

            DROP TABLE files;
        `, (err) => {
            if (err) reject(err);
            resolve();
        }));

        // Restore old IDs
        const programRows = await new Promise((resolve, reject) => conn.query(`
            SELECT id, compiler, cflags, code, args, include_file_name, include_file_data
            FROM programs
        `, (err, res) => {
            if (err) reject(err);
            resolve(res);
        }));
        await Promise.all(programRows.map((row) => new Promise((resolve, reject) => {
            const newHash = crypto.createHash('sha256');
            const include = { name: row.include_file_name, data: row.include_file_data.toString('hex') };
            newHash.update(JSON.stringify({
                compiler: row.compiler,
                cflags: row.cflags,
                code: row.code,
                args: row.args,
                include,
            }));
            conn.query(
                'UPDATE programs SET hash = ? WHERE id = ?',
                [newHash.digest('base64'), row.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                },
            );
        })));

        callback();
    },
};
