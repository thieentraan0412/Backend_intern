const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
  },
  { timestamps: true }
);

// Ensure each pair only has one match record
matchSchema.index({ users: 1 });

module.exports = mongoose.model('Match', matchSchema);
