#!/bin/bash

# Script to run both frontend and backend services simultaneously
# This uses terminal multiplexer to run both services in the same terminal window

# Define colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting development environment...${NC}"

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

# Check if Python and required packages are installed
echo -e "${BLUE}Checking Python dependencies...${NC}"
if ! command -v python3 &> /dev/null; then
  echo -e "${RED}Error: Python 3 is not installed${NC}"
  exit 1
fi

# Check if uvicorn is installed
if ! python3 -c "import uvicorn" &> /dev/null; then
  echo -e "${YELLOW}Warning: uvicorn is not installed. Installing...${NC}"
  pip install uvicorn fastapi
fi

# Start the backend service
echo -e "${BLUE}Starting backend service...${NC}"
cd "$ROOT_DIR/platform/backend" || exit 1
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
