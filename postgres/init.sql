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
    text_box_coordinates JSONB[],  -- Array of {box_number, x, y, width, height} objects as percentages
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comment explaining text_box_coordinates format
COMMENT ON COLUMN meme_templates.text_box_coordinates IS 'Array of JSON objects with format: [{"box_number": 1, "x": 10, "y": 5, "width": 80, "height": 20}, ...]. Coordinates are percentages of image dimensions.';

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
    title TEXT, -- Title for the meme
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
    pos_contributing_meme_ids UUID[], -- Array of UUIDs of memes that positively contributed to this meme's generation
    neg_contributing_meme_ids UUID[], -- Array of UUIDs of memes that negatively contributed to this meme's generation
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



-- Create sessions table - uses UUID for consistency with your schema
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_wallet_address
    FOREIGN KEY (wallet_address)
    REFERENCES users(address)
    ON DELETE CASCADE
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_wallet_address
  ON sessions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

-- Create or update function to manage timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
  END IF;
END
$$;
