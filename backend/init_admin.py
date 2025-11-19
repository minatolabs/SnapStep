#!/usr/bin/env python3
"""Initialize admin user - run this on first startup"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models import User, Tenant
from auth import get_password_hash

def init_admin():
    db = SessionLocal()
    try:
        # Check if admin exists
        admin = db.query(User).filter(User.email == "admin@snapstep.local").first()
        if admin:
            if not admin.is_admin:
                admin.is_admin = True
                db.commit()
                print("✓ User promoted to admin")
            else:
                print("✓ Admin user already exists")
            return
        
        # Get or create tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Default Tenant", slug="default")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        
        # Create admin user
        try:
            password_hash = get_password_hash("admin123")
        except Exception as e:
            print(f"Error hashing password: {e}")
            # Fallback: use a simple hash (not secure, but works for testing)
            import hashlib
            password_hash = hashlib.sha256("admin123".encode()).hexdigest()
            print("Warning: Using SHA256 hash instead of bcrypt (not secure for production!)")
        
        admin_user = User(
            email="admin@snapstep.local",
            hashed_password=password_hash,
            full_name="Default Admin",
            tenant_id=tenant.id,
            is_admin=True,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        print("✓ Admin user created: admin@snapstep.local / admin123")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_admin()

