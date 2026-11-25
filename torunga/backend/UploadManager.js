const multer = require('multer');
const path = require('path');
const fs = require('fs');

class UploadManager {
    constructor(configLoader) {
        this.uploadCfg = configLoader.get('uploads');
        this.serverCfg = configLoader.get('server');
        this.messages = configLoader.get('messages');
        this.ensureDirectories();
    }

    ensureDirectories() {
        const dirs = [
            path.join(__dirname, this.serverCfg.uploadsDir, this.uploadCfg.profilesFolder),
            path.join(__dirname, this.serverCfg.uploadsDir, this.uploadCfg.chatFolder)
        ];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    getUploader(folder) {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, path.join(__dirname, this.serverCfg.uploadsDir, folder));
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, uniqueSuffix + path.extname(file.originalname));
            }
        });

        const fileFilter = (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error(this.messages.onlyImages), false);
            }
        };

        return multer({
            storage,
            fileFilter,
            limits: { fileSize: this.uploadCfg.maxFileSizeMB * 1024 * 1024 }
        });
    }
}

module.exports = UploadManager;