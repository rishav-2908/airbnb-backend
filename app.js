const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const DB_PATH = (process.env.DB_PATH || '').replace(/^["']|["']$/g, '').trim();

const authRouter = require('./routes/authRouter');
const storeRouter = require('./routes/storeRouter');
const hostRouter = require('./routes/hostRouter');
const rootDir = require('./utils/pathUtil');
const { default: mongoose } = require('mongoose');

const app = express();

// Enable CORS for frontend and external clients
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Session store
const store = new MongoDBStore({
    uri: DB_PATH,
    collection: 'sessions'
});

store.on('error', function (error) {
    console.error('Session store error:', error);
});

// File upload filter
const uploadFileFilter = (req, file, cb) => {
    if (file.fieldname === 'photo' || file.fieldname === 'profilePic') {
        if (file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
            cb(null, true);
        } else {
            cb(null, false);
        }
    } else if (file.fieldname === 'rules') {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false);
        }
    } else {
        cb(null, false);
    }
};

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: uploadFileFilter
}).fields([
    { name: 'photo', maxCount: 1 },
    { name: 'profilePic', maxCount: 1 },
    { name: 'rules', maxCount: 1 }
]);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(upload);

// Serve photos from MongoDB database buffer if stored there, fallback to disk
const servePhoto = (req, res, next) => {
    const dbPath = 'uploads/' + req.params.filename;
    mongoose.model('Home').findOne({ photo: dbPath }).then(home => {
        if (home && home.photoBuffer) {
            res.setHeader('Content-Type', home.photoMimeType || 'image/jpeg');
            return res.send(home.photoBuffer);
        }
        next();
    }).catch(err => next());
};

const serveProfilePic = (req, res, next) => {
    const userId = req.params.userId;
    mongoose.model('User').findById(userId).then(user => {
        if (user && user.profilePicBuffer) {
            res.setHeader('Content-Type', user.profilePicMimeType || 'image/jpeg');
            return res.send(user.profilePicBuffer);
        }
        next();
    }).catch(err => next());
};

app.get('/user/avatar/:userId', serveProfilePic);
app.get('/uploads/:filename', servePhoto);
app.get('/host/uploads/:filename', servePhoto);
app.get('/homes/uploads/:filename', servePhoto);

app.use('/uploads', express.static(path.join(rootDir, 'uploads')));
app.use('/host/uploads', express.static(path.join(rootDir, 'uploads')));
app.use('/homes/uploads', express.static(path.join(rootDir, 'uploads')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || "Code with Rishav Singh",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));

app.use((req, res, next) => {
    req.isLoggedIn = req.session ? req.session.isLoggedIn : false;
    next();
});

// Root API Welcome / Health endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Airbnb Backend API is running',
        version: '1.0.0',
        apiDocumentation: '/api'
    });
});

app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Airbnb REST API is running',
        version: '1.0.0',
        endpoints: {
            auth: {
                signup: 'POST /api/auth/signup',
                login: 'POST /api/auth/login',
                logout: 'POST /api/auth/logout',
                me: 'GET /api/auth/me'
            },
            store: {
                homes: 'GET /api/homes',
                homeDetails: 'GET /api/homes/:homeId',
                rules: 'GET /api/rules/:homeId',
                bookings: 'GET /api/bookings',
                reserve: 'POST /api/bookings/reserve/:homeId',
                cancelBooking: 'DELETE /api/bookings/:bookingId',
                favourites: 'GET /api/favourites',
                addFavourite: 'POST /api/favourites/:homeId',
                removeFavourite: 'DELETE /api/favourites/:homeId',
                profile: 'GET /api/profile',
                editProfile: 'PUT /api/profile'
            },
            host: {
                homes: 'GET /api/host/homes',
                addHome: 'POST /api/host/homes',
                homeDetails: 'GET /api/host/homes/:homeId',
                updateHome: 'PUT /api/host/homes/:homeId',
                deleteHome: 'DELETE /api/host/homes/:homeId'
            }
        }
    });
});

// Mount API Routers
app.use('/api/auth', authRouter);
app.use('/api/host', hostRouter);
app.use('/api', storeRouter);
app.use('/api/store', storeRouter);

// 404 Handler for API
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    // console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Backend server running on ${PORT}`);
    // console.log(`API endpoints accessible at http://localhost:${PORT}/api`);
    console.log(`API endpoints accessible at ${PORT}/api`);
});

if (DB_PATH) {
    mongoose.connect(DB_PATH).then(() => {
        console.log("Connected to MongoDB successfully");
    }).catch(err => {
        console.error("MongoDB connection error:", err.message);
    });
} else {
    console.warn("Warning: DB_PATH environment variable is not defined");
}

module.exports = app;
