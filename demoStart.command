#!/bin/bash

# ==========================================
# CONFIGURATION - CHANGE THESE TO MATCH YOUR SETUP
# ==========================================
NODE_DIR="$HOME/Code/public-aiventure"  # Path to your Node app
NODE_PORT="4200"                          # Port your Node app runs on
MODEL_KEY="gemma-4-e2b-it"      # Run 'lms ls' in terminal to find yours
# ==========================================

echo "🚀 Starting Demo Environment..."

# 1. ENSURE LM STUDIO DAEMON/SERVER IS RUNNING
echo "🤖 Checking LM Studio server status..."
if lms server status >/dev/null 2>&1; then
    echo "✓ LM Studio server is already running."
else
    echo "⚠️ LM Studio server is stopped. Starting it now..."
    lms server start
    # Give it a couple of seconds to spin up
    sleep 3
fi

# 2. ENSURE THE SPECIFIC MODEL IS LOADED
echo "🧠 Checking if model '$MODEL_KEY' is loaded..."
if lms ps | grep -q "$MODEL_KEY"; then
    echo "✓ Model '$MODEL_KEY' is already loaded and serving."
else
    echo "📥 Loading model '$MODEL_KEY'..."
    lms load "$MODEL_KEY"
fi

# 3. ENSURE NODE.JS SERVER IS RUNNING
echo "🌐 Checking Node.js server on port $NODE_PORT..."
if lsof -i :"$NODE_PORT" >/dev/null 2>&1; then
    echo "✓ Node.js server is already running on port $NODE_PORT."
else
    echo "⚡ Node.js server is not running. Starting it now..."
    cd "$NODE_DIR" || { echo "❌ Error: Could not change to directory $NODE_DIR"; exit 1; }
    
    # Starts Node in the background so the script can keep moving or finish cleanly
    npm run dev & 
    
    echo "✓ Node.js server initiated in background."
fi

echo "🎉 All systems are green! Keeping this window open for logs..."
# Keeps the terminal window open so you can see background logs if needed
wait
