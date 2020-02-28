const crypto = require('crypto');

module.exports = {
    async up(conn, callback) {
        await new Promise((resolve) => conn.query(`
            # Create new files table:
            CREATE TABLE files (
                id binary(28) NOT NULL,
                name varchar(40) NOT NULL,
                contents mediumblob NOT NULL,
                source_ip varchar(40) NOT NULL,
                created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            );

            # Backfill files table using info from programs table:
            INSERT INTO files (id, name, contents, source_ip)
            SELECT DISTINCT
                UNHEX(SHA2(CONCAT(include_file_name, ':', include_file_data), 224)) AS file_id,
                include_file_name,
                include_file_data,
                SUBSTRING_INDEX(GROUP_CONCAT(source_ip), ',', 1) AS source_ip
            FROM programs
            WHERE include_file_name != ''
            GROUP BY file_id
            ORDER BY created;

            # Add include_file_id column to programs table
            ALTER TABLE programs
            ADD COLUMN include_file_id binary(28) AFTER include_file_data,
            ADD CONSTRAINT include_file_id_fk FOREIGN KEY (include_file_id) REFERENCES files(id);

            # Set include_file_id column in programs table to reference rows in the files table:
            UPDATE programs
            SET include_file_id = UNHEX(SHA2(CONCAT(include_file_name, ':', include_file_data), 224))
            WHERE include_file_name != '';
        `, (err) => { if (err) throw err; resolve(); }));

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
        `, (err) => { if (err) throw err; resolve(); }));

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
