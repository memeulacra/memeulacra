from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import asyncio
import tempfile
import json
import requests
import uuid
from concurrent.futures import ThreadPoolExecutor
import logging
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from ai.meme_ai_flow import generate_memes_for_uuids
from PIL import Image, ImageDraw, ImageFont
from ai.s3_uploader import S3Uploader

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Memeulacra API")

# Database connection
DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER', 'memeuser')}:{os.getenv('POSTGRES_PASSWORD', 'memepass')}@db:5432/{os.getenv('POSTGRES_DB', 'memedb')}"
engine = create_engine(DATABASE_URL)

# Create a thread pool executor for running CPU-bound tasks
thread_pool = ThreadPoolExecutor(max_workers=4)

class MemeRequest(BaseModel):
    template_id: int
    text_boxes: List[str]
    context: str

class BatchMemeRequest(BaseModel):
    context: str
    uuids: List[str]

class MemeTemplate(BaseModel):
    id: int
    name: str
    description: Optional[str]
    image_url: str
    text_box_count: int
    example_texts: List[str]
    tags: List[str]
    popularity_score: float

# This function wraps our CPU-bound operations for the thread pool
async def run_in_threadpool(func, *args, **kwargs):
    return await func(*args, **kwargs)

@app.get("/")
async def root():
    return {"message": "Welcome to Memeulacra API"}

@app.get("/templates", response_model=List[MemeTemplate])
async def list_templates():
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                """
                SELECT id, name, description, image_url, text_box_count, 
                       example_texts, tags, popularity_score
                FROM meme_templates
                ORDER BY popularity_score DESC
                """
            ))
            templates = []
            for row in result:
                templates.append({
                    "id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "image_url": row[3],
                    "text_box_count": row[4],
                    "example_texts": row[5],
                    "tags": row[6],
                    "popularity_score": row[7]
                })
            return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-meme")
async def generate_meme(request: MemeRequest):
    try:
        with engine.connect() as conn:
            # Verify template exists and get its details
            template = conn.execute(
                text("SELECT text_box_count FROM meme_templates WHERE id = :id"),
                {"id": request.template_id}
            ).first()
            
            if not template:
                raise HTTPException(status_code=404, detail="Template not found")
            
            if len(request.text_boxes) > template[0]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Template only supports {template[0]} text boxes"
                )
            
            # Get default user (meme_lord)
            user_result = conn.execute(
                text("SELECT id FROM users WHERE username = 'meme_lord'")
            ).first()
            
            if not user_result:
                raise HTTPException(status_code=500, detail="Default user not found")
            
            user_id = user_result[0]
            
            # Insert meme record
            result = conn.execute(
                text("""
                    INSERT INTO memes 
                    (context, template_id, text_box_1, text_box_2, text_box_3, 
                     text_box_4, text_box_5, text_box_6, text_box_7, 
                     meme_cdn_url, user_id)
                    VALUES 
                    (:context, :template_id, :text_1, :text_2, :text_3,
                     :text_4, :text_5, :text_6, :text_7,
                     :cdn_url, :user_id)
                    RETURNING id
                """),
                {
                    "context": request.context,
                    "template_id": request.template_id,
                    "text_1": request.text_boxes[0] if len(request.text_boxes) > 0 else None,
                    "text_2": request.text_boxes[1] if len(request.text_boxes) > 1 else None,
                    "text_3": request.text_boxes[2] if len(request.text_boxes) > 2 else None,
                    "text_4": request.text_boxes[3] if len(request.text_boxes) > 3 else None,
                    "text_5": request.text_boxes[4] if len(request.text_boxes) > 4 else None,
                    "text_6": request.text_boxes[5] if len(request.text_boxes) > 5 else None,
                    "text_7": request.text_boxes[6] if len(request.text_boxes) > 6 else None,
                    "cdn_url": "https://placeholder-meme-url.com/meme.jpg",  # Placeholder
                    "user_id": user_id
                }
            )
            conn.commit()
            meme_id = result.scalar_one()
            
            return {
                "id": meme_id,
                "status": "success",
                "message": "Meme request stored successfully",
                "meme_url": "https://placeholder-meme-url.com/meme.jpg"  # Placeholder
            }
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-meme-batch")
async def generate_meme_batch(request: BatchMemeRequest):
    try:
        # Log the start of the operation
        logger.info(f"Starting batch meme generation for {len(request.uuids)} memes")
        
        # Directly await the async function
        results = await generate_memes_for_uuids(request.context, request.uuids)
        
        logger.info(f"Completed batch meme generation for {len(request.uuids)} memes")
        return {"memes": results}
    except ValueError as ve:
        # Handle validation errors (like missing UUIDs)
        logger.error(f"Validation error: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Handle other errors
        logger.exception("Error in batch meme generation")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1")).scalar()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

def draw_boxes_on_meme(image_path, boxes_data, output_path):
    """
    Draw rectangles on a meme image based on the provided coordinates.
    
    Args:
        image_path: Path to the input image
        boxes_data: JSON string containing box coordinates and labels
        output_path: Path where to save the output image
    """
    # Load the image
    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)
    
    # Get image dimensions
    img_width, img_height = img.size
    
    # Parse the JSON data (fixing the format issue)
    try:
        # The data seems to have extra wrapping and quotes
        # Remove the outer quotes and braces if they exist
        if isinstance(boxes_data, str):
            cleaned_data = boxes_data.strip('"{}"')
            # Now parse the cleaned JSON
            boxes = json.loads(cleaned_data)
        else:
            # If it's already a list/dict, use it directly
            boxes = boxes_data
    except json.JSONDecodeError:
        logger.error("Error parsing JSON data. Trying alternative approach...")
        # If the above fails, try another approach
        cleaned_data = boxes_data.replace('\\"', '"').strip('"{}"')
        boxes = json.loads(cleaned_data)
    
    # Draw each box with its label
    for box in boxes:
        # Convert percentage coordinates to pixel coordinates
        x = box["x"] * img_width / 100
        y = box["y"] * img_height / 100
        width = box["width"] * img_width / 100
        height = box["height"] * img_height / 100
        
        # Calculate box corners
        x1, y1 = x, y
        x2, y2 = x + width, y + height
        
        # Draw rectangle (with some transparency)
        draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
        
        # Add label text (optional)
        font = ImageFont.load_default()
        label_text = f"Box {box['id']}"
        if 'label' in box and box['label']:
            # Truncate long labels
            label_text += f": {box['label'][:15]}..."
        
        draw.text((x1, y1 - 20), label_text, fill="white", 
                 stroke_width=2, stroke_fill="black", font=font)
    
    # Save the result
    img.save(output_path)
    logger.info(f"Image saved to {output_path}")

@app.post("/overlay-rectangles")
async def overlay_rectangles(request: Request):
    """
    Endpoint to overlay rectangles on a meme image based on text box coordinates.
    
    Accepts:
    - image_url: URL of the meme image
    - boxes_data: List of text box coordinates with labels
    
    Returns:
    - image_url: URL of the modified image with rectangles
    """
    try:
        # Parse request body
        data = await request.json()
        image_url = data.get("image_url")
        boxes_data = data.get("boxes_data")
        
        logger.info(f"Received request to overlay rectangles on image: {image_url}")
        logger.info(f"Boxes data: {json.dumps(boxes_data)}")
        
        if not image_url or not boxes_data:
            raise HTTPException(status_code=400, detail="Missing image_url or boxes_data")
            
        # Create temporary files for input and output images
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_input:
            input_path = temp_input.name
            
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_output:
            output_path = temp_output.name
            
        try:
            # Download the image
            logger.info(f"Downloading image from: {image_url}")
            response = requests.get(image_url)
            response.raise_for_status()
            
            with open(input_path, "wb") as f:
                f.write(response.content)
                
            # Draw boxes on the image
            logger.info("Drawing boxes on the image")
            draw_boxes_on_meme(input_path, boxes_data, output_path)
            
            # Upload the modified image to the CDN
            logger.info("Uploading modified image to CDN")
            uploader = S3Uploader()
            
            # Generate a unique ID for the image
            image_id = str(uuid.uuid4())
            
            # Open the output image and upload it
            with Image.open(output_path) as img:
                cdn_url = uploader.upload_image(img, f"rectangle_overlay_{image_id}")
                
            logger.info(f"Image uploaded to CDN: {cdn_url}")
            return {"image_url": cdn_url}
        finally:
            # Clean up temporary files
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
    except Exception as e:
        logger.error(f"Error overlaying rectangles: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
