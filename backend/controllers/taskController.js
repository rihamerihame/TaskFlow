const Task = require("../models/Task");
const Notification = require("../models/Notification");
const createTask = async (req, res) => {

  try {

    const { title, priority, status, assignedTo } = req.body;

    const task = await Task.create({
      title,
      priority,
      status,
      assignedTo
    });
    await Notification.create({

        message: `New task assigned: ${task.title}`,

        user: assignedTo

    });

    res.status(201).json(task);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

const getTasks = async (req, res) => {

  try {

    const {
      status,
      priority,
      search,
      page = 1,
      limit = 5
    } = req.query;

    let filter = {

      assignedTo: req.user.id

    };

    if (status) {

      filter.status = status;

    }

    if (priority) {

      filter.priority = priority;

    }

    if (search) {

      filter.title = {

        $regex: search,
        $options: "i"

      };

    }

    const tasks = await Task.find(filter)

      .populate("assignedTo", "fullName email")

      .skip((page - 1) * limit)

      .limit(Number(limit));

    res.status(200).json(tasks);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

module.exports = { createTask, getTasks };
