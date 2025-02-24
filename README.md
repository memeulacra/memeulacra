# memeulacra
Core AI engine for meme generation and self-learning


## Setup

First, create the database and api containers:

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
python populate_meme_instances.py
```

At this point, good to check the database has about 100 rows in the meme_templates table.

Then generate sample meme instances and scoring data from the imgflip dataset

```
python populate_meme_instances.py
```
