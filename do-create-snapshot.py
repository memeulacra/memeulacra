#!/usr/bin/env python3
import os
import sys
import time
import argparse
import requests
from typing import Dict, Any, List

class DigitalOceanAPI:
    base_url = "https://api.digitalocean.com/v2"

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    def list_droplets(self, tag: str = None) -> List[Dict[str, Any]]:
        """List all droplets, optionally filtered by tag"""
        url = f"{self.base_url}/droplets"
        if tag:
            url += f"?tag_name={tag}"

        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to list droplets: {response.text}")

        return response.json()["droplets"]

    def create_snapshot(self, droplet_id: int, name: str) -> Dict[str, Any]:
        """Create a snapshot of a droplet"""
        url = f"{self.base_url}/droplets/{droplet_id}/actions"
        data = {
            "type": "snapshot",
            "name": name
        }

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code not in (201, 202):
            raise Exception(f"Failed to create snapshot: {response.text}")

        return response.json()["action"]

    def get_action_status(self, droplet_id: int, action_id: int) -> Dict[str, Any]:
        """Get the status of an action"""
        url = f"{self.base_url}/droplets/{droplet_id}/actions/{action_id}"

        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to get action status: {response.text}")

        return response.json()["action"]

    def wait_for_action(self, droplet_id: int, action_id: int, timeout: int = 600) -> Dict[str, Any]:
        """Wait for an action to complete"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            action = self.get_action_status(droplet_id, action_id)
            if action["status"] == "completed":
                return action
            print(f"Waiting for action to complete... (current: {action['status']})")
            time.sleep(15)

        raise TimeoutError(f"Action did not complete within {timeout} seconds")

    def list_snapshots(self) -> List[Dict[str, Any]]:
        """List all snapshots"""
        url = f"{self.base_url}/snapshots?resource_type=droplet"

        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to list snapshots: {response.text}")

        return response.json()["snapshots"]

    def delete_snapshot(self, snapshot_id: str) -> bool:
        """Delete a snapshot"""
        url = f"{self.base_url}/snapshots/{snapshot_id}"

        response = requests.delete(url, headers=self.headers)

        return response.status_code == 204

def main():
    parser = argparse.ArgumentParser(description="Create a snapshot of a Digital Ocean droplet")
    parser.add_argument("--api-token", required=True, help="Digital Ocean API token")
    parser.add_argument("--active-tag", default="memeulacra", help="Tag for the active droplet")
    parser.add_argument("--snapshot-name", default=None, help="Name for the snapshot (default: memeulacra-YYYYMMDD)")
    parser.add_argument("--keep-snapshots", type=int, default=3, help="Number of snapshots to keep")

    args = parser.parse_args()

    # Create Digital Ocean API client
    do_api = DigitalOceanAPI(args.api_token)

    # Find active droplet
    active_droplets = do_api.list_droplets(tag=args.active_tag)

    if not active_droplets:
        print(f"No active droplets found with tag '{args.active_tag}'")
        return 1

    # Use the first active droplet (there should be only one)
    droplet = active_droplets[0]
    droplet_id = droplet["id"]
    droplet_name = droplet["name"]

    # Generate snapshot name if not provided
    if not args.snapshot_name:
        timestamp = time.strftime("%Y%m%d")
        snapshot_name = f"memeulacra-{timestamp}"
    else:
        snapshot_name = args.snapshot_name

    print(f"Creating snapshot '{snapshot_name}' of droplet '{droplet_name}' (ID: {droplet_id})...")

    # Create snapshot
    action = do_api.create_snapshot(droplet_id, snapshot_name)
    action_id = action["id"]

    print(f"Snapshot creation initiated (Action ID: {action_id})")
    print("This may take several minutes...")

    # Wait for the snapshot to complete
    try:
        do_api.wait_for_action(droplet_id, action_id)
        print("Snapshot created successfully!")
    except TimeoutError as e:
        print(f"Warning: {e}")
        print("The snapshot might still be in progress. Check the Digital Ocean dashboard.")
        return 1

    # Clean up old snapshots if needed
    if args.keep_snapshots > 0:
        # Get all snapshots
        snapshots = do_api.list_snapshots()

        # Filter out snapshots related to our application
        app_snapshots = [s for s in snapshots if s["name"].startswith("memeulacra-")]

        # Sort by creation date, newest first
        app_snapshots.sort(key=lambda s: s["created_at"], reverse=True)

        # Delete old snapshots
        if len(app_snapshots) > args.keep_snapshots:
            for snapshot in app_snapshots[args.keep_snapshots:]:
                snapshot_id = snapshot["id"]
                snapshot_name = snapshot["name"]
                print(f"Deleting old snapshot '{snapshot_name}' (ID: {snapshot_id})...")
                do_api.delete_snapshot(snapshot_id)

    return 0

if __name__ == "__main__":
    sys.exit(main())
