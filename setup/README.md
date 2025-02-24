# Setup Scripts

This directory contains scripts for setting up and populating the database with initial data.

## Prerequisites

- Python 3.11+
- PostgreSQL running (via Docker)
- Virtual environment (recommended)

## Installation

Create and activate a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Scripts

Process memes should go first, then populate meme instances

### process_memes.py

This script processes meme templates and their metadata. It:
1. Processes template images
2. Generates embeddings
3. Populates the meme_templates table

To run:
```bash
cd setup
python process_memes.py
```

### populate_meme_instances.py

This script populates the memes table with instances from the imgflip dataset. It:
1. Creates 10 demo users
2. Reads all JSON files in `imgflip_data/memes/`
3. Maps each meme instance to the correct template
4. Inserts the memes into the database

To run:
```bash
cd setup
python populate_meme_instances.py
```

