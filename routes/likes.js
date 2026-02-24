const express = require('express');
const Like = require('../models/Like');
const Match = require('../models/Match');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// POST /api/likes/:userId — like a user and check for mutual match
router.post('/:userId', verifyToken, async (req, res) => {
  try {
    const fromUser = req.user._id;
    const toUser = req.params.userId;

    if (fromUser.toString() === toUser) {
      return res.status(400).json({ message: "You can't like yourself." });
    }

    // Save the like (upsert to avoid duplicates on retry)
    await Like.findOneAndUpdate(
      { fromUser, toUser },
      { fromUser, toUser },
      { upsert: true, new: true }
    );

    // Check for mutual like
    const mutualLike = await Like.findOne({ fromUser: toUser, toUser: fromUser });

    if (mutualLike) {
      // Check if match already exists
      const existingMatch = await Match.findOne({
        users: { $all: [fromUser, toUser] },
      });

      if (!existingMatch) {
        const match = await Match.create({ users: [fromUser, toUser] });
        return res.status(201).json({
          message: "It's a Match! 🎉",
          matched: true,
          matchId: match._id,
        });
      }

      return res.json({
        message: 'Already matched.',
        matched: true,
        matchId: existingMatch._id,
      });
    }

    res.json({ message: 'Like recorded.', matched: false });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/likes/sent — likes that the current user has sent
router.get('/sent', verifyToken, async (req, res) => {
  try {
    const likes = await Like.find({ fromUser: req.user._id }).populate('toUser', '-passwordHash');
    res.json({ likes });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
