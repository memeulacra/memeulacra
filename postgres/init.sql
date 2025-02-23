-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgvector;

-- Create meme_templates table
CREATE TABLE meme_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT NOT NULL,
    text_box_count INTEGER NOT NULL,
    example_texts TEXT[],
    tags TEXT[],
    popularity_score FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create memes table with vector support
CREATE TABLE memes (
    id SERIAL PRIMARY KEY,
    context TEXT NOT NULL,
    template_id INTEGER NOT NULL REFERENCES meme_templates(id),
    text_box_1 TEXT,
    text_box_2 TEXT,
    text_box_3 TEXT,
    text_box_4 TEXT,
    text_box_5 TEXT,
    text_box_6 TEXT,
    text_box_7 TEXT,
    meme_cdn_url TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    embedding vector(1536), -- Using 1536 dimensions (OpenAI's text-embedding-ada-002 size)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user interactions table
CREATE TABLE user_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    meme_id INTEGER NOT NULL REFERENCES memes(id),
    interaction_type VARCHAR(50) NOT NULL, -- e.g., 'like', 'share', 'comment'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX ON memes USING GiST(embedding vector_l2_ops);
CREATE INDEX ON memes(user_id);
CREATE INDEX ON user_interactions(user_id);
CREATE INDEX ON user_interactions(meme_id);

-- Add some example functions for vector similarity search
CREATE OR REPLACE FUNCTION search_memes_by_context(
    search_embedding vector(1536),
    similarity_threshold float,
    max_results integer
)
RETURNS TABLE (
    id integer,
    context text,
    template_name text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.context,
        mt.name as template_name,
        1 - (m.embedding <-> search_embedding) as similarity
    FROM memes m
    JOIN meme_templates mt ON m.template_id = mt.id
    WHERE 1 - (m.embedding <-> search_embedding) > similarity_threshold
    ORDER BY m.embedding <-> search_embedding
    LIMIT max_results;
END;
$$;

-- Add sample templates
INSERT INTO meme_templates (name, description, image_url, text_box_count, example_texts, tags, popularity_score) VALUES 
    ('Drake', 'Drake Hotline Bling meme format', 'https://api.memegen.link/images/drake.png', 2, 
     ARRAY['Thing I don''t like', 'Thing I do like'], 
     ARRAY['reaction', 'comparison', 'preference'],
     100),
    ('Distracted Boyfriend', 'Man looking back at another woman', 'https://api.memegen.link/images/distracted.png', 3,
     ARRAY['Current thing', 'Person', 'New thing'],
     ARRAY['relationships', 'temptation', 'distraction'],
     95),
    ('Woman Yelling at Cat', 'Woman yelling at confused cat at dinner table', 'https://api.memegen.link/images/cat.png', 2,
     ARRAY['Woman yelling', 'Confused cat response'],
     ARRAY['argument', 'confusion', 'cats'],
     90);

-- Add sample data
INSERT INTO users (username) VALUES 
    ('meme_lord'),
    ('dank_master'),
    ('meme_queen');

-- Example of how to insert a meme (commented out as it needs real vector data)
/*
INSERT INTO memes (context, meme_type, text_box_1, text_box_2, meme_cdn_url, user_id, embedding) 
VALUES (
    'When you finally understand how vector embeddings work',
    'DRAKE',
    'Traditional SQL queries',
    'Vector similarity search',
    'https://example.com/drake.jpg',
    1,
    '[0.1, 0.2, ...]'::vector
);
*/
