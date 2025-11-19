#!/usr/bin/env python3
"""
Script to create or promote a user to admin.
Usage: python create_admin.py <email> [password]
If password is not provided, user must already exist.
"""
import sys
import os
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User
from auth import get_password_hash

def create_or_promote_admin(email: str, password: str = None):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            # User exists, promote to admin
            user.is_admin = True
            if password:
                user.hashed_password = get_password_hash(password)
            db.commit()
            print(f"✓ User {email} promoted to admin")
        else:
            # User doesn't exist, create admin user
            if not password:
                print("Error: Password required to create new user")
                return False
            
            # Get default tenant
            from models import Tenant
            tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
            if not tenant:
                tenant = Tenant(name="Default Tenant", slug="default")
                db.add(tenant)
                db.commit()
                db.refresh(tenant)
            
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                tenant_id=tenant.id,
                is_admin=True
            )
            db.add(user)
            db.commit()
            print(f"✓ Admin user {email} created")
        
        return True
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_admin.py <email> [password]")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None
    
    create_or_promote_admin(email, password)

