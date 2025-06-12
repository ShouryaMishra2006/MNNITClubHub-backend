const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  club:{
    type:String,
    required:true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  attendees: {
    type: Number,
    default: 0,
  }
});

module.exports = mongoose.model('Event', eventSchema);
