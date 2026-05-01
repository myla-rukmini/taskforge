# TaskForge — Team Task Manager

A full-stack team task management platform with role-based access control, built with Node.js, Express, and NeDB.

## Live Demo
> Deploy to Railway (see below) and replace with your live URL

## Features

- **Authentication** — JWT-based signup/login with bcrypt password hashing
- **Projects** — Create, edit, delete projects with custom colors
- **Role-Based Access Control** — Admin/Member roles per project
  - Admins: full CRUD on tasks, manage members, assign tasks to anyone
  - Members: create tasks (assigned to self), update status of own tasks
- **Task Management** — Title, description, status, priority, due date, assignee
- **Kanban Board** — Visual drag-friendly board with 4 columns (Todo → In Progress → Review → Done)
- **Dashboard** — Stats overview, recent activity, quick project access
- **My Tasks** — Cross-project task view filtered to the logged-in user
- **Overdue Detection** — Visual flags for past-due incomplete tasks
- **Member Management** — Invite by email, promote/demote roles, remove members

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | NeDB (embedded, file-based, no external DB needed) |
| Auth | JWT + bcryptjs |
| Frontend | Vanilla JS SPA (served by Express) |
| Deployment | Railway |

## REST API

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/api/projects` | ✓ | Any member |
| POST | `/api/projects` | ✓ | Any user |
| GET | `/api/projects/:id` | ✓ | Member+ |
| PUT | `/api/projects/:id` | ✓ | Admin only |
| DELETE | `/api/projects/:id` | ✓ | Admin only |
| GET | `/api/projects/:id/members` | ✓ | Member+ |
| POST | `/api/projects/:id/members` | ✓ | Admin only |
| PUT | `/api/projects/:id/members/:mid` | ✓ | Admin only |
| DELETE | `/api/projects/:id/members/:mid` | ✓ | Admin only |

### Tasks
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/api/tasks?projectId=` | ✓ | Member+ |
| GET | `/api/tasks/my` | ✓ | Self |
| GET | `/api/tasks/dashboard` | ✓ | Self |
| POST | `/api/tasks` | ✓ | Member+ |
| PUT | `/api/tasks/:id` | ✓ | Admin / own task |
| DELETE | `/api/tasks/:id` | ✓ | Admin only |

## Local Development

```bash
git clone <your-repo>
cd taskforge
npm install
npm start
# Open http://localhost:3000
```

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js
4. Add environment variables:
   - `JWT_SECRET` = any long random string (e.g. `openssl rand -hex 32`)
   - `PORT` = (Railway sets this automatically)
5. Click **Deploy** — your app will be live in ~2 minutes

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes (prod) | `taskforge_secret_key_change_in_prod` | JWT signing secret |
| `PORT` | Auto | `3000` | Server port (Railway sets this) |
| `DB_PATH` | No | `./data` | Path for NeDB data files |

> ⚠️ Always set `JWT_SECRET` in production. The default is not secure.

## Project Structure

```
taskforge/
├── server.js          # Express entry point
├── db/
│   └── index.js       # NeDB setup + promisified helpers
├── middleware/
│   └── auth.js        # JWT auth middleware
├── routes/
│   ├── auth.js        # Auth endpoints
│   ├── projects.js    # Project + member endpoints
│   └── tasks.js       # Task endpoints
├── public/
│   └── index.html     # Full SPA frontend
├── railway.toml       # Railway deployment config
└── package.json
```

## Validation & Error Handling

- Required field validation on all POST/PUT endpoints
- Proper HTTP status codes (400, 401, 403, 404, 500)
- Email uniqueness enforced at DB level
- Role-based guards on every sensitive endpoint

## License
MIT
