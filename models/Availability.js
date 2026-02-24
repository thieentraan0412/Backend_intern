const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    startTime: {
      type: String, // "HH:MM"
      required: true,
    },
    endTime: {
      type: String, // "HH:MM"
      required: true,
    },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    slots: [slotSchema],
  },
  { timestamps: true }
);

// Each user can have one availability record per match
availabilitySchema.index({ matchId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Availability', availabilitySchema);
