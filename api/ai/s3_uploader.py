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
        
        # Use the same CDN base URL that's working in the test file
        # This is a temporary fix until we figure out why the CDN_BASE_URL from .env isn't working
        self.cdn_base_url = f"https://{self.bucket_name}.nyc3.digitaloceanspaces.com"
        
        # Log the CDN base URL override
        env_cdn_url = os.getenv('CDN_BASE_URL', 'https://memes.supertech.ai')
        logger.info(f"Overriding CDN base URL from {env_cdn_url} to {self.cdn_base_url}")
        
        # Log the configuration for debugging
        logger.info(f"S3Uploader initialized with endpoint_url={self.endpoint_url}, bucket_name={self.bucket_name}, cdn_base_url={self.cdn_base_url}")
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        
        if not all([self.access_key, self.secret_key]):
            raise ValueError("Digital Ocean Spaces credentials not configured")
        
        # Configure boto3 client with timeouts
        try:
            # The issue might be with how boto3 is constructing the URL
            # Let's try to use a different approach by using the boto3 resource instead of client
            # This might help with the URL construction
            self.s3_resource = boto3.resource(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=boto3.session.Config(
                    connect_timeout=5,  # Reduce timeout to fail faster
                    read_timeout=10,    # Reduce timeout to fail faster
                    retries={'max_attempts': 2}  # Reduce retries to fail faster
                )
            )
            # Also create a client for operations that require it
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=boto3.session.Config(
                    connect_timeout=5,
                    read_timeout=10,
                    retries={'max_attempts': 2}
                )
            )
            logger.info(f"Successfully created boto3 S3 resource and client with endpoint_url={self.endpoint_url}")
        except Exception as e:
            logger.error(f"Failed to create boto3 S3 resource/client: {str(e)}")
            raise
    
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
        
        # Retry logic
        for attempt in range(self.max_retries):
            try:
                # Create a fresh buffer for each attempt to avoid "I/O operation on closed file" errors
                buffer = BytesIO()
                image.save(buffer, format='JPEG')
                buffer.seek(0)
                
                # Log the upload attempt
                logger.info(f"Attempt {attempt+1}: Uploading to bucket={self.bucket_name}, object_name={object_name}")
                
                # Try using the S3 resource instead of the client
                try:
                    # Get the image data as bytes
                    img_bytes = buffer.getvalue()
                    
                    # Upload using the S3 resource
                    bucket = self.s3_resource.Bucket(self.bucket_name)
                    obj = bucket.put_object(
                        Key=object_name,
                        Body=img_bytes,
                        ContentType='image/jpeg',
                        ACL='public-read'
                    )
                    logger.info(f"Successfully uploaded using S3 resource")
                except Exception as e:
                    logger.error(f"Error using S3 resource: {str(e)}")
                    
                    # If S3 resource fails, try using put_object as a fallback
                    try:
                        logger.info("Falling back to put_object")
                        self.s3_client.put_object(
                            Bucket=self.bucket_name,
                            Key=object_name,
                            Body=img_bytes,
                            ContentType='image/jpeg',
                            ACL='public-read'
                        )
                        logger.info(f"Successfully uploaded using put_object fallback")
                    except Exception as e2:
                        logger.error(f"Error using put_object fallback: {str(e2)}")
                        # If both methods fail, raise the original exception
                        raise e
                
                # Log successful upload
                logger.info(f"Successfully uploaded to bucket={self.bucket_name}, object_name={object_name}")
                
                # Return the CDN URL
                cdn_url = f"{self.cdn_base_url}/{object_name}"
                logger.info(f"Generated CDN URL: {cdn_url}")
                return cdn_url
                
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
