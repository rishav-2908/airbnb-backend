const express = require('express');
const router = express.Router();
const storeController = require('../controller/storeController');

// Homes
router.get('/homes', storeController.getAllHomes);
router.get('/homes/:homeId', storeController.getHomeById);
router.get('/homes/:homeId/rules', storeController.getHouseRules);
router.get('/rules/:homeId', storeController.getHouseRules);

// Bookings
router.get('/bookings', storeController.getBookings);
router.post('/bookings/reserve/:homeId', storeController.createBooking);
router.post('/bookings/:homeId', storeController.createBooking);
router.delete('/bookings/:bookingId', storeController.cancelBooking);
router.post('/bookings/cancel/:bookingId', storeController.cancelBooking);

// Favourites
router.get('/favourites', storeController.getFavourites);
router.get('/favourite-list', storeController.getFavourites);
router.post('/favourites', storeController.addFavourite);
router.post('/favourites/:homeId', storeController.addFavourite);
router.delete('/favourites/:homeId', storeController.removeFavourite);
router.post('/favourites/delete/:homeId', storeController.removeFavourite);

// User Profile
router.get('/profile', storeController.getProfile);
router.put('/profile', storeController.updateProfile);
router.post('/profile/edit', storeController.updateProfile);

module.exports = router;
