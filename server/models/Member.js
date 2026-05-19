const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ["Membre", "Admin"],
      trim: true,
      default: "Membre",
    },
    status: {
      type: String,
      enum: ["invite", "active"],
      default: "invite",
    },
  },
  { timestamps: true },
);

memberSchema.index({ project: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Member", memberSchema);
