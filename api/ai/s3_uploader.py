import boto3
import os
import time
import logging
from io import BytesIO
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class S3Uploader:
    def __init__(self):
        self.endpoint_url = os.getenv('DO_SPACES_ENDPOINT', 'https://nyc3.digitaloceanspaces.com')
        self.access_key = os.getenv('DO_SPACES_KEY')
        self.secret_key = os.getenv('DO_SPACES_SECRET')
        self.bucket_name = os.getenv('DO_SPACES_BUCKET', 'memulacra')
        self.cdn_base_url = os.getenv('CDN_BASE_URL', 'https://memulacra.nyc3.digitaloceanspaces.com')
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        
        if not all([self.access_key, self.secret_key]):
            raise ValueError("Digital Ocean Spaces credentials not configured")
        
        # Configure boto3 client with timeouts
        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=boto3.session.Config(
                connect_timeout=10,  # 10 seconds connection timeout
                read_timeout=30,     # 30 seconds read timeout
                retries={'max_attempts': 3}
            )
        )
    
    def upload_image(self, image, uuid_str):
        """
        Upload a PIL Image to Digital Ocean Spaces with retry logic
        
        Args:
            image: PIL Image object
            uuid_str: UUID string to use as filename
            
        Returns:
            URL of the uploaded image or None if upload failed
        """
        # Define object name in the meme_instances folder
        object_name = f"meme_instances/{uuid_str}.jpg"
        
        # Convert PIL Image to bytes
        buffer = BytesIO()
        image.save(buffer, format='JPEG')
        buffer.seek(0)
        
        # Retry logic
        for attempt in range(self.max_retries):
            try:
                # Upload to Digital Ocean Spaces
                self.s3_client.upload_fileobj(
                    buffer,
                    self.bucket_name,
                    object_name,
                    ExtraArgs={
                        'ContentType': 'image/jpeg',
                        'ACL': 'public-read'  # Make the file publicly accessible
                    }
                )
                
                # Return the CDN URL
                return f"{self.cdn_base_url}/{object_name}"
                
            except ClientError as e:
                logger.error(f"Upload attempt {attempt+1} failed: {str(e)}")
                if attempt < self.max_retries - 1:
                    # Reset buffer position for next attempt
                    buffer.seek(0)
                    # Wait before retrying
                    time.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
                else:
                    logger.error(f"Failed to upload image after {self.max_retries} attempts")
                    return None
            except Exception as e:
                logger.error(f"Unexpected error during upload: {str(e)}")
                if attempt < self.max_retries - 1:
                    buffer.seek(0)
                    time.sleep(self.retry_delay * (2 ** attempt))
                else:
                    logger.error(f"Failed to upload image after {self.max_retries} attempts")
                    return None
