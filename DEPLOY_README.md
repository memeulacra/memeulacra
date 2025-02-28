# Memeulacra Deployment Scripts

These scripts automate the deployment of the Memeulacra application to a Digital Ocean droplet.

## Features

- Creates a new droplet from a base image or snapshot
- Installs Docker and Docker Compose on the droplet
- **Copies your local project directory to the droplet** (no Git needed)
- Copies environment files from local machine to the droplet
- **Migrates PostgreSQL data from the previous deployment**
- Builds and starts the Docker containers
- Tags the new droplet as active
- Removes the active tag from old droplets and optionally deletes them
- Creates snapshots for faster future deployments
- **Automatically cleans up failed deployments**
- Includes a utility script for cleaning up unused droplets

## Requirements

- Python 3.6+
- A Digital Ocean account with an API token
- SSH key added to your Digital Ocean account
- Local copy of your application code
- Environment files for your application
- rsync installed on your local machine

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/memeulacra-deployment.git
   cd memeulacra-deployment
   ```

2. Install the required Python packages:
   ```bash
   pip install requests
   ```

3. Make the scripts executable:
   ```bash
   chmod +x do-deploy.py do-create-snapshot.py do-cleanup.py
   ```

## Usage

### Deployment

To deploy the application, run:

```bash
./do-deploy.py \
  --api-token YOUR_DO_API_TOKEN \
  --ssh-key-path ~/.ssh/id_rsa \
  --local-project-path /path/to/your/project \
  --env-files-path /path/to/env/files
```

This will:
1. Create a new droplet
2. Install Docker and Docker Compose
3. Copy your local project directory to the server
4. Copy the environment files
5. Build and start the containers
6. Tag the new droplet as active
7. Remove the active tag from old droplets and delete them

### Creating Snapshots

To create a snapshot of the active droplet, run:

```bash
./do-create-snapshot.py \
  --api-token YOUR_DO_API_TOKEN
```

### Using Snapshots for Deployment

To deploy using the latest snapshot, add `--use-snapshot` to the deployment command:

```bash
./do-deploy.py \
  --api-token YOUR_DO_API_TOKEN \
  --ssh-key-path ~/.ssh/id_rsa \
  --local-project-path /path/to/your/project \
  --env-files-path /path/to/env/files \
  --use-snapshot
```

## Command Line Options

### Deployment Script (do-deploy.py)

```
--api-token          Digital Ocean API token (required)
--ssh-key-path       Path to SSH private key (required)
--local-project-path Path to your local project directory (default: .)
--droplet-name       Base name for the droplet (default: memeulacra)
--droplet-region     Region for the droplet (default: nyc1)
--droplet-size       Size of the droplet (default: s-1vcpu-1gb)
--droplet-image      Image for the droplet (default: ubuntu-20-04-x64)
--env-files-path     Path to environment files (default: .)
--active-tag         Tag for the active droplet (default: memeulacra-active)
--use-snapshot       Use the latest snapshot if available
--skip-data-migration Skip PostgreSQL data migration from old droplet
--delete-old-droplet Delete old droplet after deployment (by default, old droplets are kept)
--ssh-connection-timeout Timeout in seconds for SSH connection (default: 300)
```

### Cleanup Script (do-cleanup.py)

```
--api-token          Digital Ocean API token (required)
--name-prefix        Prefix for droplet names to clean up (default: memeulacra)
--tag                Tag to filter droplets (optional)
--keep-active        Keep droplets with memeulacra-active tag
--dry-run            List droplets without deleting them
```

### Snapshot Script (do-create-snapshot.py)

```
--api-token          Digital Ocean API token (required)
--active-tag         Tag for the active droplet (default: memeulacra-active)
--snapshot-name      Name for the snapshot (default: memeulacra-YYYYMMDD)
--keep-snapshots     Number of snapshots to keep (default: 3)
```

## Deployment Strategy

The deployment strategy implemented by these scripts is:

1. Always create a new droplet
2. If there's an existing droplet, migrate the PostgreSQL data volume
3. Deploy to the new droplet
4. Only decommission old droplets after the new one is fully configured and running
5. Use tagging to identify which droplet is active
6. By default, old droplets are kept (but untagged) for safety, and can be deleted manually

This ensures zero downtime deployments with data persistence, as the old droplet continues to serve traffic until the new one is ready, and the database data is preserved between deployments.

## File Exclusions

When copying your local project to the server, the following files/directories are automatically excluded:
- `.git`
- `node_modules`
- `__pycache__`
- `.env.example`
- `.vscode`
- `.idea`
- `*.pyc`

You can modify these exclusions in the `setup_server` function if needed.

## Recommended Workflow

1. Create a base snapshot with the initial setup
2. For future deployments, use the snapshot to speed up the process
3. Periodically create new snapshots to keep them up to date with system updates

## Troubleshooting

If you encounter issues:

1. Check that your API token has the correct permissions
2. Verify that your SSH key is properly configured
3. Make sure rsync is installed on your local machine
4. Check the output of the deployment script for specific errors
5. SSH into the droplet and check Docker logs for container issues:
   ```bash
   ssh -i ~/.ssh/id_rsa root@DROPLET_IP
   cd /opt/memeulacra
   docker-compose logs
   ```

### Cleaning Up Unused Droplets

To clean up unused droplets, you can use the cleanup script:

```bash
./do-cleanup.py \
  --api-token YOUR_DO_API_TOKEN \
  --keep-active \
  --dry-run
```

This will show which droplets would be deleted. Remove the `--dry-run` flag to actually delete them:

```bash
./do-cleanup.py \
  --api-token YOUR_DO_API_TOKEN \
  --keep-active
```

### Database Migration Issues

If you encounter problems with database migration:

1. You can skip it for one-time deployments with `--skip-data-migration`
2. The script preserves old droplets by default; use `--delete-old-droplet` only when you're sure the migration was successful
3. To manually debug database migration:
   ```bash
   # On old droplet
   ssh -i ~/.ssh/id_rsa root@OLD_DROPLET_IP
   cd /opt/memeulacra
   docker-compose stop db
   docker run --rm -v postgres_data:/source -v /tmp/postgres_backup:/backup alpine sh -c 'cd /source && tar -czf /backup/postgres_data.tar.gz .'

   # Copy to new droplet
   scp -i ~/.ssh/id_rsa root@OLD_DROPLET_IP:/tmp/postgres_backup/postgres_data.tar.gz /tmp/
   scp -i ~/.ssh/id_rsa /tmp/postgres_data.tar.gz root@NEW_DROPLET_IP:/tmp/

   # On new droplet
   ssh -i ~/.ssh/id_rsa root@NEW_DROPLET_IP
   mkdir -p /tmp/postgres_backup
   mv /tmp/postgres_data.tar.gz /tmp/postgres_backup/
   docker volume create postgres_data
   docker run --rm -v postgres_data:/target -v /tmp/postgres_backup:/backup alpine sh -c 'cd /target && tar -xzf /backup/postgres_data.tar.gz'
   cd /opt/memeulacra
   docker-compose up -d
   ```
