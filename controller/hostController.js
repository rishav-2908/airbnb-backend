const Home = require('../models/homes');
const User = require('../models/user');
const { getActiveUser } = require('./authController');

const randomString = (length) => {
    const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// GET /api/host/homes
exports.getHostHomes = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required for host actions'
            });
        }
        if (user.userType !== 'host') {
            return res.status(403).json({
                success: false,
                message: 'Access restricted to hosts only'
            });
        }

        const populatedUser = await User.findById(user._id).populate({
            path: 'myHomes',
            select: '-photoBuffer -rulesBuffer'
        });

        const hostHomes = populatedUser ? populatedUser.myHomes : [];
        return res.status(200).json({
            success: true,
            count: hostHomes.length,
            homes: hostHomes
        });
    } catch (err) {
        console.error('API getHostHomes Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching host homes',
            error: err.message
        });
    }
};

// POST /api/host/homes
exports.addHome = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required for host actions'
            });
        }
        if (user.userType !== 'host') {
            return res.status(403).json({
                success: false,
                message: 'Access restricted to hosts only'
            });
        }

        const { houseName, price, location, rating, description } = req.body;
        const photoFile = req.files && req.files['photo'] ? req.files['photo'][0] : null;
        const rulesFile = req.files && req.files['rules'] ? req.files['rules'][0] : null;

        const numericPrice = Number(price);
        if (!houseName || !price || !location || !Number.isFinite(numericPrice) || numericPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'House name, location, and a valid non-negative price are required'
            });
        }

        if (!photoFile) {
            return res.status(400).json({
                success: false,
                message: 'A photo is required for the listing'
            });
        }

        const photoName = randomString(10) + '-' + photoFile.originalname;
        const normalizedPhotoPath = 'uploads/' + photoName;

        let normalizedRulesPath = '';
        let rulesBuffer = null;
        let rulesMimeType = '';

        if (rulesFile) {
            const rulesName = `rules-${randomString(10)}.pdf`;
            normalizedRulesPath = 'rules/' + rulesName;
            rulesBuffer = rulesFile.buffer;
            rulesMimeType = rulesFile.mimetype;
        }

        const home = new Home({
            owner: user._id,
            houseName: houseName.trim(),
            price: numericPrice,
            location: location.trim(),
            rating: rating ? Number(rating) : 0,
            photo: normalizedPhotoPath,
            photoBuffer: photoFile.buffer,
            photoMimeType: photoFile.mimetype,
            description: description || '',
            rules: normalizedRulesPath,
            rulesBuffer,
            rulesMimeType
        });

        const savedHome = await home.save();

        if (!user.myHomes.includes(savedHome._id)) {
            user.myHomes.push(savedHome._id);
            await user.save();
        }

        const homeResponse = savedHome.toObject();
        delete homeResponse.photoBuffer;
        delete homeResponse.rulesBuffer;

        return res.status(201).json({
            success: true,
            message: 'Home listed successfully',
            home: homeResponse
        });
    } catch (err) {
        console.error('API addHome Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error creating home listing',
            error: err.message
        });
    }
};

// GET /api/host/homes/:homeId
exports.getHome = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user || user.userType !== 'host') {
            return res.status(403).json({ success: false, message: 'Host access required' });
        }
        const { homeId } = req.params;
        const home = await Home.findById(homeId).select('-photoBuffer -rulesBuffer');
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }
        if (!home.owner || home.owner.toString() !== user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You do not own this listing' });
        }
        return res.status(200).json({
            success: true,
            home: home
        });
    } catch (err) {
        console.error('API getHome Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching home',
            error: err.message
        });
    }
};

// PUT /api/host/homes/:homeId
exports.updateHome = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const homeId = req.params.homeId || req.body.id;
        const { houseName, price, location, rating, description } = req.body;
        const photoFile = req.files && req.files['photo'] ? req.files['photo'][0] : null;
        const rulesFile = req.files && req.files['rules'] ? req.files['rules'][0] : null;

        const home = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }
        if (user.userType !== 'host' || !home.owner || home.owner.toString() !== user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You do not own this listing' });
        }

        if (houseName !== undefined) home.houseName = houseName.trim();
        if (price !== undefined) {
            const numericPrice = Number(price);
            if (!Number.isFinite(numericPrice) || numericPrice < 0) {
                return res.status(400).json({ success: false, message: 'Price must be non-negative' });
            }
            home.price = numericPrice;
        }
        if (location !== undefined) home.location = location.trim();
        if (rating !== undefined) {
            const numericRating = Number(rating);
            if (!Number.isFinite(numericRating) || numericRating < 0 || numericRating > 5) {
                return res.status(400).json({ success: false, message: 'Rating must be between 0 and 5' });
            }
            home.rating = numericRating;
        }
        if (description !== undefined) home.description = description.trim();

        if (photoFile) {
            const photoName = randomString(10) + '-' + photoFile.originalname;
            home.photo = 'uploads/' + photoName;
            home.photoBuffer = photoFile.buffer;
            home.photoMimeType = photoFile.mimetype;
        }

        if (rulesFile) {
            const rulesName = `rules-${randomString(10)}.pdf`;
            home.rules = 'rules/' + rulesName;
            home.rulesBuffer = rulesFile.buffer;
            home.rulesMimeType = rulesFile.mimetype;
        }

        await home.save();

        const homeResponse = home.toObject();
        delete homeResponse.photoBuffer;
        delete homeResponse.rulesBuffer;

        return res.status(200).json({
            success: true,
            message: 'Home updated successfully',
            home: homeResponse
        });
    } catch (err) {
        console.error('API updateHome Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error updating home listing',
            error: err.message
        });
    }
};

// DELETE /api/host/homes/:homeId
exports.deleteHome = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { homeId } = req.params;
        const home = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({ success: false, message: 'Home not found' });
        }
        if (user.userType !== 'host' || !home.owner || home.owner.toString() !== user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You do not own this listing' });
        }
        await Home.findByIdAndDelete(homeId);
        await User.updateMany(
            {},
            { $pull: { favourites: homeId, myHomes: homeId } }
        );

        return res.status(200).json({
            success: true,
            message: 'Home deleted successfully'
        });
    } catch (err) {
        console.error('API deleteHome Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error deleting home',
            error: err.message
        });
    }
};
