const Task = require("../models/Task");
const mongoose = require("mongoose");

const getDashboardStats = async (req, res) => {

  try {

    const userId = req.user.id;

    const stats = await Task.aggregate([

      {
        $match: {
          assignedTo: new mongoose.Types.ObjectId(req.user.id)
        }
      },

      {
        $group: {

          _id: null,

          totalTasks: {
            $sum: 1
          },

          completedTasks: {
            $sum: {
              $cond: [
                { $eq: ["$status", "terminé"] },
                1,
                0
              ]
            }
          },

          inProgressTasks: {
            $sum: {
              $cond: [
                { $eq: ["$status", "en cours"] },
                1,
                0
              ]
            }
          },

          todoTasks: {
            $sum: {
              $cond: [
                { $eq: ["$status", "à faire"] },
                1,
                0
              ]
            }
          }

        }
      }

    ]);

    res.status(200).json(stats[0]);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

module.exports = { getDashboardStats };