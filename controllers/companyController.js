const Company = require("../models/Company");
const Job = require("../models/Job");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { spawn } = require("child_process");
const nodemailer = require("nodemailer");
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const mongoose = require("mongoose");
const { truncateSync } = require("fs");
const { OpenAIEmbeddings } = require("@langchain/openai");
const path = require("path");
const fs = require("fs");
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}
exports.registerCompany = async (req, res) => {
  try {
    console.log("yes i am here");
    const { name, email, contactNumber, password } = req.body;

    const existing = await Company.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Company already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const company = await Company.create({
      name,
      email,
      contactNumber,
      password: hashedPassword,
    });
    console.log(company);
    res
      .status(201)
      .json({ message: "Registered successfully", companyId: company._id });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.loginCompany = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("yessss");
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: company._id }, JWT_SECRET, {
      expiresIn: "2d",
    });

    res.status(200).json({ message: "Login successful", token, company });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.getCompanyJobs = async (req, res) => {
  try {
    const { company } = req.body;

    if (!company) {
      return res.status(400).json({ message: "Company  is required" });
    }

    const jobs = await Job.find({ company: company });

    res.status(200).json(jobs);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching jobs", error: err.message });
  }
};
exports.createJob = async (req, res) => {
  const { description, companyId } = req.body;
  // console.log(description)
  if (!description || !companyId) {
    return res
      .status(400)
      .json({ message: "Description and companyId are required" });
  }

  try {
    const python = spawn("python", ["llm/extract_features.py"]);

    const inputData = {
      description,
      job_id: new mongoose.Types.ObjectId().toString(),
    };

    python.stdin.write(JSON.stringify(inputData));
    python.stdin.end();

    let data = "";
    python.stdout.on("data", (chunk) => {
      data += chunk.toString();
    });
    console.log(data);
    python.stderr.on("data", (error) => {
      console.error(`Python error: ${error}`);
    });

    python.on("close", async (code) => {
      try {
        console.log("Raw LLM output:", data);
        const features = JSON.parse(data);
        console.log(features);
        if (features.error) {
          console.error("LLM Error:", features.error);
          return res.status(500).json({
            message: "LLM returned invalid output",
            raw: features.raw_output,
          });
        }

        const newJob = new Job({
          description,
          llmExtractedFeatures: Object.values(features).flatMap((val) =>
            Array.isArray(val) ? val : [val]
          ),
          company: companyId,
        });

        await newJob.save();
        return res.status(201).json(newJob);
      } catch (error) {
        console.error("Failed to parse LLM output or save job:", error);
        return res
          .status(500)
          .json({ message: "LLM parsing or saving failed" });
      }
    });
  } catch (err) {
    console.error("Job creation error:", err);
    res.status(500).json({ message: "Server error during job creation" });
  }
};
exports.getAlljobs = async (req, res) => {
  try {
    const jobs = await Job.find({ open: true }).sort({ createdAt: -1 }); // newest first

    res.status(200).json({ jobs });
    console.log(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};
exports.uploadResume = async (req, res) => {
  try {
    console.log("Current directory:", process.cwd());

    const resumePath = path.join(req.file.path).replace(/\\/g, "/");
    const jobId = req.body.jobId;

    if (!jobId || !resumePath) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Resume path:", resumePath);
    console.log("Job ID:", jobId);

    const pythonScriptPath = path.join(
      __dirname,
      "../llm/extract_resume_features.py"
    );
    console.log("Python script path:", pythonScriptPath);

    const child = spawn("python", [pythonScriptPath]);

    const input = JSON.stringify({
      resume_path: resumePath,
      job_id: jobId,
    });

    let output = "";
    let error = "";

    child.stdin.write(input);
    child.stdin.end();

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      console.error("Python stderr:", data.toString());
      error += data.toString();
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        console.log("Python exit code:", code);
        return res.status(500).json({
          error: "Python script failed",
          details: error || output,
        });
      }

      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/); 
        if (!jsonMatch) {
          return res.status(500).json({
            error: "No JSON object found in Python output",
            raw: output,
          });
        }

        const cleanedOutput = jsonMatch[0];
        const result = JSON.parse(cleanedOutput);

        console.log("Extracted result:", result);


        const parsedFeatures = [
          ...(result.Education || []),
          ...(result.Experiences || []),
          ...(result.Skills || []),
          ...(result["Core Qualifications"] || []),
          `Full Name: ${result["Full Name"] || ""}`,
          `Phone Number: ${result["Phone Number"] || ""}`,
          `Email: ${result.Email || ""}`,
        ];

        const resumeUrl = resumePath; 

        await Job.findByIdAndUpdate(
          jobId,
          {
            $push: {
              resumeFolders: resumeUrl,
              topResumes: {
                studentEmail: result.Email,
                parsedFeatures: parsedFeatures,
                resumeUrl: resumeUrl,
              },
            },
          },
          { new: true }
        );

        return res.status(200).json({
          message: "Resume processed and saved successfully",
          features: parsedFeatures,
        });
      } catch (parseErr) {
        return res.status(500).json({
          error: "Failed to parse Python output",
          raw: output,
          details: parseErr.message,
        });
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
exports.resumescore = async (req, res) => {
  const { jobId, resumeIndex } = req.body;

  try {
    const job = await Job.findById(jobId);
    if (!job || !job.topResumes[resumeIndex]) {
      return res.status(404).json({ error: "Job or resume not found" });
    }

    const jobText = job.llmExtractedFeatures.join(", ");
    const resumeText = job.topResumes[resumeIndex].parsedFeatures.join(", ");

    const child = spawn("python", ["llm/embedder.py"]);

    const input = JSON.stringify({
      job_text: jobText,
      resume_text: resumeText,
    });

    let output = "",
      error = "";
    child.stdin.write(input);
    child.stdin.end();

    child.stdout.on("data", (data) => (output += data.toString()));
    child.stderr.on("data", (data) => (error += data.toString()));

    child.on("close", () => {
      if (error) return res.status(500).json({ error });

      const { job_embedding, resume_embedding } = JSON.parse(output);

      function cosineSimilarity(vecA, vecB) {
        const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return magA && magB ? dot / (magA * magB) : 0;
      }

      const score = cosineSimilarity(job_embedding, resume_embedding);
      res.json({ score: score.toFixed(4) });
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to compute similarity" });
  }
};
exports.sendShortlistEmail = async (req, res) => {
  const { jobId, resumeIndex } = req.body;

  try {
    const job = await Job.findById(jobId);
    if (!job || !job.topResumes[resumeIndex]) {
      return res.status(404).json({ error: "Job or resume not found" });
    }

    const candidate = job.topResumes[resumeIndex];
    const email = candidate.studentEmail;
    console.log(email);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"MNNIT Placement Cell" <${process.env.EMAIL_ID}>`,
      to: email,
      subject: "Shortlisted for Job Opportunity!",
      html: `
        <p>Dear Candidate,</p>
        <p>We are pleased to inform you that you have been <b>shortlisted</b> for the job you applied to!</p>
        <p><strong>Job Description:</strong> ${job.description}</p>
        <p>We will get back to you shortly with further steps.</p>
        <br>
        <p>Regards,<br>MNNIT Placement Team</p>
      `,
    };
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Shortlist email sent successfully" });
  } catch (err) {
    console.error("Email error:", err.message);
    res.status(500).json({ error: "Failed to send email" });
  }
};
exports.changestatus = async (req, res) => {
  const { jobId, open } = req.body;
  try {
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { open },
      { new: true }
    );
    res.json(updatedJob);
  } catch (err) {
    console.error("Error updating job status:", err);
    res.status(500).json({ error: "Failed to update job status" });
  }
};
