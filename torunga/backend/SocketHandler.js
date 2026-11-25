const Message = require('./MessageModel');
const User = require('./UserModel');

class SocketHandler {
    constructor(io, configLoader) {
        this.io = io;
        this.socketCfg = configLoader.get('sockets');
        this.events = this.socketCfg.events;
        this.types = this.socketCfg.messageTypes;
        this.messages = configLoader.get('messages');
        this.onlineUsers = new Map();
    }

    initialize() {
        this.io.on(this.events.connection, (socket) => {
            const userId = socket.userId;
            this.onlineUsers.set(userId, socket.id);
            console.log(`[WS] Usuario conectado: ${userId}`);

            socket.on(this.events.sendMessage, async (payload, callback) => {
                try {
                    const { receiverId, content, imageUrl, messageType } = payload;

                    if (!content && !imageUrl) {
                        if (callback) callback({ error: this.messages.emptyMessageError });
                        return;
                    }

                    const sender = await User.findById(userId);
                    const isFriend = sender && sender.friends.some(id => id.equals(receiverId));

                    if (!isFriend) {
                        if (callback) callback({ error: this.messages.notFriendsError });
                        return;
                    }

                    const resolvedType = messageType || (imageUrl ? this.types.image : this.types.text);

                    const newMessage = await Message.create({
                        sender: userId,
                        receiver: receiverId,
                        content: content || '',
                        imageUrl: imageUrl || '',
                        messageType: resolvedType
                    });

                    const receiverSocketId = this.onlineUsers.get(receiverId);
                    if (receiverSocketId) {
                        this.io.to(receiverSocketId).emit(this.events.receiveMessage, newMessage);
                    }

                    if (callback) {
                        callback({ status: 'ok', message: newMessage });
                    } else {
                        socket.emit(this.events.messageSent, newMessage);
                    }
                } catch (error) {
                    if (callback) callback({ error: error.message });
                }
            });

            socket.on(this.events.typing, ({ receiverId, isTyping }) => {
                const receiverSocketId = this.onlineUsers.get(receiverId);
                if (receiverSocketId) {
                    this.io.to(receiverSocketId).emit(this.events.userTyping, {
                        senderId: userId,
                        isTyping
                    });
                }
            });

            socket.on(this.events.markRead, async ({ friendId }) => {
                try {
                    await Message.updateMany(
                        { sender: friendId, receiver: userId, read: false },
                        { $set: { read: true } }
                    );

                    const friendSocketId = this.onlineUsers.get(friendId);
                    if (friendSocketId) {
                        this.io.to(friendSocketId).emit(this.events.messagesRead, {
                            readerId: userId
                        });
                    }
                } catch (error) {
                    console.error('[WS] Error marcando mensajes como leidos:', error.message);
                }
            });

            socket.on(this.events.disconnect, () => {
                this.onlineUsers.delete(userId);
                console.log(`[WS] Usuario desconectado: ${userId}`);
            });
        });
    }
}

module.exports = SocketHandler;