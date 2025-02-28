#!/usr/bin/env python3
import os
import sys
import argparse
import requests
from typing import Dict, Any, List, Optional

class DigitalOceanAPI:
    base_url = "https://api.digitalocean.com/v2"

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

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

    def get_droplet(self, droplet_id: int) -> Dict[str, Any]:
        """Get droplet details"""
        url = f"{self.base_url}/droplets/{droplet_id}"
        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"Failed to get droplet: {response.text}")

        return response.json()["droplet"]

def main():
    parser = argparse.ArgumentParser(description="Clean up Digital Ocean droplets")
    parser.add_argument("--api-token", required=True, help="Digital Ocean API token")
    parser.add_argument("--name-prefix", default="memeulacra", help="Prefix for droplet names to clean up")
    parser.add_argument("--tag", default=None, help="Tag to filter droplets (optional)")
    parser.add_argument("--keep-active", action="store_true", help="Keep droplets with memeulacra-active tag")
    parser.add_argument("--dry-run", action="store_true", help="List droplets without deleting them")

    args = parser.parse_args()

    # Create Digital Ocean API client
    do_api = DigitalOceanAPI(args.api_token)

    # Get all droplets
    all_droplets = do_api.list_droplets(args.tag)

    # Filter by name prefix if specified
    if args.name_prefix:
        droplets = [d for d in all_droplets if d["name"].startswith(args.name_prefix)]
    else:
        droplets = all_droplets

    # If keeping active droplets, identify which ones have the active tag
    active_droplets = []
    if args.keep_active:
        active_droplets = do_api.list_droplets(tag="memeulacra-active")
        active_ids = [d["id"] for d in active_droplets]
        droplets = [d for d in droplets if d["id"] not in active_ids]

    # Print droplets that will be deleted
    if not droplets:
        print("No droplets found matching the criteria")
        return 0

    print(f"Found {len(droplets)} droplet(s) to clean up:")
    for droplet in droplets:
        droplet_id = droplet["id"]
        droplet_name = droplet["name"]
        ip_address = next(
            (network["ip_address"] for network in droplet["networks"]["v4"]
             if network["type"] == "public"),
            "No IP"
        )
        status = droplet["status"]
        print(f"  {droplet_id}: {droplet_name} ({ip_address}) - Status: {status}")

    # If dry run, exit here
    if args.dry_run:
        print("\nDry run - no droplets will be deleted")
        return 0

    # Confirm deletion
    confirm = input("\nAre you sure you want to delete these droplets? (y/N) ")
    if confirm.lower() != "y":
        print("Aborted")
        return 0

    # Delete droplets
    success_count = 0
    for droplet in droplets:
        droplet_id = droplet["id"]
        droplet_name = droplet["name"]
        print(f"Deleting droplet {droplet_id} ({droplet_name})...")

        try:
            if do_api.delete_droplet(droplet_id):
                print(f"  Success!")
                success_count += 1
            else:
                print(f"  Failed to delete droplet")
        except Exception as e:
            print(f"  Error deleting droplet: {e}")

    print(f"\nDeleted {success_count} out of {len(droplets)} droplets")
    return 0

if __name__ == "__main__":
    sys.exit(main())
