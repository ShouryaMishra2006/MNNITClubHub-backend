const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  contactNumber: String,
  password: { type: String, required: true },
  jobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
});

module.exports = mongoose.model("Company", companySchema);
