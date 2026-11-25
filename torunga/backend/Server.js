require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server: SocketIOServer } = require('socket.io');

const ConfigLoader = require('./ConfigLoader');
const Database = require('./Database');
const UploadManager = require('./UploadManager');
const AuthMiddleware = require('./AuthMiddleware');
const AuthController = require('./AuthController');
const MatchController = require('./MatchController');
const ChatController = require('./ChatController');
const SocketHandler = require('./SocketHandler');

class AppServer {
    constructor() {
        this.configLoader = new ConfigLoader();
        this.serverCfg = this.configLoader.get('server');
        this.routesCfg = this.configLoader.get('routes');
        this.uploadCfg = this.configLoader.get('uploads');
        this.messages = this.configLoader.get('messages');

        this.port = process.env.PORT || this.serverCfg.defaultPort;
        this.jwtSecret = process.env.JWT_SECRET;
        this.baseUrl = process.env.BASE_URL || this.serverCfg.defaultBaseUrl;

        this.app = express();
        this.httpServer = http.createServer(this.app);
        this.io = new SocketIOServer(this.httpServer, {
            cors: { origin: '*', methods: ['GET', 'POST'] }
        });

        this.database = new Database(process.env.MONGO_URI);
        this.uploadManager = new UploadManager(this.configLoader);
        this.authMiddleware = new AuthMiddleware(this.jwtSecret, this.configLoader);
        this.authController = new AuthController(this.jwtSecret, this.baseUrl, this.configLoader);
        this.matchController = new MatchController(this.configLoader);
        this.chatController = new ChatController(this.baseUrl, this.configLoader);
        this.socketHandler = new SocketHandler(this.io, this.configLoader);
    }

    configureMiddlewares() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(this.serverCfg.uploadsRoute, express.static(path.join(__dirname, this.serverCfg.uploadsDir)));
    }

    configureRoutes() {
        const profileUpload = this.uploadManager.getUploader(this.uploadCfg.profilesFolder);
        const chatUpload = this.uploadManager.getUploader(this.uploadCfg.chatFolder);
        const protect = this.authMiddleware.verifyHttp;

        this.app.get(this.routesCfg.health, (req, res) => {
            res.json({ status: 'ok', message: this.messages.serverRunning });
        });

        // Autenticacion y CRUD de Perfil
        this.app.post(this.routesCfg.register, profileUpload.single('profileImage'), this.authController.register);
        this.app.post(this.routesCfg.login, this.authController.login);
        this.app.get(this.routesCfg.profile, protect, this.authController.getProfile);
        this.app.put(this.routesCfg.profile, protect, profileUpload.single('profileImage'), this.authController.updateProfile);
        this.app.delete(this.routesCfg.profile, protect, this.authController.deleteAccount);

        // Descubrimiento y Swipes (Amistades)
        this.app.get(this.routesCfg.candidates, protect, this.matchController.getCandidates);
        this.app.post(this.routesCfg.swipe, protect, this.matchController.swipe);
        this.app.get(this.routesCfg.friends, protect, this.matchController.getFriends);

        // Chat e Imagenes
        this.app.get(this.routesCfg.conversations, protect, this.chatController.getConversationsList);
        this.app.get(this.routesCfg.messages, protect, this.chatController.getChatHistory);
        this.app.post(this.routesCfg.chatUpload, protect, chatUpload.single('image'), this.chatController.uploadChatImage);
    }

    configureSockets() {
        this.io.use(this.authMiddleware.verifySocket);
        this.socketHandler.initialize();
    }

    async start() {
        await this.database.connect();
        this.configureMiddlewares();
        this.configureRoutes();
        this.configureSockets();

        this.httpServer.listen(this.port, () => {
            console.log(`[SERVER] Corriendo en ${this.baseUrl}`);
        });
    }
}

const server = new AppServer();
server.start();