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

Then run the setup script to put some demo users and imgflip meme instances into the db:

```commandline
cd setup
# create the virtual env
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python populate_meme_instances.py
```

After that's done, we can test that the api is working:

```commandline
cd .. # back to project root
cd tests
python3 -m venv venv

# optional, do this if you're still in the setup/ venv
deactivate

source venv/bin/activate
pip install -r requirements.txt
python test_batch_meme_generation.py

# wait, this could take 1-2 minutes
```

Then you should see new memes created in the db, and the output in the terminal should show resulting meme template ids and text boxes
