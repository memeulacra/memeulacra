#!/bin/bash
    
# Usage example:
#./deploy-copy.sh -s ./ -k ~/.ssh/id_rsa 208.68.37.233

# Default values
TARGET_DIR="/opt/memeulacra"
SSH_KEY="$HOME/.ssh/id_rsa"
SOURCE_DIR="."

# Show usage information
function show_usage {
    echo "Usage: $0 [options] TARGET_IP"
    echo "Deploy files to a remote server using rsync"
    echo ""
    echo "Options:"
    echo "  -s, --source DIR     Source directory to sync from (default: current directory)"
    echo "  -d, --dest DIR       Target directory on the server (default: /opt/memeulacra)"
    echo "  -k, --key FILE       Path to SSH private key (default: ~/.ssh/id_rsa)"
    echo "  -e, --exclude PAT    Pattern to exclude (can be specified multiple times)"
    echo "  -n, --dry-run        Show what would be synced without actually copying"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -s ./my-project -k ~/.ssh/digital_ocean 192.168.1.100"
    exit 1
}

# Process command line arguments
EXCLUDE_OPTS=""
DRY_RUN=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--source)
            SOURCE_DIR="$2"
            shift 2
            ;;
        -d|--dest)
            TARGET_DIR="$2"
            shift 2
            ;;
        -k|--key)
            SSH_KEY="$2"
            shift 2
            ;;
        -e|--exclude)
            EXCLUDE_OPTS="$EXCLUDE_OPTS --exclude=$2"
            shift 2
            ;;
        -n|--dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            if [[ $# -eq 1 && ! "$1" =~ ^- ]]; then
                TARGET_IP="$1"
                shift
            else
                echo "Unknown option: $1"
                show_usage
            fi
            ;;
    esac
done

# Check if TARGET_IP is provided
if [ -z "$TARGET_IP" ]; then
    echo "Error: Target IP address is required"
    show_usage
fi

# Add common excludes
EXCLUDE_OPTS="$EXCLUDE_OPTS --exclude=.git --exclude=node_modules --exclude=.env --exclude=.DS_Store --exclude=__pycache__ --exclude=*.pyc --exclude=.next"

# Make sure source directory ends with /
if [[ ! "$SOURCE_DIR" =~ /$ ]]; then
    SOURCE_DIR="$SOURCE_DIR/"
fi

# Run rsync
echo "Syncing $SOURCE_DIR to root@$TARGET_IP:$TARGET_DIR"
rsync -avz --delete $DRY_RUN $EXCLUDE_OPTS \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
    "$SOURCE_DIR" "root@$TARGET_IP:$TARGET_DIR"

# Check if rsync was successful
if [ $? -eq 0 ]; then
    echo "Deployment completed successfully"
    exit 0
else
    echo "Deployment failed"
    exit 1
fi