const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor(fileName = 'config.json') {
        this.filePath = path.join(__dirname, fileName);
        this.config = this.load();
    }

    load() {
        const rawData = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(rawData);
    }

    get(section) {
        return section ? this.config[section] : this.config;
    }
}

module.exports = ConfigLoader;