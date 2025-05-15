#!/bin/bash

# vDeploy Development Environment Setup Script
# This script sets up and runs both frontend and backend services for vDeploy

# Define colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== vDeploy Development Environment Setup ===${NC}"

# Store the root directory
ROOT_DIR="$(pwd)"

# Function to handle script termination
cleanup() {
  echo -e "${GREEN}Shutting down services...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

# Set up trap to catch termination signal
trap cleanup SIGINT SIGTERM

# Check if required directories exist
if [ ! -d "$ROOT_DIR/platform/backend" ]; then
  echo -e "${RED}Error: Backend directory not found at $ROOT_DIR/platform/backend${NC}"
  exit 1
fi

if [ ! -d "$ROOT_DIR/vdeploy/console" ]; then
  echo -e "${RED}Error: Frontend directory not found at $ROOT_DIR/vdeploy/console${NC}"
  exit 1
fi

# Check for required tools
echo -e "${BLUE}Checking required tools...${NC}"

# Check for Python
if ! command -v python3 &> /dev/null; then
  echo -e "${RED}Error: Python 3 is not installed. Please install Python 3.8 or higher.${NC}"
  exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_VERSION_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_VERSION_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_VERSION_MAJOR" -lt 3 ] || ([ "$PYTHON_VERSION_MAJOR" -eq 3 ] && [ "$PYTHON_VERSION_MINOR" -lt 8 ]); then
  echo -e "${RED}Error: Python 3.8 or higher is required. Found: $PYTHON_VERSION${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"

# Check for pip
if ! command -v pip3 &> /dev/null; then
  echo -e "${RED}Error: pip3 is not installed. Please install pip for Python 3.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ pip3 found${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is not installed. Please install Node.js 16 or higher.${NC}"
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_VERSION_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$NODE_VERSION_MAJOR" -lt 16 ]; then
  echo -e "${RED}Error: Node.js 16 or higher is required. Found: $NODE_VERSION${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"

# Check for npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed. Please install npm.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ npm found${NC}"

# Check for gcloud
if ! command -v gcloud &> /dev/null; then
  echo -e "${YELLOW}Warning: Google Cloud SDK (gcloud) is not installed.${NC}"
  echo -e "${YELLOW}Some features may not work without gcloud. Install from: https://cloud.google.com/sdk/docs/install${NC}"
else
  echo -e "${GREEN}✓ Google Cloud SDK found${NC}"
  
  # Check if user is logged in to gcloud
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}Warning: Not logged in to Google Cloud. Please run 'gcloud auth login' before using deployment features.${NC}"
  else
    echo -e "${GREEN}✓ Google Cloud authentication active${NC}"
    
    # Check if a project is set
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$CURRENT_PROJECT" ] || [ "$CURRENT_PROJECT" = "(unset)" ]; then
      echo -e "${YELLOW}Warning: No Google Cloud project is set. Please run 'gcloud config set project YOUR_PROJECT_ID' before using deployment features.${NC}"
    else
      echo -e "${GREEN}✓ Google Cloud project set to: $CURRENT_PROJECT${NC}"
    fi
  fi
fi

# Check for kubectl
if ! command -v kubectl &> /dev/null; then
  echo -e "${YELLOW}Warning: kubectl is not installed.${NC}"
  echo -e "${YELLOW}Cluster management features will not work without kubectl. Install from: https://kubernetes.io/docs/tasks/tools/install-kubectl/${NC}"
else
  echo -e "${GREEN}✓ kubectl found${NC}"
fi

# Check for Helm
if ! command -v helm &> /dev/null; then
  echo -e "${YELLOW}Warning: Helm is not installed.${NC}"
  echo -e "${YELLOW}Deployment features will not work without Helm. Install from: https://helm.sh/docs/intro/install/${NC}"
else
  echo -e "${GREEN}✓ Helm found${NC}"
fi

# Install backend dependencies
echo -e "${BLUE}Installing backend dependencies...${NC}"
cd "$ROOT_DIR/platform/backend" || exit 1

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
  echo -e "${YELLOW}Creating Python virtual environment...${NC}"
  python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install backend requirements
if [ -f "requirements.txt" ]; then
  echo -e "${YELLOW}Installing Python dependencies from requirements.txt...${NC}"
  pip install -r requirements.txt
else
  echo -e "${YELLOW}No requirements.txt found. Installing minimal dependencies...${NC}"
  pip install fastapi uvicorn kubernetes google-cloud-monitoring prometheus-client
fi

# Install frontend dependencies
echo -e "${BLUE}Installing frontend dependencies...${NC}"
cd "$ROOT_DIR/vdeploy/console" || exit 1

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing npm dependencies...${NC}"
  npm install
else
  echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
fi

# Return to root directory
cd "$ROOT_DIR" || exit 1

echo -e "${GREEN}Setup complete! Starting services...${NC}"

# Start the backend service
echo -e "${BLUE}Starting backend service...${NC}"
cd "$ROOT_DIR/platform/backend" || exit 1
source venv/bin/activate  # Ensure virtual environment is activated
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start the frontend service
echo -e "${BLUE}Starting frontend service...${NC}"
cd "$ROOT_DIR/vdeploy/console" || exit 1
npm run dev &
FRONTEND_PID=$!

echo -e "${GREEN}Both services are running!${NC}"
echo -e "${BLUE}Backend:${NC} http://localhost:8000"
echo -e "${BLUE}Frontend:${NC} http://localhost:5173"
echo -e "${GREEN}Press Ctrl+C to stop all services${NC}"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
