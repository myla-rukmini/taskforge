const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

async function getMembership(projectId, userId) {
  return await db.members.findOne({ projectId, userId });
}

// GET /api/tasks?projectId=xxx
router.get('/', auth, async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const membership = await getMembership(projectId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a project member' });

    const query = { projectId };
    if (req.query.status) query.status = req.query.status;
    if (req.query.assigneeId) query.assigneeId = req.query.assigneeId;
    if (req.query.priority) query.priority = req.query.priority;

    const tasks = await db.tasks.find(query);
    res.json(tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/my - tasks assigned to me across all projects
router.get('/my', auth, async (req, res) => {
  try {
    const tasks = await db.tasks.find({ assigneeId: req.user.id });
    // Enrich with project name
    const enriched = await Promise.all(tasks.map(async t => {
      const project = await db.projects.findOne({ _id: t.projectId });
      return { ...t, projectName: project?.name || 'Unknown' };
    }));
    res.json(enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', auth, async (req, res) => {
  try {
    const { projectId, title, description, status, priority, dueDate, assigneeId, assigneeName } = req.body;
    if (!projectId || !title) return res.status(400).json({ error: 'projectId and title required' });

    const membership = await getMembership(projectId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a project member' });

    // Only admins can assign to others
    let finalAssigneeId = req.user.id;
    let finalAssigneeName = req.user.name;
    if (assigneeId && membership.role === 'admin') {
      finalAssigneeId = assigneeId;
      finalAssigneeName = assigneeName || assigneeId;
    }

    const task = await db.tasks.insert({
      projectId, title, description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      assigneeId: finalAssigneeId,
      assigneeName: finalAssigneeName,
      createdBy: req.user.id,
      createdByName: req.user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await db.tasks.findOne({ _id: req.params.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = await getMembership(task.projectId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a project member' });

    const { title, description, status, priority, dueDate, assigneeId, assigneeName } = req.body;
    const update = { updatedAt: new Date().toISOString() };

    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (status !== undefined) update.status = status;
    if (priority !== undefined) update.priority = priority;
    if (dueDate !== undefined) update.dueDate = dueDate;

    // Only admins can reassign
    if (assigneeId !== undefined && membership.role === 'admin') {
      update.assigneeId = assigneeId;
      update.assigneeName = assigneeName || assigneeId;
    }
    // Members can only update status of their own tasks
    if (membership.role === 'member' && task.assigneeId !== req.user.id) {
      // allow updating status only if admin of project
      return res.status(403).json({ error: 'Can only update your own tasks' });
    }

    await db.tasks.update({ _id: req.params.id }, { $set: update });
    const updated = await db.tasks.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await db.tasks.findOne({ _id: req.params.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = await getMembership(task.projectId, req.user.id);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    await db.tasks.remove({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/dashboard - summary stats across all user's projects
router.get('/dashboard', auth, async (req, res) => {
  try {
    const memberships = await db.members.find({ userId: req.user.id });
    const projectIds = memberships.map(m => m.projectId);

    const now = new Date().toISOString();
    const allTasks = await db.tasks.find({ projectId: { $in: projectIds } });
    const myTasks = allTasks.filter(t => t.assigneeId === req.user.id);
    
    const stats = {
      totalProjects: projectIds.length,
      totalTasks: allTasks.length,
      myTasks: myTasks.length,
      todo: myTasks.filter(t => t.status === 'todo').length,
      inProgress: myTasks.filter(t => t.status === 'in_progress').length,
      done: myTasks.filter(t => t.status === 'done').length,
      overdue: myTasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'done').length,
      recentTasks: allTasks
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
    };

    // Add project names to recent tasks
    stats.recentTasks = await Promise.all(stats.recentTasks.map(async t => {
      const project = await db.projects.findOne({ _id: t.projectId });
      return { ...t, projectName: project?.name };
    }));

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
