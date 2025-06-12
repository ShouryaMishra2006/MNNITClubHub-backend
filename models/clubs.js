const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  president: { type: String },
  username:{type:String},
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  memberCount: { type: Number, default: 0 }, 
  imageUrl:{type:String},
});

module.exports = mongoose.model('Club', clubSchema);
