module.exports = {
    "up": `
        ALTER TABLE programs
        ADD COLUMN source_user_agent varchar(300) NOT NULL AFTER source_ip;
        ALTER TABLE runs
        ADD COLUMN source_user_agent varchar(300) NOT NULL AFTER source_ip;
        ALTER TABLE views
        ADD COLUMN source_user_agent varchar(300) NOT NULL AFTER source_ip;
        ALTER TABLE runs
        ADD COLUMN exit_status int(11) unsigned AFTER runtime_ms;
        UPDATE runs SET exit_status=0;
    `,
    "down": `
        ALTER TABLE programs
        DROP COLUMN source_user_agent;
        ALTER TABLE runs
        DROP COLUMN source_user_agent;
        ALTER TABLE views
        DROP COLUMN source_user_agent;
        ALTER TABLE runs
        DROP COLUMN exit_status;
    `,
}
