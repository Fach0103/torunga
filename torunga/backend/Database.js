const mongoose = require('mongoose');

class Database {
    constructor(uri) {
        this.uri = uri;
    }

    async connect() {
        try {
            await mongoose.connect(this.uri);
            console.log('[DB] Conectado exitosamente a MongoDB Atlas');
        } catch (error) {
            console.error('[DB] Error de conexion:', error.message);
            process.exit(1);
        }
    }
}

module.exports = Database;