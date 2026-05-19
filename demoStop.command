#!/bin/bash

# ==========================================
# CONFIGURATION - MUST MATCH YOUR LAUNCH SCRIPT
# ==========================================
NODE_PORT="4200"                          # Port your Node app runs on
MODEL_KEY="gemma-4-e2b-it"      # Model to unload
# ==========================================

echo "🛑 Shutting down Demo Environment..."

# 1. UNLOAD THE SPECIFIC MODEL
echo "🧠 Checking if model '$MODEL_KEY' needs unloading..."
if lms ps | grep -q "$MODEL_KEY"; then
    echo "📥 Unloading model '$MODEL_KEY'..."
    lms unload "$MODEL_KEY"
else
    echo "✓ Model '$MODEL_KEY' is not currently loaded."
fi

# 2. STOP THE LM STUDIO SERVER
echo "🤖 Checking LM Studio server status..."
if lms server status >/dev/null 2>&1; then
    echo "🔌 Stopping LM Studio server..."
    lms server stop
else
    echo "✓ LM Studio server is already stopped."
fi

# 3. KILL THE NODE.JS PROCESS BY PORT
echo "🌐 Checking for Node.js server on port $NODE_PORT..."
# Find the Process ID (PID) running on that specific port
NODE_PID=$(lsof -t -i :"$NODE_PORT")

if [ -n "$NODE_PID" ]; then
    echo "💥 Found Node.js process (PID: $NODE_PID) on port $NODE_PORT. Terminating..."
    kill -15 "$NODE_PID"
    
    # Quick verification loop
    sleep 1
    if lsof -i :"$NODE_PORT" >/dev/null 2>&1; then
        echo "⚠️ Process didn't exit cleanly. Forcing shutdown..."
        kill -9 "$NODE_PID"
    fi
    echo "✓ Node.js server stopped."
else
    echo "✓ No process found running on port $NODE_PORT."
fi

echo "🎉 Cleanup complete! Closing window in 3 seconds..."
sleep 3
exit 0
