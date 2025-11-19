# SnapStep - Server & Web App Prototype

A working prototype of the SnapStep backend API and web editor. This implements the core functionality from the handbook for creating, editing, and exporting step-by-step guides.

## Architecture

- **Backend API**: FastAPI (Python) on port **8888**
- **Web Editor**: Next.js + TipTap on port **3001**
- **Worker**: PDF generation service
- **PostgreSQL**: Database on port **5433**
- **Redis**: Queue/cache on port **6380**
- **MinIO**: S3-compatible storage on ports **9001** (API) and **9002** (Console)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional) Node.js 20+ and Python 3.11+ for local development

### Run Everything

```bash
docker-compose up --build
```

This will start all services:
- API: http://localhost:8888
- Web: http://localhost:3001
- MinIO Console: http://localhost:9002 (minioadmin/minioadmin123)

### First Time Setup

1. **Access the web app**: http://localhost:3001
2. **Register a new account** (email/password)
3. **Make yourself admin** (see Admin Setup below)
4. **Login** to access the guide editor

### Admin Setup

**Default Admin Account (for testing):**
- **Email:** `admin@snapstep.local`
- **Password:** `admin123`

This admin account is automatically created on first startup. You can login with these credentials to access the admin panel.

**To create additional admin users:**

**Option 1: Use the Python script**
```bash
docker-compose exec api python create_admin.py your-email@example.com your-password
```

**Option 2: Direct database access**
```bash
docker-compose exec postgres psql -U snapstep -d snapstep
```
Then run:
```sql
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

Once you're an admin, you'll see an "Admin" button in the guides page that takes you to the user management interface.

## API Endpoints

### Auth
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - Login (returns JWT token)
- `GET /v1/auth/me` - Get current user

### Sessions
- `POST /v1/sessions` - Create recording session
- `GET /v1/sessions/{id}` - Get session
- `POST /v1/sessions/{id}/complete` - Complete session → create guide

### Uploads
- `POST /v1/uploads?filename=...&content_type=...` - Get presigned upload URL

### Steps
- `POST /v1/steps` - Append step to session

### Guides
- `GET /v1/guides` - List all guides
- `GET /v1/guides/{id}` - Get guide with steps
- `PATCH /v1/guides/{id}` - Update guide (title, content, etc.)

### Annotations
- `POST /v1/annotations` - Create annotation
- `GET /v1/guides/{id}/annotations` - Get annotations for guide
- `DELETE /v1/annotations/{id}` - Delete annotation

### Exports
- `POST /v1/exports/pdf` - Request PDF export
- `GET /v1/exports/{job_id}` - Get export status

## Development

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8888
```

### Web (Next.js)

```bash
cd web
npm install
npm run dev
```

### Worker

```bash
cd worker
pip install -r requirements.txt
python main.py
```

## Database

The database schema is automatically created on first run. Tables include:
- `users` - User accounts
- `tenants` - Multi-tenant isolation
- `sessions` - Recording sessions
- `guides` - Created guides
- `steps` - Individual steps in guides
- `annotations` - Screenshot annotations
- `export_jobs` - PDF export jobs

## Storage

MinIO is used for S3-compatible object storage:
- Screenshots are stored with presigned URLs
- PDF exports are stored and served via presigned URLs
- Bucket: `snapstep-assets`

## Features Implemented

✅ User authentication (register/login)  
✅ Session management  
✅ Step creation with screenshots  
✅ Guide creation from sessions  
✅ Web editor with TipTap (rich text)  
✅ Autosave functionality  
✅ PDF export (via worker)  
✅ Multi-tenant isolation  
✅ Presigned S3 uploads/downloads  

## Not Yet Implemented

- Windows client (to be built separately)
- Advanced annotations (rectangles, blur, etc.) - UI only
- Real-time collaboration
- Version history UI
- Share links with access control

## Notes

- This is a **prototype** - not production-ready
- JWT secret is hardcoded (change in production)
- Database migrations are auto-created (use Alembic for production)
- Worker polls database directly (use Redis queue in production)
- No email verification or password reset
- Simplified auth (no OIDC/device-code yet)

## Troubleshooting

**Port conflicts**: Change ports in `docker-compose.yml` if needed

**Database connection errors**: Wait for postgres health check to pass

**MinIO bucket errors**: The bucket is auto-created, but you can verify in MinIO console

**Worker not processing**: Check worker logs - it polls every 5 seconds for pending jobs

## Next Steps

1. Build Windows client to record workflows
2. Add proper Redis queue for worker jobs
3. Implement advanced annotation tools
4. Add share link functionality
5. Set up proper database migrations
6. Add email verification and password reset


