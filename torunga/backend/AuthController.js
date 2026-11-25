const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('./UserModel');

class AuthController {
    constructor(jwtSecret, baseUrl, configLoader) {
        this.jwtSecret = jwtSecret;
        this.baseUrl = baseUrl;
        this.authCfg = configLoader.get('auth');
        this.uploadCfg = configLoader.get('uploads');
        this.serverCfg = configLoader.get('server');
        this.messages = configLoader.get('messages');
    }

    register = async (req, res) => {
        try {
            const { name, email, password, bio, age, interests } = req.body;

            if (!name || !email || !password || !age) {
                return res.status(400).json({ error: this.messages.missingFields });
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: this.messages.emailExists });
            }

            const hashedPassword = await bcrypt.hash(password, this.authCfg.saltRounds);
            const profileFolder = this.uploadCfg.profilesFolder;
            const profileImage = req.file ? `${this.baseUrl}${this.serverCfg.uploadsRoute}/${profileFolder}/${req.file.filename}` : '';

            let parsedInterests = [];
            if (interests) {
                parsedInterests = Array.isArray(interests) ? interests : JSON.parse(interests);
            }

            const user = await User.create({
                name,
                email,
                password: hashedPassword,
                bio: bio || '',
                age: Number(age),
                interests: parsedInterests,
                profileImage
            });

            const token = jwt.sign({ id: user._id }, this.jwtSecret, { expiresIn: this.authCfg.tokenExpiresIn });

            res.status(201).json({
                token,
                user: this.sanitizeUser(user)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    login = async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: this.messages.invalidCredentials });
            }

            const token = jwt.sign({ id: user._id }, this.jwtSecret, { expiresIn: this.authCfg.tokenExpiresIn });

            res.json({
                token,
                user: this.sanitizeUser(user)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    getProfile = async (req, res) => {
        try {
            const user = await User.findById(req.userId).populate('friends', 'name profileImage bio age');
            if (!user) {
                return res.status(404).json({ error: this.messages.userNotFound });
            }

            res.json(this.sanitizeUser(user));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    updateProfile = async (req, res) => {
        try {
            const { name, bio, age, interests } = req.body;
            const updates = {};

            if (name) updates.name = name;
            if (bio !== undefined) updates.bio = bio;
            if (age) updates.age = Number(age);
            if (interests) {
                updates.interests = Array.isArray(interests) ? interests : JSON.parse(interests);
            }

            if (req.file) {
                const profileFolder = this.uploadCfg.profilesFolder;
                const currentUser = await User.findById(req.userId);
                if (currentUser && currentUser.profileImage) {
                    const oldFilename = currentUser.profileImage.split('/').pop();
                    const oldPath = path.join(__dirname, this.serverCfg.uploadsDir, profileFolder, oldFilename);
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
                updates.profileImage = `${this.baseUrl}${this.serverCfg.uploadsRoute}/${profileFolder}/${req.file.filename}`;
            }

            const updatedUser = await User.findByIdAndUpdate(req.userId, updates, { new: true });
            res.json(this.sanitizeUser(updatedUser));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    deleteAccount = async (req, res) => {
        try {
            const user = await User.findByIdAndDelete(req.userId);
            if (!user) {
                return res.status(404).json({ error: this.messages.userNotFound });
            }

            if (user.profileImage) {
                const filename = user.profileImage.split('/').pop();
                const filePath = path.join(__dirname, this.serverCfg.uploadsDir, this.uploadCfg.profilesFolder, filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }

            res.json({ message: this.messages.accountDeleted });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    sanitizeUser(user) {
        const obj = user.toObject();
        delete obj.password;
        return obj;
    }
}

module.exports = AuthController;