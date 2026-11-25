const User = require('./UserModel');

class MatchController {
    constructor(configLoader) {
        this.matchCfg = configLoader.get('matches');
        this.messages = configLoader.get('messages');
    }

    getCandidates = async (req, res) => {
        try {
            const currentUser = await User.findById(req.userId);
            if (!currentUser) {
                return res.status(404).json({ error: this.messages.userNotFound });
            }

            const excludedIds = [
                currentUser._id,
                ...currentUser.likes,
                ...currentUser.dislikes,
                ...currentUser.friends
            ];

            const candidates = await User.find({ _id: { $nin: excludedIds } })
                .select(this.matchCfg.publicFields)
                .limit(this.matchCfg.candidatesLimit);

            res.json(candidates);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    swipe = async (req, res) => {
        try {
            const { targetUserId, direction } = req.body;
            const currentUserId = req.userId;

            if (!targetUserId || !direction) {
                return res.status(400).json({ error: this.messages.missingFields });
            }

            if (currentUserId === targetUserId) {
                return res.status(400).json({ error: this.messages.selfSwipeError });
            }

            const currentUser = await User.findById(currentUserId);
            const targetUser = await User.findById(targetUserId);

            if (!targetUser) {
                return res.status(404).json({ error: this.messages.targetNotFound });
            }

            if (direction === this.matchCfg.swipeLeft) {
                const alreadyDisliked = currentUser.dislikes.some(id => id.equals(targetUserId));
                if (!alreadyDisliked) {
                    currentUser.dislikes.push(targetUserId);
                    await currentUser.save();
                }
                return res.json({ status: 'rejected', match: false });
            }

            if (direction === this.matchCfg.swipeRight) {
                const alreadyLiked = currentUser.likes.some(id => id.equals(targetUserId));
                if (!alreadyLiked) {
                    currentUser.likes.push(targetUserId);
                }

                const isMutual = targetUser.likes.some(id => id.equals(currentUserId));

                if (isMutual) {
                    if (!currentUser.friends.some(id => id.equals(targetUserId))) {
                        currentUser.friends.push(targetUserId);
                    }
                    if (!targetUser.friends.some(id => id.equals(currentUserId))) {
                        targetUser.friends.push(currentUserId);
                    }

                    await currentUser.save();
                    await targetUser.save();

                    return res.json({
                        status: 'matched',
                        match: true,
                        friend: {
                            _id: targetUser._id,
                            name: targetUser.name,
                            profileImage: targetUser.profileImage,
                            bio: targetUser.bio,
                            age: targetUser.age
                        }
                    });
                }

                await currentUser.save();
                return res.json({ status: 'liked', match: false });
            }

            return res.status(400).json({ error: this.messages.invalidDirection });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    getFriends = async (req, res) => {
        try {
            const user = await User.findById(req.userId).populate('friends', this.matchCfg.friendFields);
            if (!user) {
                return res.status(404).json({ error: this.messages.userNotFound });
            }

            res.json(user.friends);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };
}

module.exports = MatchController;