const jwt = require('jsonwebtoken');

class AuthMiddleware {
    constructor(secret, configLoader) {
        this.secret = secret;
        this.messages = configLoader.get('messages');
    }

    verifyHttp = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: this.messages.noToken });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, this.secret);
            req.userId = decoded.id;
            next();
        } catch (error) {
            return res.status(401).json({ error: this.messages.invalidToken });
        }
    };

    verifySocket = (socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        if (!token) {
            return next(new Error(this.messages.socketAuthRequired));
        }

        try {
            const decoded = jwt.verify(token, this.secret);
            socket.userId = decoded.id;
            next();
        } catch (error) {
            next(new Error(this.messages.socketInvalidToken));
        }
    };
}

module.exports = AuthMiddleware;