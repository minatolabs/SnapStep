from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class SessionStatus(str, enum.Enum):
    RECORDING = "recording"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class GuideStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class ExportJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OIDC users
    full_name = Column(String, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # Admin flag
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    tenant = relationship("Tenant", back_populates="users")
    sessions = relationship("Session", back_populates="user")
    guides = relationship("Guide", back_populates="owner")

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    users = relationship("User", back_populates="tenant")
    sessions = relationship("Session", back_populates="tenant")
    guides = relationship("Guide", back_populates="tenant")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    status = Column(SQLEnum(SessionStatus), default=SessionStatus.RECORDING)
    guide_id = Column(Integer, ForeignKey("guides.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    tenant = relationship("Tenant", back_populates="sessions")
    user = relationship("User", back_populates="sessions")
    steps = relationship("Step", back_populates="session", order_by="Step.index")

class Guide(Base):
    __tablename__ = "guides"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    content = Column(JSON, nullable=True)  # TipTap document structure
    status = Column(SQLEnum(GuideStatus), default=GuideStatus.DRAFT)
    share_token = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    tenant = relationship("Tenant", back_populates="guides")
    owner = relationship("User", back_populates="guides")
    session = relationship("Session", foreign_keys=[session_id], uselist=False)
    steps = relationship("Step", back_populates="guide", order_by="Step.index")
    annotations = relationship("Annotation", back_populates="guide")
    export_jobs = relationship("ExportJob", back_populates="guide")

class Step(Base):
    __tablename__ = "steps"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    guide_id = Column(Integer, ForeignKey("guides.id"), nullable=True)
    index = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    screenshot_key = Column(String, nullable=True)  # S3 key
    action_type = Column(String, nullable=True)  # click, type, select, etc.
    action_context = Column(JSON, nullable=True)  # UI element info, app name, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    tenant_id_fk = relationship("Tenant")
    session = relationship("Session", back_populates="steps")
    guide = relationship("Guide", back_populates="steps")

class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    guide_id = Column(Integer, ForeignKey("guides.id"), nullable=False)
    step_id = Column(Integer, ForeignKey("steps.id"), nullable=True)
    type = Column(String, nullable=False)  # rectangle, circle, arrow, blur, etc.
    data = Column(JSON, nullable=False)  # coordinates, style, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    guide = relationship("Guide", back_populates="annotations")

class ExportJob(Base):
    __tablename__ = "export_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    guide_id = Column(Integer, ForeignKey("guides.id"), nullable=False)
    status = Column(SQLEnum(ExportJobStatus), default=ExportJobStatus.PENDING)
    format = Column(String, default="pdf")
    output_key = Column(String, nullable=True)  # S3 key for generated file
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    guide = relationship("Guide", back_populates="export_jobs")


