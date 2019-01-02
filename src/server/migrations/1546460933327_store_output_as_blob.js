module.exports = {
    "up": "ALTER TABLE runs MODIFY output MEDIUMBLOB",
    "down": "ALTER TABLE runs MODIFY output MEDIUMTEXT"
}
