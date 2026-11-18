const Home = require('../models/homes');
const User = require('../models/user');
const path = require('path');
const rootDir = require('../utils/pathUtil');
const { getActiveUser } = require('./authController');

// ================= HOMES ================= //

// GET /api/homes
exports.getAllHomes = async (req, res, next) => {
    try {
        const { search, location, minPrice, maxPrice } = req.query;
        let query = {};

        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }
        if (search) {
            query.$or = [
                { houseName: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        const homes = await Home.find(query).select('-photoBuffer -rulesBuffer');
        return res.status(200).json({
            success: true,
            count: homes.length,
            homes: homes
        });
    } catch (err) {
        console.error('API getAllHomes Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching homes',
            error: err.message
        });
    }
};

// GET /api/homes/:homeId
exports.getHomeById = async (req, res, next) => {
    try {
        const { homeId } = req.params;
        const home = await Home.findById(homeId).select('-photoBuffer -rulesBuffer');
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }
        return res.status(200).json({
            success: true,
            home: home
        });
    } catch (err) {
        console.error('API getHomeById Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching home details',
            error: err.message
        });
    }
};

// GET /api/homes/:homeId/rules
exports.getHouseRules = async (req, res, next) => {
    try {
        const { homeId } = req.params;
        const home = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        if (home.rulesBuffer) {
            res.setHeader('Content-Type', home.rulesMimeType || 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${home.houseName} Rules.pdf"`);
            return res.send(home.rulesBuffer);
        }

        if (home.rules) {
            const filePath = path.join(rootDir, home.rules);
            return res.download(filePath, `${home.houseName} Rules.pdf`, (err) => {
                if (err && !res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Error downloading rules file'
                    });
                }
            });
        }

        return res.status(404).json({
            success: false,
            message: 'No rules file found for this home'
        });
    } catch (err) {
        console.error('API getHouseRules Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching house rules',
            error: err.message
        });
    }
};

// ================= BOOKINGS ================= //

// GET /api/bookings
exports.getBookings = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to view bookings'
            });
        }

        const populatedUser = await User.findById(user._id)
            .populate({
                path: 'bookings.home',
                select: '-photoBuffer -rulesBuffer'
            });

        const bookings = populatedUser ? populatedUser.bookings : [];
        return res.status(200).json({
            success: true,
            count: bookings.length,
            bookings: bookings
        });
    } catch (err) {
        console.error('API getBookings Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: err.message
        });
    }
};

// POST /api/bookings/reserve/:homeId
exports.createBooking = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to make a booking'
            });
        }

        const { homeId } = req.params;
        const home = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        const {
            checkIn,
            checkOut,
            adults,
            children,
            infants,
            pets,
            totalNights,
            totalPrice,
            paymentMethod,
            specialRequests,
            addOns
        } = req.body;

        const parsedAddOns = Array.isArray(addOns) ? addOns : (addOns ? [addOns] : []);

        const newBooking = {
            home: homeId,
            checkIn: checkIn || new Date().toISOString().split('T')[0],
            checkOut: checkOut || new Date().toISOString().split('T')[0],
            guests: {
                adults: parseInt(adults, 10) || 1,
                children: parseInt(children, 10) || 0,
                infants: parseInt(infants, 10) || 0,
                pets: pets === 'on' || pets === 'true' || pets === true
            },
            totalNights: parseInt(totalNights, 10) || 1,
            totalPrice: parseFloat(totalPrice) || (home.price * (parseInt(totalNights, 10) || 1)),
            paymentMethod: paymentMethod || 'Card',
            specialRequests: specialRequests || '',
            addOns: parsedAddOns
        };

        user.bookings.push(newBooking);
        await user.save();

        const createdBooking = user.bookings[user.bookings.length - 1];

        return res.status(201).json({
            success: true,
            message: 'Booking confirmed successfully',
            booking: createdBooking
        });
    } catch (err) {
        console.error('API createBooking Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error making reservation',
            error: err.message
        });
    }
};

// DELETE /api/bookings/:bookingId
exports.cancelBooking = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to cancel a booking'
            });
        }

        const { bookingId } = req.params;
        const initialCount = user.bookings.length;
        user.bookings = user.bookings.filter(b => b._id.toString() !== bookingId);

        if (user.bookings.length === initialCount) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully'
        });
    } catch (err) {
        console.error('API cancelBooking Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error cancelling booking',
            error: err.message
        });
    }
};

// ================= FAVOURITES ================= //

// GET /api/favourites
exports.getFavourites = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to view favourites'
            });
        }

        const populatedUser = await User.findById(user._id)
            .populate({
                path: 'favourites',
                select: '-photoBuffer -rulesBuffer'
            });

        const favourites = populatedUser ? populatedUser.favourites : [];
        return res.status(200).json({
            success: true,
            count: favourites.length,
            favourites: favourites
        });
    } catch (err) {
        console.error('API getFavourites Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching favourites',
            error: err.message
        });
    }
};

// POST /api/favourites
exports.addFavourite = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to add to favourites'
            });
        }

        const homeId = req.params.homeId || req.body.homeId || req.body.id;
        if (!homeId) {
            return res.status(400).json({
                success: false,
                message: 'homeId is required'
            });
        }

        const home = await Home.findById(homeId);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        const alreadyFavourite = user.favourites.some(favId => favId.toString() === homeId.toString());
        if (!alreadyFavourite) {
            user.favourites.push(homeId);
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Home added to favourites',
            favourites: user.favourites
        });
    } catch (err) {
        console.error('API addFavourite Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error adding favourite',
            error: err.message
        });
    }
};

// DELETE /api/favourites/:homeId
exports.removeFavourite = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to remove favourite'
            });
        }

        const { homeId } = req.params;
        user.favourites = user.favourites.filter(favId => favId.toString() !== homeId.toString());
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Home removed from favourites',
            favourites: user.favourites
        });
    } catch (err) {
        console.error('API removeFavourite Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error removing favourite',
            error: err.message
        });
    }
};

// ================= USER PROFILE ================= //

// GET /api/profile
exports.getProfile = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userProfile = await User.findById(user._id)
            .populate({
                path: 'favourites',
                select: '-photoBuffer -rulesBuffer'
            })
            .populate({
                path: 'bookings.home',
                select: '-photoBuffer -rulesBuffer'
            })
            .populate({
                path: 'myHomes',
                select: '-photoBuffer -rulesBuffer'
            })
            .select('-password -profilePicBuffer');

        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        return res.status(200).json({
            success: true,
            user: userProfile
        });
    } catch (err) {
        console.error('API getProfile Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: err.message
        });
    }
};

// PUT /api/profile
exports.updateProfile = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { firstName, lastName, phone, location, occupation, bio, languages } = req.body;

        if (firstName !== undefined && firstName.trim() !== '') {
            user.firstName = firstName.trim();
        }
        if (lastName !== undefined) {
            user.lastName = lastName.trim();
        }
        if (phone !== undefined) {
            user.phone = phone.trim();
        }
        if (location !== undefined) {
            user.location = location.trim();
        }
        if (occupation !== undefined) {
            user.occupation = occupation.trim();
        }
        if (bio !== undefined) {
            user.bio = bio.trim();
        }
        if (languages !== undefined) {
            user.languages = languages.trim();
        }

        if (req.files && req.files.profilePic && req.files.profilePic[0]) {
            const profilePicFile = req.files.profilePic[0];
            user.profilePicBuffer = profilePicFile.buffer;
            user.profilePicMimeType = profilePicFile.mimetype;
            user.profilePic = `/user/avatar/${user._id}`;
        }

        await user.save();

        if (req.session) {
            req.session.user = JSON.parse(JSON.stringify(user));
        }

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.profilePicBuffer;

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: userResponse
        });
    } catch (err) {
        console.error('API updateProfile Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: err.message
        });
    }
};
