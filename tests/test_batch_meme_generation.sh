#!/bin/bash

# Database connection parameters (from docker-compose.yml)
DB_USER="memeuser"
DB_PASS="memepass"
DB_NAME="memedb"
DB_HOST="localhost"
DB_PORT="5432"
DB_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"

set -e  # Exit on error

# Check required commands
for cmd in jq psql curl; do
    if ! command -v $cmd &> /dev/null; then
        echo "Error: $cmd is required but not installed"
        exit 1
    fi
done

# Test database connection and check for meme templates
echo "Testing database connection..."
if ! psql -q "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "Error: Could not connect to database"
    exit 1
fi

echo "Checking for meme templates..."
TEMPLATE_COUNT=$(psql -t -A "$DB_URL" -c "SELECT COUNT(*) FROM meme_templates;")
if [ "$TEMPLATE_COUNT" -eq 0 ]; then
    echo "Error: No meme templates found in database"
    exit 1
fi

echo "Checking for users..."
USER_COUNT=$(psql -t -A "$DB_URL" -c "SELECT COUNT(*) FROM users;")
if [ "$USER_COUNT" -eq 0 ]; then
    echo "Error: No users found in database"
    exit 1
fi

# Test script for batch meme generation API
# This script:
# 1. Creates 10 placeholder meme records in the database
# 2. Retrieves their UUIDs
# 3. Calls the batch generation API with these UUIDs
# 4. Verifies the response

# Create temporary file for SQL output
TMP_FILE=$(mktemp)

echo "Creating 10 placeholder meme records..."

# Insert records and capture UUIDs
psql -t -A "$DB_URL" << EOF > "$TMP_FILE" || {
    echo "Error: Failed to execute database query"
    rm "$TMP_FILE"
    exit 1
}
WITH inserted_memes AS (
  INSERT INTO memes (
    context,
    template_id,
    meme_cdn_url,
    user_id
  )
  SELECT 
    'placeholder context',
    (SELECT id FROM meme_templates LIMIT 1),
    'https://placeholder-url.com/meme.jpg',
    (SELECT id FROM users LIMIT 1)
  FROM generate_series(1,10)
  RETURNING id
)
SELECT json_agg(id::text) FROM inserted_memes;
EOF

# Extract UUIDs from psql output and clean it up
UUIDS=$(tail -n 1 "$TMP_FILE" | tr -d '[:space:]')

# Clean up temp file
rm "$TMP_FILE"

# Check if we got UUIDs
if [ "$UUIDS" = "null" ] || [ -z "$UUIDS" ]; then
    echo "Error: Failed to create meme records or get UUIDs"
    exit 1
fi

echo "Created meme records with UUIDs: $UUIDS"

# Construct proper JSON payload
PAYLOAD=$(cat <<EOF
{
  "context": "Testing batch meme generation with creative and humorous variations",
  "uuids": $UUIDS
}
EOF
)

echo "Checking if API is running..."
if ! curl -s --max-time 5 "http://localhost:8000/health" > /dev/null; then
    echo "Error: API is not running at http://localhost:8000"
    exit 1
fi

echo "Calling batch generation API..."
echo "Sending payload:"
echo "$PAYLOAD" | jq '.'

# Call the API with the UUIDs
curl -v -f --max-time 30 -X POST http://localhost:8000/generate-meme-batch \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | jq '.' || {
    echo "Error: API request failed"
    exit 1
}

echo -e "\nTest completed!"
