#!/bin/bash

# Run the core fetching & printing script and duplicate logs in a separate file (will still appear in the caller's output)
/usr/local/bin/node /home/pi/MorningNews/dist/index.js 2>&1 | tee /tmp/MorningNews.log

# Reuse the exit code of the Node script to propagate warnings
exit "${PIPESTATUS[0]}"
