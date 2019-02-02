module.exports = {
    "up": "ALTER TABLE programs MODIFY include_file_name VARCHAR(40)",
    "down": "ALTER TABLE programs MODIFY include_file_name VARCHAR(30)",
}
