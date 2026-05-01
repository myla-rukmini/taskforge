const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'taskforge_secret_key_change_in_prod';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { auth, JWT_SECRET };