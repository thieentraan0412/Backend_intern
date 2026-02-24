const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// GET /api/profile/me — get own profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/profile/me — update profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { name, age, gender, bio } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (age !== undefined) updates.age = age;
    if (gender !== undefined) updates.gender = gender;
    if (bio !== undefined) updates.bio = bio;

    // Check if profile is now complete
    const currentUser = req.user;
    const mergedAge = age ?? currentUser.age;
    const mergedGender = gender ?? currentUser.gender;
    const mergedBio = bio ?? currentUser.bio;

    if (mergedAge && mergedGender && mergedBio) {
      updates.profileComplete = true;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ message: 'Profile updated.', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
