const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const upload = require("../middlewares/multer");
router.post("/companies/register", companyController.registerCompany);
router.post("/companies/login", companyController.loginCompany);
router.post("/companies/jobs", companyController.getCompanyJobs);
router.get("/getalljobs",companyController.getAlljobs)
router.post("/companies/createJob",companyController.createJob);
router.post("/companies/resume/upload", upload.single("resume"), companyController.uploadResume);
router.post("/companies/resumescore",companyController.resumescore)
router.post("/companies/send-shortlist-email",companyController.sendShortlistEmail)
router.patch("/companies/toggle-status",companyController.changestatus)
module.exports = router;
