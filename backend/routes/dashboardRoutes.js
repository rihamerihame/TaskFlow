const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const { getDashboardStats } = require("../controllers/dashboardController");

router.get("/", authMiddleware, getDashboardStats);

module.exports = router;