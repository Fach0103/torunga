const Message = require('./MessageModel');
const User = require('./UserModel');

class ChatController {
    constructor(baseUrl, configLoader) {
        this.baseUrl = baseUrl;
        this.serverCfg = configLoader.get('server');
        this.uploadCfg = configLoader.get('uploads');
        this.messages = configLoader.get('messages');
    }

    getConversationsList = async (req, res) => {
        try {
            const user = await User.findById(req.userId).populate('friends', 'name profileImage');
            if (!user) {
                return res.status(404).json({ error: this.messages.userNotFound });
            }

            const conversations = await Promise.all(
                user.friends.map(async (friend) => {
                    const lastMessage = await Message.findOne({
                        $or: [
                            { sender: req.userId, receiver: friend._id },
                            { sender: friend._id, receiver: req.userId }
                        ]
                    }).sort({ createdAt: -1 });

                    const unreadCount = await Message.countDocuments({
                        sender: friend._id,
                        receiver: req.userId,
                        read: false
                    });

                    return {
                        friend,
                        lastMessage: lastMessage || null,
                        unreadCount
                    };
                })
            );

            res.json(conversations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    getChatHistory = async (req, res) => {
        try {
            const { friendId } = req.params;
            const userId = req.userId;

            const messages = await Message.find({
                $or: [
                    { sender: userId, receiver: friendId },
                    { sender: friendId, receiver: userId }
                ]
            }).sort({ createdAt: 1 });

            res.json(messages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    uploadChatImage = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: this.messages.noImageProvided });
            }

            const chatFolder = this.uploadCfg.chatFolder;
            const imageUrl = `${this.baseUrl}${this.serverCfg.uploadsRoute}/${chatFolder}/${req.file.filename}`;

            res.status(201).json({ imageUrl });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };
}

module.exports = ChatController;