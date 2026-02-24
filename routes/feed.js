const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// GET /api/feed — get all users except current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
    }).select('-passwordHash');

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
