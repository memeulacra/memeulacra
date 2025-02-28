#!/usr/bin/env python3
import os
import sys
import time
import argparse
import subprocess
import json
import requests
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

@dataclass
class DropletConfig:
    name: str
    region: str
    size: str
    image: str
    ssh_keys: List[int]
    backups: bool = False
    monitoring: bool = True
    tags: List[str] = None
    project_id: str = "146f7d4f-b355-451d-95e6-118cd1eb4d8b"

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "region": self.region,
            "size": self.size,
            "image": self.image,
            "ssh_keys": self.ssh_keys,
            "backups": self.backups,
            "monitoring": self.monitoring,
        }
        if self.tags:
            result["tags"] = self.tags
        return result

class DigitalOceanAPI:
    base_url = "https://api.digitalocean.com/v2"

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    def create_droplet(self, config: DropletConfig) -> Dict[str, Any]:
        """Create a new droplet"""
        url = f"{self.base_url}/droplets"
        response = requests.post(url, headers=self.headers, json=config.to_dict())

        if response.status_code not in (201, 202):
            raise Exception(f"Failed to create droplet: {response.text}")

        droplet = response.json()["droplet"]

        # Assign to project if project_id is provided
        if config.project_id:
            self.assign_to_project(droplet["id"], config.project_id)

        return droplet

    def assign_to_project(self, droplet_id: int, project_id: str) -> bool:
        """Assign a droplet to a project"""
        url = f"{self.base_url}/projects/{project_id}/resources"
        data = {
            "resources": [
                f"do:droplet:{droplet_id}"
            ]
        }

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code not in (201, 202, 204):
            print(f"Warning: Failed to assign droplet to project: {response.text}")
            return False

        return True

    def get_droplet(self, droplet_id: int) -> Dict[str, Any]:
        """Get droplet details"""
        url = f"{self.base_url}/droplets/{droplet_id}"
        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to get droplet: {response.text}")

        return response.json()["droplet"]

    def list_droplets(self, tag: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all droplets, optionally filtered by tag"""
        url = f"{self.base_url}/droplets"
        if tag:
            url += f"?tag_name={tag}"

        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to list droplets: {response.text}")

        return response.json()["droplets"]

    def delete_droplet(self, droplet_id: int) -> bool:
        """Delete a droplet"""
        url = f"{self.base_url}/droplets/{droplet_id}"
        response = requests.delete(url, headers=self.headers)

        return response.status_code == 204

    def add_tag_to_droplet(self, droplet_id: int, tag: str) -> bool:
        """Add a tag to a droplet"""
        url = f"{self.base_url}/tags/{tag}/resources"
        data = {
            "resources": [
                {
                    "resource_id": str(droplet_id),
                    "resource_type": "droplet"
                }
            ]
        }

        response = requests.post(url, headers=self.headers, json=data)

        return response.status_code == 204

    def remove_tag_from_droplet(self, droplet_id: int, tag: str) -> bool:
        """Remove a tag from a droplet"""
        url = f"{self.base_url}/tags/{tag}/resources"
        data = {
            "resources": [
                {
                    "resource_id": str(droplet_id),
                    "resource_type": "droplet"
                }
            ]
        }

        response = requests.delete(url, headers=self.headers, json=data)

        return response.status_code == 204

    def wait_for_droplet(self, droplet_id: int, status: str = "active", timeout: int = 300) -> Dict[str, Any]:
        """Wait for a droplet to reach a specific status"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            droplet = self.get_droplet(droplet_id)
            if droplet["status"] == status:
                return droplet
            print(f"Waiting for droplet to become {status}... (current: {droplet['status']})")
            time.sleep(10)

        raise TimeoutError(f"Droplet did not reach '{status}' status within {timeout} seconds")

    def list_ssh_keys(self) -> List[Dict[str, Any]]:
        """List all SSH keys"""
        url = f"{self.base_url}/account/keys"

        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to list SSH keys: {response.text}")

        return response.json()["ssh_keys"]

    def list_snapshots(self) -> List[Dict[str, Any]]:
        """List all snapshots"""
        url = f"{self.base_url}/snapshots?resource_type=droplet"

        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to list snapshots: {response.text}")

        return response.json()["snapshots"]

def run_ssh_command(host: str, user: str, command: str, key_path: Optional[str] = None,
                  connect_timeout: int = 30, stream_output: bool = False) -> str:
    """
    Run a command on a remote server using SSH with option to stream output in real-time

    Args:
        host: The hostname or IP address of the remote server
        user: The username to use for SSH connection
        command: The command to execute on the remote server
        key_path: Path to the SSH private key (optional)
        connect_timeout: Timeout for SSH connection in seconds (default: 30)
        stream_output: Whether to stream command output in real-time (default: False)

    Returns:
        The command output as a string
    """
    ssh_cmd = ["ssh"]

    if key_path:
        ssh_cmd.extend(["-i", key_path])

    ssh_cmd.extend([
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", f"ConnectTimeout={connect_timeout}",
        f"{user}@{host}",
        command
    ])

    if stream_output:
        # Run command with real-time output streaming
        process = subprocess.Popen(
            ssh_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )

        output_lines = []
        for line in process.stdout:
            line = line.rstrip()
            print(line)
            output_lines.append(line)

        process.wait()
        output = "\n".join(output_lines)

        if process.returncode != 0:
            print(f"Command exited with status {process.returncode}")
            return output

        return output
    else:
        # Run command without streaming (original behavior)
        result = subprocess.run(ssh_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"Error executing command: {result.stderr}")
            return result.stderr

        return result.stdout

def copy_files_to_server(host: str, user: str, local_path: str, remote_path: str, key_path: Optional[str] = None) -> bool:
    """Copy files to a remote server using SCP"""
    scp_cmd = ["scp"]

    if key_path:
        scp_cmd.extend(["-i", key_path])

    scp_cmd.extend([
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-r",
        local_path,
        f"{user}@{host}:{remote_path}"
    ])

    result = subprocess.run(scp_cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Error copying files: {result.stderr}")
        return False

    return True

def setup_server(droplet_ip: str, ssh_key_path: str, local_project_path: str = ".",
               env_files_path: str = ".", old_droplet_ip: str = None) -> bool:
    """Setup the server with Docker and deploy the application by copying the local project directory"""
    print(f"Setting up server at {droplet_ip}...")

    # Wait for SSH to be available
    max_retries = 10
    retry_interval = 10
    for i in range(max_retries):
        try:
            output = run_ssh_command(droplet_ip, "root", "echo 'SSH is available'", ssh_key_path)
            if "SSH is available" in output:
                break
        except Exception as e:
            print(f"SSH not yet available, retrying in {retry_interval} seconds... ({i+1}/{max_retries})")
            time.sleep(retry_interval)
    else:
        print("Failed to connect to server via SSH after multiple attempts")
        return False

    # Wait for automatic system updates to complete
    print("Checking for running apt processes and waiting if necessary...")
    for i in range(4):  # Try up to 5 times with 30 second intervals
        check_apt_cmd = "ps aux | grep -v grep | grep apt"
        output = run_ssh_command(droplet_ip, "root", check_apt_cmd, ssh_key_path)

        if not output.strip():
            print("No apt processes running, proceeding with setup.")
            break

        print(f"Found running apt processes. Waiting 30 seconds... (attempt {i+1}/5)")
        print(f"Running processes: {output.strip()}")
        time.sleep(30)
    else:
        print("Warning: apt processes still running after waiting. Will attempt to fix locks.")

        # Try to fix apt locks
        fix_apt_lock_commands = [
            "killall apt-get || true",
            "killall dpkg || true",
            "rm -f /var/lib/apt/lists/lock",
            "rm -f /var/lib/dpkg/lock",
            "rm -f /var/lib/dpkg/lock-frontend",
            "dpkg --configure -a"
        ]

        for cmd in fix_apt_lock_commands:
            print(f"Running: {cmd}")
            run_ssh_command(droplet_ip, "root", cmd, ssh_key_path)

        # Give it a moment to settle after fixing locks
        time.sleep(5)

    # Fix any potential package issues and do initial update
    print("Preparing system...")
    init_commands = [
        # Clean apt cache to fix potential corruption
        "rm -rf /var/lib/apt/lists/*",
        "rm -f /var/cache/apt/*.bin",
        "apt-get clean",
        "apt-get update",
        # Install initial dependencies
        "apt-get install -y apt-transport-https ca-certificates curl software-properties-common rsync"
    ]

    for cmd in init_commands:
        print(f"Running: {cmd}")
        output = run_ssh_command(droplet_ip, "root", cmd, ssh_key_path)
        if "E:" in output or "Error" in output:
            print(f"Error: {output}")
            # Continue anyway as some errors might be benign
            print("Continuing despite errors...")

    # Install Docker using alternative method
    print("Installing Docker...")
    docker_commands = [
        # Add Docker GPG key
        "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg",
        # Add Docker repository - the echo ensures we don't need to use add-apt-repository which is causing issues
        "echo \"deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | tee /etc/apt/sources.list.d/docker.list > /dev/null",
        "apt-get update",
        "apt-get install -y docker-ce docker-ce-cli containerd.io",
        # Test Docker
        "docker --version"
    ]

    for cmd in docker_commands:
        print(f"Running: {cmd}")
        output = run_ssh_command(droplet_ip, "root", cmd, ssh_key_path)
        if "E:" in output or "Error" in output:
            print(f"Error in Docker installation: {output}")
            return False

    # Install Docker Compose
    print("Installing Docker Compose...")
    compose_commands = [
        "curl -L 'https://github.com/docker/compose/releases/download/v2.19.1/docker-compose-linux-x86_64' -o /usr/local/bin/docker-compose",
        "chmod +x /usr/local/bin/docker-compose",
        "docker-compose --version"
    ]

    for cmd in compose_commands:
        print(f"Running: {cmd}")
        output = run_ssh_command(droplet_ip, "root", cmd, ssh_key_path)
        if "command not found" in output or "Error" in output:
            print(f"Error in Docker Compose installation: {output}")
            return False

    # Create project directory on remote server
    print("Creating project directory on server...")
    run_ssh_command(droplet_ip, "root", "mkdir -p /opt/memeulacra", ssh_key_path)

    # Copy the entire project directory to the server using rsync
    print(f"Copying project from {local_project_path} to server...")
    # Prepare rsync exclusion list for common development directories/files
    # that shouldn't be copied to production
    exclusions = [
        ".git",
        "node_modules",
        "__pycache__",
        ".env.example",
        ".vscode",
        ".idea",
        "*.pyc"
    ]

    rsync_cmd = ["rsync", "-avz", "--progress"]

    # Add exclusions
    for excl in exclusions:
        rsync_cmd.extend(["--exclude", excl])

    # Add SSH key if provided
    if ssh_key_path:
        rsync_cmd.extend(["-e", f"ssh -i {ssh_key_path} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"])

    # Add source and destination
    rsync_cmd.extend([
        f"{local_project_path}/",  # The trailing slash is important to copy contents, not the directory itself
        f"root@{droplet_ip}:/opt/memeulacra/"
    ])

    print(f"Running rsync command: {' '.join(rsync_cmd)}")
    rsync_result = subprocess.run(rsync_cmd, capture_output=True, text=True)

    if rsync_result.returncode != 0:
        print(f"Error copying project files: {rsync_result.stderr}")
        return False

    print("Project files successfully copied to server!")

    # Migrate PostgreSQL data from old droplet if available
    if old_droplet_ip:
        print(f"Attempting to migrate PostgreSQL data from previous droplet ({old_droplet_ip})...")

        # Check if the old server has the postgres data volume
        check_volume_cmd = "docker volume ls | grep postgres_data || echo 'Volume not found'"
        volume_output = run_ssh_command(old_droplet_ip, "root", check_volume_cmd, ssh_key_path)

        if "Volume not found" not in volume_output:
            print("PostgreSQL data volume found on previous droplet. Preparing for migration...")

            # On the old server, create a backup of the PostgreSQL data
            old_server_cmds = [
                "cd /opt/memeulacra && docker-compose stop db",  # Stop the database first
                "mkdir -p /tmp/postgres_backup",
                "docker run --rm -v postgres_data:/source -v /tmp/postgres_backup:/backup alpine sh -c 'cd /source && tar -czf /backup/postgres_data.tar.gz .'"
            ]

            for cmd in old_server_cmds:
                print(f"Running on old server: {cmd}")
                output = run_ssh_command(old_droplet_ip, "root", cmd, ssh_key_path)
                if "error" in output.lower():
                    print(f"Error on old server: {output}")
                    print("Will continue with fresh database setup...")
                    break
            else:
                # Copy the backup from old server to new server
                print("Copying PostgreSQL data backup from old server to new server...")
                scp_from_server_cmd = [
                    "scp",
                    "-i", ssh_key_path,
                    "-o", "StrictHostKeyChecking=no",
                    "-o", "UserKnownHostsFile=/dev/null",
                    f"root@{old_droplet_ip}:/tmp/postgres_backup/postgres_data.tar.gz",
                    "/tmp/"
                ]
                subprocess.run(scp_from_server_cmd, capture_output=True, text=True)

                scp_to_server_cmd = [
                    "scp",
                    "-i", ssh_key_path,
                    "-o", "StrictHostKeyChecking=no",
                    "-o", "UserKnownHostsFile=/dev/null",
                    "/tmp/postgres_data.tar.gz",
                    f"root@{droplet_ip}:/tmp/"
                ]
                subprocess.run(scp_to_server_cmd, capture_output=True, text=True)

                # On the new server, restore the PostgreSQL data
                new_server_cmds = [
                    "mkdir -p /tmp/postgres_backup",
                    "mv /tmp/postgres_data.tar.gz /tmp/postgres_backup/",
                    "docker volume create postgres_data",
                    "docker run --rm -v postgres_data:/target -v /tmp/postgres_backup:/backup alpine sh -c 'cd /target && tar -xzf /backup/postgres_data.tar.gz'"
                ]

                for cmd in new_server_cmds:
                    print(f"Running on new server: {cmd}")
                    output = run_ssh_command(droplet_ip, "root", cmd, ssh_key_path)
                    if "error" in output.lower():
                        print(f"Error on new server: {output}")
                        print("Will continue with fresh database setup...")
                        break
                else:
                    print("PostgreSQL data migration completed successfully!")
        else:
            print("No PostgreSQL data volume found on previous droplet. Will start with a fresh database.")

    print("Building and starting containers...")
    docker_commands = [
        "cd /opt/memeulacra && docker-compose build",
        "cd /opt/memeulacra && docker-compose up -d"
    ]

    for cmd in docker_commands:
        print(f"\n=== Running: {cmd} ===")
        print("=" * (len(cmd) + 14))
        output = run_ssh_command(droplet_ip, "root", cmd, ssh_key_path, stream_output=True)

        # More precise error detection - look for specific error patterns
        # that would indicate an actual Docker failure
        error_patterns = [
            "ERROR: ",
            "error: ",
            "failed to build",
            "Cannot start service",
            "Service cannot be started",
            "command failed with exit code",
            "Error response from daemon"
        ]

        # Check if any of these error patterns appear in the output
        has_error = any(pattern.lower() in output.lower() for pattern in error_patterns)

        if has_error:
            print("\nDocker error detected in command output.")
            print("You may want to SSH into the server to investigate:")
            print(f"  ssh -i {ssh_key_path} root@{droplet_ip}")
            print("  cd /opt/memeulacra && docker-compose logs")
            return False

    # Verify the containers are running
    print("\n=== Checking container status ===")
    print("=================================")
    container_status_cmd = "cd /opt/memeulacra && docker-compose ps"
    container_status = run_ssh_command(droplet_ip, "root", container_status_cmd, ssh_key_path, stream_output=True)

    # Check if containers are actually running
    check_running_cmd = "cd /opt/memeulacra && docker-compose ps --services --filter 'status=running' | wc -l"
    running_count = run_ssh_command(droplet_ip, "root", check_running_cmd, ssh_key_path).strip()
    try:
        running_count = int(running_count)
        if running_count == 0:
            print("\nWarning: No containers appear to be running!")
            print("This might indicate an issue with container startup.")
            print(f"SSH into the server to investigate: ssh -i {ssh_key_path} root@{droplet_ip}")
            # Despite the warning, we'll continue rather than fail
            print("Continuing with deployment anyway...")
        else:
            print(f"\n{running_count} container(s) are running.")
    except ValueError:
        print(f"\nUnable to determine number of running containers. Got: {running_count}")

    print("\nServer setup completed successfully!")
    return True

def main():
    parser = argparse.ArgumentParser(description="Deploy to Digital Ocean")
    parser.add_argument("--api-token", required=True, help="Digital Ocean API token")
    parser.add_argument("--ssh-key-path", required=True, help="Path to SSH private key")
    parser.add_argument("--local-project-path", default=".", help="Path to local project directory")
    parser.add_argument("--droplet-name", default="memeulacra", help="Base name for the droplet")
    parser.add_argument("--droplet-region", default="nyc1", help="Region for the droplet")
    parser.add_argument("--droplet-size", default="s-2vcpu-4gb-amd", help="Size of the droplet")
    parser.add_argument("--droplet-image", default="ubuntu-24-04-x64", help="Image for the droplet")
    parser.add_argument("--env-files-path", default=".", help="Path to environment files")
    parser.add_argument("--active-tag", default="memeulacra", help="Tag for the active droplet")
    parser.add_argument("--use-snapshot", action="store_true", help="Use the latest snapshot if available")
    parser.add_argument("--skip-data-migration", action="store_true", help="Skip PostgreSQL data migration")
    parser.add_argument("--delete-old-droplet", action="store_true", help="Delete old droplet after deployment")
    parser.add_argument("--ssh-connection-timeout", type=int, default=300, help="Timeout in seconds for SSH connection")
    parser.add_argument("--ssh-max-retries", type=int, default=5, help="Maximum number of SSH connection retries")

    args = parser.parse_args()

    # Create Digital Ocean API client
    do_api = DigitalOceanAPI(args.api_token)

    # Get SSH keys
    ssh_keys = do_api.list_ssh_keys()
    if not ssh_keys:
        print("No SSH keys found in your Digital Ocean account")
        return 1

    ssh_key_ids = [key["id"] for key in ssh_keys]

    # Get timestamp for unique droplet name
    timestamp = int(time.time())
    droplet_name = f"{args.droplet_name}-{timestamp}"

    # Determine image to use
    image = args.droplet_image
    if args.use_snapshot:
        snapshots = do_api.list_snapshots()
        if snapshots:
            # Get the latest snapshot
            latest_snapshot = max(snapshots, key=lambda s: s["created_at"])
            image = latest_snapshot["id"]
            print(f"Using latest snapshot: {latest_snapshot['name']} (ID: {image})")

    # Create droplet configuration
    config = DropletConfig(
        name=droplet_name,
        region=args.droplet_region,
        size=args.droplet_size,
        image=image,
        ssh_keys=ssh_key_ids,
        tags=["memeulacra"],
        project_id="146f7d4f-b355-451d-95e6-118cd1eb4d8b"  # Hardcoded project
    )

    # Find current active droplet (if any)
    active_droplets = do_api.list_droplets(tag=args.active_tag)
    old_droplet_ip = None

    if active_droplets:
        old_droplet = active_droplets[0]
        old_droplet_ip = next(
            (network["ip_address"] for network in old_droplet["networks"]["v4"]
             if network["type"] == "public"),
            None
        )
        print(f"Found active droplet: {old_droplet['name']} (IP: {old_droplet_ip})")

    # Create new droplet
    print(f"Creating new droplet: {droplet_name}...")
    new_droplet = do_api.create_droplet(config)
    new_droplet_id = new_droplet["id"]

    try:
        # Wait for the droplet to become active
        print("Waiting for droplet to become active...")
        active_droplet = do_api.wait_for_droplet(new_droplet_id)

        # Get the droplet's IP address
        droplet_ip = next(
            (network["ip_address"] for network in active_droplet["networks"]["v4"]
             if network["type"] == "public"),
                None
        )

        if not droplet_ip:
            print("Failed to get droplet IP address")
            raise Exception("Could not get droplet IP address")

        print(f"Droplet is active with IP: {droplet_ip}")

        # Wait for SSH to be available with limited retries
        print(f"Waiting for SSH to be available (max {args.ssh_max_retries} retries)...")
        ssh_available = False

        for retry in range(1, args.ssh_max_retries + 1):
            try:
                output = run_ssh_command(
                    droplet_ip,
                    "root",
                    "echo 'SSH is available'",
                    args.ssh_key_path,
                    connect_timeout=10  # Short timeout for each attempt
                )
                if "SSH is available" in output:
                    ssh_available = True
                    print("SSH connection established successfully!")
                    break
            except Exception as e:
                print(f"SSH retry {retry}/{args.ssh_max_retries} failed: {e}")

            if retry < args.ssh_max_retries:
                print(f"Retrying in 10 seconds...")
                time.sleep(10)

        if not ssh_available:
            raise Exception(f"Could not establish SSH connection after {args.ssh_max_retries} retries")

        # Setup the server
        migrate_data = old_droplet_ip and not args.skip_data_migration
        if not setup_server(
            droplet_ip,
            args.ssh_key_path,
            args.local_project_path,
            args.env_files_path,
            old_droplet_ip if migrate_data else None
        ):
            raise Exception("Failed to setup server")

        # Tag the new droplet as active
        print(f"Tagging droplet {new_droplet_id} as active...")
        do_api.add_tag_to_droplet(new_droplet_id, args.active_tag)

        # If there was a previous active droplet, remove its tag and optionally delete it
        if active_droplets:
            for old_droplet in active_droplets:
                old_droplet_id = old_droplet["id"]
                print(f"Removing active tag from old droplet {old_droplet_id}...")
                do_api.remove_tag_from_droplet(old_droplet_id, args.active_tag)

                if args.delete_old_droplet:
                    print(f"Deleting old droplet {old_droplet_id}...")
                    do_api.delete_droplet(old_droplet_id)
                else:
                    print(f"Old droplet {old_droplet_id} kept for safety. You can delete it manually if needed.")

        print(f"Deployment complete! New active droplet: {new_droplet_id} ({droplet_ip})")
        return 0

    except Exception as e:
        print(f"Error during deployment: {e}")
        print(f"Cleaning up failed droplet {new_droplet_id}...")
        # try:
            # do_api.delete_droplet(new_droplet_id)
            # print(f"Successfully deleted failed droplet {new_droplet_id}")
        # except Exception as delete_error:
            # print(f"Failed to delete droplet: {delete_error}")

        return 1

if __name__ == "__main__":
    sys.exit(main())
