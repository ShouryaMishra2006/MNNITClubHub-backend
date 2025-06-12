const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  llmExtractedFeatures: [String],  
  resumeFolders: [String],         
  topResumes: [                  
    {
      studentEmail: String,
      parsedFeatures: [String],
      resumeUrl: String
    }
  ],
  open: {
    type: Boolean,
    default: true,                 
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true
  },
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);
