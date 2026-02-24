const express = require('express');
const Availability = require('../models/Availability');
const Match = require('../models/Match');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// ── Helper: convert "HH:MM" to total minutes for comparison ──────────────────
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// ── First Common Slot Algorithm ───────────────────────────────────────────────
const findFirstCommonSlot = (slotsA, slotsB) => {
  // Sort both by date then startTime
  const sort = (slots) =>
    [...slots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return toMinutes(a.startTime) - toMinutes(b.startTime);
    });

  const sortedA = sort(slotsA);
  const sortedB = sort(slotsB);

  for (const slotA of sortedA) {
    for (const slotB of sortedB) {
      // Must be the same date
      if (slotA.date !== slotB.date) continue;

      const overlapStart = Math.max(toMinutes(slotA.startTime), toMinutes(slotB.startTime));
      const overlapEnd = Math.min(toMinutes(slotA.endTime), toMinutes(slotB.endTime));

      if (overlapStart < overlapEnd) {
        // Convert minutes back to "HH:MM"
        const fmt = (mins) =>
          `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

        return {
          date: slotA.date,
          startTime: fmt(overlapStart),
          endTime: fmt(overlapEnd),
        };
      }
    }
  }

  return null;
};

// ── POST /api/availability/:matchId — submit/update availability ──────────────
router.post('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { slots } = req.body;

    // Verify the match exists and includes this user
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found.' });

    const isParticipant = match.users.some(
      (uid) => uid.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not part of this match.' });
    }

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'Slots array is required.' });
    }

    // Upsert availability for this user in this match
    const availability = await Availability.findOneAndUpdate(
      { matchId, userId: req.user._id },
      { matchId, userId: req.user._id, slots },
      { upsert: true, new: true }
    );

    res.json({ message: 'Availability saved.', availability });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ── GET /api/availability/:matchId/common-slot — find the first common slot ───
router.get('/:matchId/common-slot', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found.' });

    const isParticipant = match.users.some(
      (uid) => uid.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not part of this match.' });
    }

    // Fetch both availabilities
    const allAvailabilities = await Availability.find({ matchId });

    if (allAvailabilities.length < 2) {
      return res.json({
        ready: false,
        message: 'Waiting for the other person to submit their availability.',
      });
    }

    const [availA, availB] = allAvailabilities;
    const commonSlot = findFirstCommonSlot(availA.slots, availB.slots);

    if (commonSlot) {
      // Format date to Vietnamese-friendly display
      const dateObj = new Date(commonSlot.date + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return res.json({
        ready: true,
        found: true,
        message: `Hai bạn có date hẹn vào: ${formattedDate} ${commonSlot.startTime}`,
        slot: commonSlot,
      });
    }

    return res.json({
      ready: true,
      found: false,
      message: 'Chưa tìm được thời gian trùng. Vui lòng chọn lại.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ── GET /api/availability/:matchId — get my availability for a match ──────────
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const availability = await Availability.findOne({
      matchId: req.params.matchId,
      userId: req.user._id,
    });

    res.json({ availability });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;
