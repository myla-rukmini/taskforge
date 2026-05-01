const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// Helper: check if user is admin of project
async function requireAdmin(projectId, userId, res) {
  const member = await db.members.findOne({ projectId, userId });
  if (!member || member.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// Helper: check if user is member of project
async function requireMember(projectId, userId, res) {
  const member = await db.members.findOne({ projectId, userId });
  if (!member) {
    res.status(403).json({ error: 'Not a project member' });
    return false;
  }
  return member;
}

// GET /api/projects - list projects user belongs to
router.get('/', auth, async (req, res) => {
  try {
    const memberships = await db.members.find({ userId: req.user.id });
    const projectIds = memberships.map(m => m.projectId);
    const projects = await db.projects.find({ _id: { $in: projectIds } });
    
    // Enrich with member count, task counts, user's role
    const enriched = await Promise.all(projects.map(async p => {
      const memberCount = (await db.members.find({ projectId: p._id })).length;
      const taskCount = await db.tasks.count({ projectId: p._id });
      const doneCount = await db.tasks.count({ projectId: p._id, status: 'done' });
      const overdueCount = await db.tasks.count({ 
        projectId: p._id, 
        status: { $ne: 'done' },
        dueDate: { $lt: new Date().toISOString(), $exists: true }
      });
      const myRole = memberships.find(m => m.projectId === p._id)?.role;
      return { ...p, memberCount, taskCount, doneCount, overdueCount, myRole };
    }));
    
    res.json(enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - create project (creator becomes admin)
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });

    const project = await db.projects.insert({
      name, description: description || '', color: color || '#6366f1',
      createdBy: req.user.id, createdAt: new Date().toISOString()
    });

    await db.members.insert({
      projectId: project._id, userId: req.user.id, role: 'admin',
      name: req.user.name, email: req.user.email,
      joinedAt: new Date().toISOString()
    });

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const member = await requireMember(req.params.id, req.user.id, res);
    if (!member) return;
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ ...project, myRole: member.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!await requireAdmin(req.params.id, req.user.id, res)) return;
    const { name, description, color } = req.body;
    await db.projects.update({ _id: req.params.id }, { $set: { name, description, color } });
    const updated = await db.projects.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!await requireAdmin(req.params.id, req.user.id, res)) return;
    await db.projects.remove({ _id: req.params.id });
    await db.members.remove({ projectId: req.params.id }, { multi: true });
    await db.tasks.remove({ projectId: req.params.id }, { multi: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/members
router.get('/:id/members', auth, async (req, res) => {
  try {
    if (!await requireMember(req.params.id, req.user.id, res)) return;
    const members = await db.members.find({ projectId: req.params.id });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/members - invite by email (admin only)
router.post('/:id/members', auth, async (req, res) => {
  try {
    if (!await requireAdmin(req.params.id, req.user.id, res)) return;
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const invitedUser = await db.users.findOne({ email: email.toLowerCase() });
    if (!invitedUser) return res.status(404).json({ error: 'User not found. They must sign up first.' });

    const existing = await db.members.findOne({ projectId: req.params.id, userId: invitedUser._id });
    if (existing) return res.status(400).json({ error: 'User already in project' });

    const member = await db.members.insert({
      projectId: req.params.id, userId: invitedUser._id,
      role: role || 'member', name: invitedUser.name, email: invitedUser.email,
      joinedAt: new Date().toISOString()
    });
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/members/:memberId - change role
router.put('/:id/members/:memberId', auth, async (req, res) => {
  try {
    if (!await requireAdmin(req.params.id, req.user.id, res)) return;
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await db.members.update({ _id: req.params.memberId }, { $set: { role } });
    const updated = await db.members.findOne({ _id: req.params.memberId });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/members/:memberId
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    if (!await requireAdmin(req.params.id, req.user.id, res)) return;
    const member = await db.members.findOne({ _id: req.params.memberId });
    if (member?.userId === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' });
    await db.members.remove({ _id: req.params.memberId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
