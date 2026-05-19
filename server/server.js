const path = require("path");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const Project = require("./models/Project");
const Task = require("./models/Task");
const Member = require("./models/Member");
const History = require("./models/History");

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taskflow";
const ALLOWED_PRIORITIES = ["Basse", "Moyenne", "Haute"];

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "..", "public")));

function formatProject(project) {
  return {
    id: project._id.toString(),
    name: project.name,
    description: project.description,
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function formatTask(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    completed: task.completed,
    priority: task.priority || "Moyenne",
    project: task.project ? task.project.toString() : null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function formatMember(member) {
  return {
    id: member._id.toString(),
    project: member.project.toString(),
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

function formatHistory(entry) {
  return {
    id: entry._id.toString(),
    project: entry.project.toString(),
    action: entry.action,
    actor: entry.actor,
    details: entry.details,
    targetType: entry.targetType,
    targetId: entry.targetId,
    createdAt: entry.createdAt,
  };
}

async function logHistory({
  projectId,
  action,
  actor = "Systeme",
  details = "",
  targetType = "",
  targetId = "",
}) {
  if (!projectId) {
    return;
  }

  await History.create({
    project: projectId,
    action,
    actor,
    details,
    targetType,
    targetId,
  });
}

async function ensureProjectExists(projectId) {
  if (!projectId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return false;
  }

  const project = await Project.findById(projectId);
  return project || false;
}

app.get("/api/projects", async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    return res.json(projects.map(formatProject));
  } catch (error) {
    console.error("Erreur lors du chargement des projets :", error.message);
    return res.status(500).json({ error: "Impossible de charger les projets." });
  }
});

app.post("/api/projects", async (req, res) => {
  const name = req.body.name?.trim();
  const description = req.body.description?.trim() || "";
  const color = req.body.color?.trim() || "#3498db";

  if (!name) {
    return res.status(400).json({ error: "Le nom du projet est obligatoire." });
  }

  try {
    const project = await Project.create({ name, description, color });
    await logHistory({
      projectId: project._id,
      action: "project_created",
      details: `Projet cree : ${project.name}`,
      targetType: "project",
      targetId: project._id.toString(),
    });

    return res.status(201).json(formatProject(project));
  } catch (error) {
    console.error("Erreur lors de la creation du projet :", error.message);
    return res.status(500).json({ error: "Impossible de creer le projet." });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  const updates = {};

  if (typeof req.body.name === "string") {
    updates.name = req.body.name.trim();
  }

  if (typeof req.body.description === "string") {
    updates.description = req.body.description.trim();
  }

  if (typeof req.body.color === "string") {
    updates.color = req.body.color.trim();
  }

  if (updates.name === "") {
    return res.status(400).json({ error: "Le nom du projet est obligatoire." });
  }

  try {
    const project = await Project.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!project) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    await logHistory({
      projectId: project._id,
      action: "project_updated",
      details: `Projet mis a jour : ${project.name}`,
      targetType: "project",
      targetId: project._id.toString(),
    });

    return res.json(formatProject(project));
  } catch (error) {
    console.error("Erreur lors de la mise a jour du projet :", error.message);
    return res.status(500).json({ error: "Impossible de mettre a jour le projet." });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    await Promise.all([
      Task.deleteMany({ project: project._id }),
      Member.deleteMany({ project: project._id }),
      History.deleteMany({ project: project._id }),
    ]);

    return res.json({ message: "Projet supprime." });
  } catch (error) {
    console.error("Erreur lors de la suppression du projet :", error.message);
    return res.status(500).json({ error: "Impossible de supprimer le projet." });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const filter = {};

    if (req.query.projectId) {
      filter.project = req.query.projectId;
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(tasks.map(formatTask));
  } catch (error) {
    console.error("Erreur lors du chargement des taches :", error.message);
    return res.status(500).json({ error: "Impossible de charger les taches." });
  }
});

app.post("/api/tasks", async (req, res) => {
  const title = req.body.title?.trim();
  const priority = req.body.priority || "Moyenne";
  const projectId = req.body.projectId || null;

  if (!title) {
    return res.status(400).json({ error: "Le titre est obligatoire." });
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "La priorite est invalide." });
  }

  try {
    let project = null;

    if (projectId) {
      project = await ensureProjectExists(projectId);

      if (project === false) {
        return res.status(400).json({ error: "Le projet est invalide ou introuvable." });
      }
    }

    const newTask = await Task.create({
      title,
      completed: false,
      priority,
      project: project ? project._id : null,
    });

    await logHistory({
      projectId: project ? project._id : null,
      action: "task_created",
      details: `Tache creee : ${newTask.title}`,
      targetType: "task",
      targetId: newTask._id.toString(),
    });

    return res.status(201).json(formatTask(newTask));
  } catch (error) {
    console.error("Erreur lors de l'ajout d'une tache :", error.message);
    return res.status(500).json({ error: "Impossible d'ajouter la tache." });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: "Tache introuvable." });
    }

    task.completed = !task.completed;
    const updatedTask = await task.save();

    await logHistory({
      projectId: updatedTask.project,
      action: "task_toggled",
      details: `Tache ${updatedTask.completed ? "terminee" : "reactivee"} : ${updatedTask.title}`,
      targetType: "task",
      targetId: updatedTask._id.toString(),
    });

    return res.json(formatTask(updatedTask));
  } catch (error) {
    console.error("Erreur lors de la mise a jour du statut :", error.message);
    return res.status(500).json({ error: "Impossible de sauvegarder le statut." });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask) {
      return res.status(404).json({ error: "Tache introuvable." });
    }

    await logHistory({
      projectId: deletedTask.project,
      action: "task_deleted",
      details: `Tache supprimee : ${deletedTask.title}`,
      targetType: "task",
      targetId: deletedTask._id.toString(),
    });

    return res.json({ message: "Tache supprimee." });
  } catch (error) {
    console.error("Erreur lors de la suppression d'une tache :", error.message);
    return res.status(500).json({ error: "Impossible de supprimer la tache." });
  }
});

app.get("/api/projects/:projectId/members", async (req, res) => {
  try {
    const project = await ensureProjectExists(req.params.projectId);

    if (project === false) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    const members = await Member.find({ project: req.params.projectId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(members.map(formatMember));
  } catch (error) {
    console.error("Erreur lors du chargement des membres :", error.message);
    return res.status(500).json({ error: "Impossible de charger les membres." });
  }
});

app.post("/api/projects/:projectId/members", async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const role = req.body.role?.trim() || "Membre";

  if (!name || !email) {
    return res.status(400).json({ error: "Le nom et l'email sont obligatoires." });
  }

  try {
    const project = await ensureProjectExists(req.params.projectId);

    if (project === false) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    const member = await Member.create({
      project: req.params.projectId,
      name,
      email,
      role,
    });

    await logHistory({
      projectId: req.params.projectId,
      action: "member_invited",
      details: `Invitation envoyee a ${member.email}`,
      targetType: "member",
      targetId: member._id.toString(),
    });

    return res.status(201).json(formatMember(member));
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un membre :", error.message);

    if (error.code === 11000) {
      return res.status(409).json({ error: "Ce membre est deja invite dans ce projet." });
    }

    return res.status(500).json({ error: "Impossible d'ajouter le membre." });
  }
});

app.get("/api/projects/:projectId/history", async (req, res) => {
  try {
    const project = await ensureProjectExists(req.params.projectId);

    if (project === false) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    const historyEntries = await History.find({ project: req.params.projectId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(historyEntries.map(formatHistory));
  } catch (error) {
    console.error("Erreur lors du chargement de l'historique :", error.message);
    return res.status(500).json({ error: "Impossible de charger l'historique." });
  }
});

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connecte");

    app.listen(PORT, () => {
      console.log(`Serveur demarre sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Connexion MongoDB impossible :", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
