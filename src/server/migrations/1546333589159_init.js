module.exports = {
    "up": `
        CREATE TABLE programs (
          id char(44) NOT NULL,
          alias varchar(50) NOT NULL,
          created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          source_ip varchar(40) NOT NULL,
          compiler varchar(10) NOT NULL,
          cflags varchar(100) NOT NULL,
          code text NOT NULL,
          args varchar(100) DEFAULT '',
          PRIMARY KEY (id),
          UNIQUE KEY alias (alias)
        );
        CREATE TABLE runs (
          id int(11) unsigned NOT NULL AUTO_INCREMENT,
          program_id char(44) NOT NULL,
          source_ip varchar(40) NOT NULL,
          start_time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          runtime_ms int(11) DEFAULT NULL,
          output mediumtext DEFAULT NULL,
          PRIMARY KEY (id),
          KEY program_id (program_id),
          CONSTRAINT runs_ibfk_1
            FOREIGN KEY (program_id) REFERENCES programs (id)
        );
    `,
    "down": "DROP TABLE programs; DROP TABLE runs;"
}
