const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not configured');
    }
    return process.env.JWT_SECRET;
};

const issueToken = (user) => jwt.sign(
    { sub: user._id.toString(), userType: user.userType },
    getJwtSecret(),
    { expiresIn: '7d', issuer: 'airbnb-api', audience: 'airbnb-web' }
);

const getActiveUser = async (req) => {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) return null;

    try {
        const payload = jwt.verify(
            authorization.slice(7),
            getJwtSecret(),
            { issuer: 'airbnb-api', audience: 'airbnb-web' }
        );
        return await User.findById(payload.sub);
    } catch (err) {
        return null;
    }
};

exports.getActiveUser = getActiveUser;

// POST /api/auth/signup
exports.signup = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, userType, terms } = req.body;

        const errors = [];
        if (!firstName || firstName.trim().length < 2) {
            errors.push('First name should be at least 2 characters long');
        }
        if (firstName && !/^[A-Za-z\s]+$/.test(firstName.trim())) {
            errors.push('First name should contain only alphabets');
        }
        if (lastName && !/^[A-Za-z\s]*$/.test(lastName.trim())) {
            errors.push('Last name should contain only alphabets');
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.push('Please enter a valid email');
        }
        if (!password || password.length < 8) {
            errors.push('Password should be at least 8 characters long');
        } else {
            if (!/[A-Z]/.test(password)) errors.push('Password should contain at least one uppercase letter');
            if (!/[a-z]/.test(password)) errors.push('Password should contain at least one lowercase letter');
            if (!/[0-9]/.test(password)) errors.push('Password should contain at least one number');
            if (!/[!@#$%^&*()_.,?\/|()<>:;]/.test(password)) errors.push('Password should contain at least one special character');
        }
        if (confirmPassword !== undefined && confirmPassword !== password) {
            errors.push('Passwords do not match');
        }
        if (!userType || !['guest', 'host'].includes(userType)) {
            errors.push('User type must be either guest or host');
        }
        if (terms !== undefined && terms !== 'on' && terms !== true && terms !== 'true') {
            errors.push('Please accept the terms and conditions');
        }

        if (errors.length > 0) {
            return res.status(422).json({
                success: false,
                message: errors[0],
                errors: errors
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists',
                errors: ['A user with this email already exists']
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            firstName: firstName.trim(),
            lastName: lastName ? lastName.trim() : '',
            email: normalizedEmail,
            password: hashedPassword,
            userType: userType
        });

        const savedUser = await user.save();

        const userResponse = {
            _id: savedUser._id,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            email: savedUser.email,
            userType: savedUser.userType
        };

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: userResponse
        });
    } catch (err) {
        console.error('API Signup Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error during signup',
            error: err.message
        });
    }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                errors: ['Email and password are required']
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User does not exist',
                errors: ['User does not exist']
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password',
                errors: ['Invalid password']
            });
        }

        const userResponse = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            userType: user.userType,
            profilePic: user.profilePic || ''
        };

        const token = issueToken(user);
        return res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            user: userResponse,
            token
        });
    } catch (err) {
        console.error('API Login Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: err.message
        });
    }
};

// POST /api/auth/logout
exports.logout = (req, res, next) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error('API Logout Error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error during logout'
                });
            }
            res.clearCookie('connect.sid');
            return res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    } else {
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
    try {
        const user = await getActiveUser(req);
        if (!user) {
            return res.status(200).json({
                success: true,
                isLoggedIn: false,
                user: null
            });
        }

        return res.status(200).json({
            success: true,
            isLoggedIn: true,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                userType: user.userType,
                phone: user.phone,
                location: user.location,
                occupation: user.occupation,
                bio: user.bio,
                languages: user.languages,
                profilePic: user.profilePic,
                joinedDate: user.joinedDate
            }
        });
    } catch (err) {
        console.error('API getMe Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving user session',
            error: err.message
        });
    }
};
