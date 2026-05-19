#!/bin/bash

# Check if a port number was provided
if [ -z "$1" ]; then
    echo "Usage: $0 <port_number>"
    exit 1
fi

PORT=$1

# Find the Process ID (PID) running on the specified TCP port
PID=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN)

if [ -z "$PID" ]; then
    echo "No process found listening on port $PORT."
    exit 0
fi

# Fetch the name of the process for confirmation
PROCESS_NAME=$(ps -p "$PID" -o comm=)

echo "Found process '$PROCESS_NAME' (PID: $PID) on port $PORT."
echo "Killing process..."

# Kill the process
kill -9 "$PID"

if [ $? -eq 0 ]; then
    echo "Successfully killed process $PID."
else
    echo "Failed to kill process. You might need to run this script with sudo."
fi
