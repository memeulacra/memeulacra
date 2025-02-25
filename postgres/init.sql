-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create meme_templates table
CREATE TABLE meme_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT NOT NULL,
    text_box_count INTEGER NOT NULL,
    example_texts TEXT[],
    tags TEXT[],
    popularity_score FLOAT DEFAULT 0,
    embedding VECTOR(1024),  -- BGE model outputs 1024-dimensional embeddings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for similarity search on meme_templates
CREATE INDEX meme_templates_embedding_idx ON meme_templates USING ivfflat (embedding vector_l2_ops);

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    npub TEXT NULL UNIQUE,
    nsec TEXT NULL UNIQUE,
    address TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_address ON users(address);

-- Create memes table with vector support
CREATE TABLE memes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context TEXT NOT NULL,
    template_id UUID NOT NULL REFERENCES meme_templates(id),
    text_box_1 TEXT,
    text_box_2 TEXT,
    text_box_3 TEXT,
    text_box_4 TEXT,
    text_box_5 TEXT,
    text_box_6 TEXT,
    text_box_7 TEXT,
    meme_cdn_url TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    embedding VECTOR(1536), -- Using 1536 dimensions (OpenAI's text-embedding-ada-002 size)
    thumbs_up INTEGER NOT NULL DEFAULT 0,
    thumbs_down INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user interactions table
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    meme_id UUID NOT NULL REFERENCES memes(id),
    interaction_type VARCHAR(50) NOT NULL, -- e.g., 'like', 'share', 'comment'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX ON memes USING ivfflat (embedding vector_l2_ops);
CREATE INDEX ON memes(user_id);
CREATE INDEX ON user_interactions(user_id);
CREATE INDEX ON user_interactions(meme_id);

-- Create vector similarity search index for meme templates
CREATE INDEX ON meme_templates USING ivfflat (embedding vector_cosine_ops);
