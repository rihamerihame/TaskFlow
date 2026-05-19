const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      type: String,
      trim: true,
      default: "Systeme",
    },
    details: {
      type: String,
      trim: true,
      default: "",
    },
    targetType: {
      type: String,
      trim: true,
      default: "",
    },
    targetId: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("History", historySchema);
