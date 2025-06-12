const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
router.post('/createEvent', eventController.createEvent);
router.get('/clubs/:clubId/events', eventController.getEventsByClubId);
router.get('/events', eventController.getEvents);
router.post('/events/:eventId/:username/register',eventController.registerEvent);
module.exports = router;

