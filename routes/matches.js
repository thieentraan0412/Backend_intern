const express = require('express');
const Match = require('../models/Match');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// GET /api/matches — get all matches for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
    }).populate('users', '-passwordHash');

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
