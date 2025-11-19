from fastapi import FastAPI, Depends, HTTPException, status, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
from datetime import datetime
import secrets
from typing import List, Optional

from database import SessionLocal, engine, Base, get_db
from models import (
    User, Tenant, Session, Guide, Step, Annotation, ExportJob,
    SessionStatus, GuideStatus, ExportJobStatus
)
from schemas import (
    SessionCreate, SessionResponse, StepCreate, StepResponse,
    GuideResponse, GuideUpdate, AnnotationCreate, AnnotationResponse,
    ExportRequest, ExportResponse, UserCreate, UserResponse, UserUpdate, Token
)
from storage import get_presigned_upload_url, get_presigned_download_url
from auth import (
    get_current_user, get_current_admin, create_access_token, verify_password,
    get_password_hash, decode_token
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SnapStep API", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize default tenant and admin user if needed
def init_default_tenant():
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Default Tenant", slug="default")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        return tenant
    finally:
        db.close()

def init_default_admin():
    """Create default admin user if no admins exist"""
    db = SessionLocal()
    try:
        # Check if any admin exists
        admin_exists = db.query(User).filter(User.is_admin == True).first()
        if admin_exists:
            return
        
        # Get or create default tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Default Tenant", slug="default")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        
        # Create default admin user
        admin_email = "admin@snapstep.local"
        admin_password = "admin123"  # Change this in production!
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == admin_email).first()
        if existing_user:
            # Promote existing user to admin
            existing_user.is_admin = True
            existing_user.hashed_password = get_password_hash(admin_password)
            db.commit()
            print(f"✓ Existing user {admin_email} promoted to admin")
        else:
            # Create new admin user
            admin_user = User(
                email=admin_email,
                hashed_password=get_password_hash(admin_password),
                full_name="Default Admin",
                tenant_id=tenant.id,
                is_admin=True,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"✓ Default admin user created: {admin_email} / {admin_password}")
    except Exception as e:
        print(f"Error initializing admin: {e}")
        db.rollback()
    finally:
        db.close()

init_default_tenant()
init_default_admin()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "snapstep-api"}

# Auth endpoints
@app.post("/v1/auth/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user (simplified for MVP)"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get or create default tenant
    tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
    if not tenant:
        tenant = Tenant(name="Default Tenant", slug="default")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    
    # Create user
    hashed_password = get_password_hash(user_data.password) if user_data.password else None
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        tenant_id=tenant.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@app.post("/v1/auth/login", response_model=Token)
async def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="Password not set for this user")
    
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/v1/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Session endpoints
@app.post("/v1/sessions", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new recording session"""
    db_session = Session(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        title=session_data.title or f"Session {datetime.utcnow().isoformat()}",
        status=SessionStatus.RECORDING
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return SessionResponse(
        id=db_session.id,
        tenant_id=db_session.tenant_id,
        user_id=db_session.user_id,
        title=db_session.title,
        status=db_session.status,
        created_at=db_session.created_at
    )

@app.get("/v1/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a session by ID"""
    db_session = db.query(Session).filter(
        Session.id == session_id,
        Session.tenant_id == current_user.tenant_id
    ).first()
    
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return db_session

@app.post("/v1/uploads")
async def get_presigned_url(
    filename: str,
    content_type: str = "image/png",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get presigned URL for uploading screenshot"""
    try:
        upload_url, key = get_presigned_upload_url(
            filename=filename,
            content_type=content_type,
            tenant_id=current_user.tenant_id
        )
        return {
            "upload_url": upload_url,
            "key": key,
            "expires_in": 3600
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/steps", response_model=StepResponse)
async def create_step(
    step_data: StepCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Append a step to a session"""
    # Verify session belongs to user's tenant
    session = db.query(Session).filter(
        Session.id == step_data.session_id,
        Session.tenant_id == current_user.tenant_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    step = Step(
        tenant_id=current_user.tenant_id,
        session_id=step_data.session_id,
        index=step_data.index,
        title=step_data.title,
        description=step_data.description,
        screenshot_key=step_data.screenshot_key,
        action_type=step_data.action_type,
        action_context=step_data.action_context
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    
    return step

@app.post("/v1/sessions/{session_id}/complete", response_model=GuideResponse)
async def complete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete a session and create a guide"""
    session = db.query(Session).filter(
        Session.id == session_id,
        Session.tenant_id == current_user.tenant_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status == SessionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Session already completed")
    
    # Get all steps for this session
    steps = db.query(Step).filter(
        Step.session_id == session_id
    ).order_by(Step.index).all()
    
    if not steps:
        raise HTTPException(status_code=400, detail="Cannot complete session with no steps")
    
    # Create guide
    guide = Guide(
        tenant_id=current_user.tenant_id,
        owner_id=current_user.id,
        session_id=session_id,
        title=session.title or f"Guide from Session {session_id}",
        status=GuideStatus.DRAFT,
        share_token=secrets.token_urlsafe(32)
    )
    db.add(guide)
    db.flush()
    
    # Move steps to guide
    for step in steps:
        step.guide_id = guide.id
        step.session_id = None  # Keep session_id for reference but make guide primary
    
    # Update session
    session.status = SessionStatus.COMPLETED
    session.completed_at = datetime.utcnow()
    session.guide_id = guide.id
    
    db.commit()
    db.refresh(guide)
    
    # Reload guide with steps
    guide = db.query(Guide).filter(Guide.id == guide.id).first()
    
    return guide

# Guide endpoints
@app.get("/v1/guides", response_model=List[GuideResponse])
async def list_guides(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all guides for the current user's tenant"""
    guides = db.query(Guide).filter(
        Guide.tenant_id == current_user.tenant_id
    ).offset(skip).limit(limit).all()
    
    return guides

@app.get("/v1/guides/{guide_id}", response_model=GuideResponse)
async def get_guide(
    guide_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a guide by ID"""
    guide = db.query(Guide).filter(
        Guide.id == guide_id,
        Guide.tenant_id == current_user.tenant_id
    ).first()
    
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    
    # Get screenshot URLs for steps
    for step in guide.steps:
        if step.screenshot_key:
            step.screenshot_url = get_presigned_download_url(step.screenshot_key, expires_in=3600)
    
    return guide

@app.patch("/v1/guides/{guide_id}", response_model=GuideResponse)
async def update_guide(
    guide_id: int,
    guide_update: GuideUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a guide"""
    guide = db.query(Guide).filter(
        Guide.id == guide_id,
        Guide.tenant_id == current_user.tenant_id
    ).first()
    
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    
    if guide_update.title is not None:
        guide.title = guide_update.title
    if guide_update.description is not None:
        guide.description = guide_update.description
    if guide_update.content is not None:
        guide.content = guide_update.content
    if guide_update.status is not None:
        guide.status = guide_update.status
    
    guide.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(guide)
    
    return guide

# Annotation endpoints
@app.post("/v1/annotations", response_model=AnnotationResponse)
async def create_annotation(
    annotation_data: AnnotationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an annotation on a guide"""
    # Verify guide belongs to user's tenant
    guide = db.query(Guide).filter(
        Guide.id == annotation_data.guide_id,
        Guide.tenant_id == current_user.tenant_id
    ).first()
    
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    
    annotation = Annotation(
        tenant_id=current_user.tenant_id,
        guide_id=annotation_data.guide_id,
        step_id=annotation_data.step_id,
        type=annotation_data.type,
        data=annotation_data.data
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    
    return annotation

@app.get("/v1/guides/{guide_id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(
    guide_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all annotations for a guide"""
    guide = db.query(Guide).filter(
        Guide.id == guide_id,
        Guide.tenant_id == current_user.tenant_id
    ).first()
    
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    
    return guide.annotations

@app.delete("/v1/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an annotation"""
    annotation = db.query(Annotation).filter(
        Annotation.id == annotation_id,
        Annotation.tenant_id == current_user.tenant_id
    ).first()
    
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    db.delete(annotation)
    db.commit()
    
    return {"message": "Annotation deleted"}

# Export endpoints
@app.post("/v1/exports/pdf", response_model=ExportResponse)
async def request_pdf_export(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Request a PDF export of a guide"""
    guide = db.query(Guide).filter(
        Guide.id == export_request.guide_id,
        Guide.tenant_id == current_user.tenant_id
    ).first()
    
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    
    # Create export job
    job = ExportJob(
        tenant_id=current_user.tenant_id,
        guide_id=export_request.guide_id,
        status=ExportJobStatus.PENDING,
        format=export_request.format
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # TODO: Queue job in Redis for worker to process
    # For now, return pending status
    
    return ExportResponse(
        job_id=job.id,
        status=job.status,
        download_url=None
    )

@app.get("/v1/exports/{job_id}", response_model=ExportResponse)
async def get_export_status(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get export job status"""
    job = db.query(ExportJob).filter(
        ExportJob.id == job_id,
        ExportJob.tenant_id == current_user.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    download_url = None
    if job.status == ExportJobStatus.COMPLETED and job.output_key:
        download_url = get_presigned_download_url(job.output_key, expires_in=3600)
    
    return ExportResponse(
        job_id=job.id,
        status=job.status,
        download_url=download_url
    )

# Admin endpoints
@app.get("/admin/users", response_model=List[UserResponse])
async def list_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """List all users (admin only)"""
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@app.post("/admin/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create a new user (admin only)"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get or create default tenant
    tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
    if not tenant:
        tenant = Tenant(name="Default Tenant", slug="default")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    
    # Create user
    hashed_password = get_password_hash(user_data.password) if user_data.password else None
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        tenant_id=tenant.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@app.get("/admin/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get a user by ID (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.patch("/admin/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from removing their own admin status
    if user_id == current_user.id and user_update.is_admin == False:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
    
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing = db.query(User).filter(
            User.email == user_update.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = user_update.email
    
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    
    if user_update.password is not None:
        user.hashed_password = get_password_hash(user_update.password)
    
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    
    if user_update.is_admin is not None:
        user.is_admin = user_update.is_admin
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return user

@app.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)


