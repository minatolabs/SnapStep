import os
import sys
import time
from io import BytesIO
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_LEFT
import boto3
from PIL import Image as PILImage

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from models import ExportJob, ExportJobStatus, Guide, Step, Base
from storage import s3_client, S3_BUCKET, get_presigned_download_url

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://snapstep:snapstep_dev_password@localhost:5433/snapstep")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def download_image_from_s3(key: str) -> BytesIO:
    """Download image from S3 and return as BytesIO"""
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
        image_data = response['Body'].read()
        return BytesIO(image_data)
    except Exception as e:
        print(f"Error downloading image {key}: {e}")
        raise

def resize_image(image_data: BytesIO, max_width: int = 600) -> BytesIO:
    """Resize image to fit PDF width"""
    try:
        img = PILImage.open(image_data)
        width, height = img.size
        
        if width > max_width:
            ratio = max_width / width
            new_width = max_width
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), PILImage.Resampling.LANCZOS)
        
        output = BytesIO()
        img.save(output, format='PNG')
        output.seek(0)
        return output
    except Exception as e:
        print(f"Error resizing image: {e}")
        return image_data

def generate_pdf(guide: Guide, steps: list, db: Session) -> str:
    """Generate PDF for a guide and upload to S3"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor='#1a1a1a',
        spaceAfter=30,
        alignment=TA_LEFT
    )
    story.append(Paragraph(guide.title or "Untitled Guide", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Description
    if guide.description:
        desc_style = ParagraphStyle(
            'CustomDesc',
            parent=styles['Normal'],
            fontSize=12,
            textColor='#666666',
            spaceAfter=20
        )
        story.append(Paragraph(guide.description, desc_style))
        story.append(Spacer(1, 0.3*inch))
    
    # Steps
    for idx, step in enumerate(steps, 1):
        # Step title
        step_title_style = ParagraphStyle(
            'StepTitle',
            parent=styles['Heading2'],
            fontSize=18,
            textColor='#2c3e50',
            spaceAfter=10,
            spaceBefore=20
        )
        step_title = step.title or f"Step {idx}"
        story.append(Paragraph(f"Step {idx}: {step_title}", step_title_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Step description
        if step.description:
            desc_style = ParagraphStyle(
                'StepDesc',
                parent=styles['Normal'],
                fontSize=11,
                textColor='#444444',
                spaceAfter=15
            )
            story.append(Paragraph(step.description, desc_style))
            story.append(Spacer(1, 0.1*inch))
        
        # Screenshot
        if step.screenshot_key:
            try:
                image_data = download_image_from_s3(step.screenshot_key)
                image_data = resize_image(image_data, max_width=550)
                
                img = Image(image_data, width=5.5*inch, height=4*inch)
                story.append(img)
                story.append(Spacer(1, 0.2*inch))
            except Exception as e:
                print(f"Error adding image for step {step.id}: {e}")
                error_para = Paragraph(f"[Image unavailable: {str(e)}]", styles['Normal'])
                story.append(error_para)
        
        # Page break between steps (except last)
        if idx < len(steps):
            story.append(Spacer(1, 0.2*inch))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    # Upload to S3
    pdf_key = f"exports/guide_{guide.id}_{int(time.time())}.pdf"
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=pdf_key,
            Body=buffer.getvalue(),
            ContentType='application/pdf'
        )
        return pdf_key
    except Exception as e:
        raise Exception(f"Error uploading PDF: {e}")

def process_export_job(job_id: int):
    """Process a single export job"""
    db = SessionLocal()
    try:
        job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
        if not job:
            print(f"Export job {job_id} not found")
            return
        
        if job.status != ExportJobStatus.PENDING:
            print(f"Export job {job_id} is not pending (status: {job.status})")
            return
        
        # Update status to processing
        job.status = ExportJobStatus.PROCESSING
        db.commit()
        
        # Get guide and steps
        guide = db.query(Guide).filter(Guide.id == job.guide_id).first()
        if not guide:
            job.status = ExportJobStatus.FAILED
            job.error_message = "Guide not found"
            db.commit()
            return
        
        steps = db.query(Step).filter(
            Step.guide_id == guide.id
        ).order_by(Step.index).all()
        
        if not steps:
            job.status = ExportJobStatus.FAILED
            job.error_message = "Guide has no steps"
            db.commit()
            return
        
        # Generate PDF
        try:
            pdf_key = generate_pdf(guide, steps, db)
            job.output_key = pdf_key
            job.status = ExportJobStatus.COMPLETED
            job.completed_at = time.time()
        except Exception as e:
            job.status = ExportJobStatus.FAILED
            job.error_message = str(e)
        
        db.commit()
        print(f"Export job {job_id} completed with status {job.status}")
        
    except Exception as e:
        print(f"Error processing export job {job_id}: {e}")
        if db:
            job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
            if job:
                job.status = ExportJobStatus.FAILED
                job.error_message = str(e)
                db.commit()
    finally:
        db.close()

def worker_loop():
    """Main worker loop - polls for pending export jobs"""
    print("Worker started, polling for export jobs...")
    
    while True:
        db = SessionLocal()
        try:
            # Get pending jobs (limit to concurrency)
            concurrency = int(os.getenv("WORKER_CONCURRENCY", "2"))
            pending_jobs = db.query(ExportJob).filter(
                ExportJob.status == ExportJobStatus.PENDING
            ).limit(concurrency).all()
            
            for job in pending_jobs:
                print(f"Processing export job {job.id}")
                process_export_job(job.id)
            
            if not pending_jobs:
                time.sleep(5)  # Wait 5 seconds if no jobs
            else:
                time.sleep(1)  # Short wait between batches
                
        except Exception as e:
            print(f"Error in worker loop: {e}")
            time.sleep(5)
        finally:
            db.close()

if __name__ == "__main__":
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    # If job ID provided as argument, process that job
    if len(sys.argv) > 1:
        job_id = int(sys.argv[1])
        process_export_job(job_id)
    else:
        worker_loop()

