import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from datetime import timedelta
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9001")
S3_BUCKET = os.getenv("S3_BUCKET", "snapstep-assets")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin123")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

# Configure S3 client for MinIO
s3_client = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
    config=Config(signature_version='s3v4')
)

def ensure_bucket_exists():
    """Ensure the bucket exists, create if it doesn't"""
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        s3_client.create_bucket(Bucket=S3_BUCKET)

def get_presigned_upload_url(filename: str, content_type: str = "image/png", tenant_id: int = None) -> tuple:
    """Generate presigned URL for uploading a file. Returns (url, key) tuple."""
    ensure_bucket_exists()
    
    # Generate unique key with tenant prefix
    tenant_prefix = f"tenant_{tenant_id}" if tenant_id else "default"
    key = f"{tenant_prefix}/{uuid.uuid4()}/{filename}"
    
    try:
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': key,
                'ContentType': content_type
            },
            ExpiresIn=3600  # 1 hour
        )
        return url, key
    except ClientError as e:
        raise Exception(f"Error generating presigned URL: {e}")

def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate presigned URL for downloading a file"""
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': key},
            ExpiresIn=expires_in
        )
        return url
    except ClientError as e:
        raise Exception(f"Error generating download URL: {e}")

def delete_object(key: str) -> bool:
    """Delete an object from S3"""
    try:
        s3_client.delete_object(Bucket=S3_BUCKET, Key=key)
        return True
    except ClientError as e:
        print(f"Error deleting object: {e}")
        return False

