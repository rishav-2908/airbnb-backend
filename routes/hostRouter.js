const express = require('express');
const router = express.Router();
const hostController = require('../controller/hostController');

router.get('/homes', hostController.getHostHomes);
router.get('/my-homes', hostController.getHostHomes);
router.post('/homes', hostController.addHome);
router.get('/homes/:homeId', hostController.getHome);
router.put('/homes/:homeId', hostController.updateHome);
router.post('/homes/edit/:homeId', hostController.updateHome);
router.delete('/homes/:homeId', hostController.deleteHome);
router.post('/homes/delete/:homeId', hostController.deleteHome);

module.exports = router;
