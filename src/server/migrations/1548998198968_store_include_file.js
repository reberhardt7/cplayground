module.exports = {
    "up": `
        ALTER TABLE programs
        ADD COLUMN include_file_name varchar(20) NOT NULL AFTER args;
        ALTER TABLE programs
        ADD COLUMN include_file_data MEDIUMBLOB NOT NULL AFTER include_file_name;
    `,
    "down": `
        ALTER TABLE programs
        DROP COLUMN include_file_name;
        ALTER TABLE programs
        DROP COLUMN include_file_data;
    `,
}
