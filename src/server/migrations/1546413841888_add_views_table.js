module.exports = {
    "up": `
        CREATE TABLE views (
          id int(11) unsigned NOT NULL AUTO_INCREMENT,
          program_id char(44) NOT NULL,
          source_ip varchar(40) NOT NULL,
          time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY program_id (program_id),
          CONSTRAINT views_ibfk_1
            FOREIGN KEY (program_id) REFERENCES programs (id)
        );
    `,
    "down": "DROP TABLE views",
}
