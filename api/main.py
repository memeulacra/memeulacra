from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from ai.meme_ai_flow import generate_memes_for_uuids

load_dotenv()

app = FastAPI(title="Memeulacra API")

# Database connection
DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER', 'memeuser')}:{os.getenv('POSTGRES_PASSWORD', 'memepass')}@db:5432/{os.getenv('POSTGRES_DB', 'memedb')}"
engine = create_engine(DATABASE_URL)

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
        # Call the meme generation function
        results = generate_memes_for_uuids(request.context, request.uuids)
        return {"memes": results}
    except ValueError as ve:
        # Handle validation errors (like missing UUIDs)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Handle other errors
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
