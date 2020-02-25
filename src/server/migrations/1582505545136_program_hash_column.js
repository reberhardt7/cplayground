module.exports = {
    up: `
        # Drop foreign keys so that we can change the "id" column. (We're changing its type, so
        # setting ON UPDATE CASCADE isn't good enough)

        ALTER TABLE runs DROP FOREIGN KEY runs_ibfk_1;
        ALTER TABLE views DROP FOREIGN KEY views_ibfk_1;

        # Preserve the old ids in a new "hash" column

        ALTER TABLE programs DROP PRIMARY KEY;
        ALTER TABLE programs CHANGE id hash CHAR(44) UNIQUE NOT NULL;

        # Create a new numeric id column

        ALTER TABLE programs ADD COLUMN id INT NOT NULL FIRST;
        # Fill with sequential numbers ordered by created column:
        UPDATE programs
        JOIN (SELECT @rank := 0) r
        SET id=@rank:=@rank+1
        ORDER BY created;
        # Promote to primary key, and set autoincrement:
        ALTER TABLE programs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY;

        # Update references:

        UPDATE runs
        INNER JOIN programs ON runs.program_id = programs.hash
        SET runs.program_id = programs.id;

        UPDATE views
        INNER JOIN programs ON views.program_id = programs.hash
        SET views.program_id = programs.id;

        # Change program_id column type:

        ALTER TABLE runs MODIFY COLUMN program_id INT NOT NULL;
        ALTER TABLE views MODIFY COLUMN program_id INT NOT NULL;

        # Reinstate foreign key references
        ALTER TABLE runs ADD CONSTRAINT runs_ibfk_1 FOREIGN KEY (program_id) REFERENCES programs(id);
        ALTER TABLE views ADD CONSTRAINT views_ibfk_1 FOREIGN KEY (program_id) REFERENCES programs(id);
    `,
    down: `
        # Drop foreign keys so that we can change the "id" column. (We're changing its type, so
        # setting ON UPDATE CASCADE isn't good enough)

        ALTER TABLE runs DROP FOREIGN KEY runs_ibfk_1;
        ALTER TABLE views DROP FOREIGN KEY views_ibfk_1;

        # Change program_id type so we can put back the old hashes as ids

        ALTER TABLE runs MODIFY COLUMN program_id CHAR(44) NOT NULL;
        ALTER TABLE views MODIFY COLUMN program_id CHAR(44) NOT NULL;

        # Restore old program_id references

        UPDATE runs
        INNER JOIN programs ON runs.program_id = CAST(programs.id AS CHAR)
        SET runs.program_id = programs.hash;

        UPDATE views
        INNER JOIN programs ON views.program_id = CAST(programs.id AS CHAR)
        SET views.program_id = programs.hash;

        # Restore old IDs

        DROP INDEX hash ON programs;
        ALTER TABLE programs
        DROP PRIMARY KEY,
        DROP COLUMN id,
        CHANGE hash id CHAR(44) NOT NULL PRIMARY KEY;

        # Reinstate foreign key references
        ALTER TABLE runs ADD CONSTRAINT runs_ibfk_1 FOREIGN KEY (program_id) REFERENCES programs(id);
        ALTER TABLE views ADD CONSTRAINT views_ibfk_1 FOREIGN KEY (program_id) REFERENCES programs(id);
    `,
};
