# memeulacra
Core AI engine for meme generation and self-learning


## Setup from scratch

Make a .env file with api keys with these servies:

```bash
VENICE_API_TOKEN=...
ANTHROPIC_API_KEY=...
```

Create the database and api containers:

```commandline
docker compose up --build
```

Then run the setup scripts in this order

```commandline
cd setup
# create the virtual env
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python process_memes.py
python populate_meme_instances.py
```