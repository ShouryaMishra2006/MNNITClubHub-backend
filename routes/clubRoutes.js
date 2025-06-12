const express = require('express');
const Club = require('../models/clubs');
const router = express.Router();
const clubController = require('../controllers/clubController');
router.post('/createClub', clubController.createClub);
router.get('/clubs', clubController.getClubs); 
router.get('/yourclubs',clubController.getyourclubs)
router.get('/joinedclubs', clubController.getJoinedclubs);
router.get('/clubs/:clubId', clubController.getClubById);
router.get('/club/:clubId/messages',clubController.getMessages);
router.post('/club/:clubId/messages',clubController.saveMessages);
router.post('/club/join',clubController.JoinClub);
router.post('/club/getclubmembersnames',clubController.getclubmembersnames)
module.exports = router;

