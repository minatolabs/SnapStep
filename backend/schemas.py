from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import SessionStatus, GuideStatus, ExportJobStatus

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    tenant_id: int
    is_active: bool
    is_admin: bool = False
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

# Sessions
class SessionCreate(BaseModel):
    title: Optional[str] = None

class SessionResponse(BaseModel):
    id: int
    tenant_id: int
    user_id: int
    title: Optional[str]
    status: SessionStatus
    created_at: datetime
    
    class Config:
        from_attributes = True

# Steps
class StepCreate(BaseModel):
    session_id: int
    index: int
    title: Optional[str] = None
    description: Optional[str] = None
    screenshot_key: str
    action_type: Optional[str] = None
    action_context: Optional[Dict[str, Any]] = None

class StepResponse(BaseModel):
    id: int
    session_id: Optional[int]
    guide_id: Optional[int]
    index: int
    title: Optional[str]
    description: Optional[str]
    screenshot_key: Optional[str]
    screenshot_url: Optional[str] = None  # Populated on demand
    action_type: Optional[str]
    action_context: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Guides
class GuideResponse(BaseModel):
    id: int
    tenant_id: int
    owner_id: int
    session_id: Optional[int]
    title: str
    description: Optional[str]
    content: Optional[Dict[str, Any]]
    status: GuideStatus
    share_token: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    steps: List[StepResponse] = []
    
    class Config:
        from_attributes = True

class GuideUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    status: Optional[GuideStatus] = None

# Annotations
class AnnotationCreate(BaseModel):
    guide_id: int
    step_id: Optional[int] = None
    type: str
    data: Dict[str, Any]

class AnnotationResponse(BaseModel):
    id: int
    guide_id: int
    step_id: Optional[int]
    type: str
    data: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Exports
class ExportRequest(BaseModel):
    guide_id: int
    format: str = "pdf"

class ExportResponse(BaseModel):
    job_id: int
    status: ExportJobStatus
    download_url: Optional[str] = None
    
    class Config:
        from_attributes = True

