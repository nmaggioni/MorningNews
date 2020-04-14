#!/bin/bash

/usr/local/bin/node /home/pi/MorningNews/dist/index.js 2>&1 | tee /tmp/MorningNews.log
exit "${PIPESTATUS[0]}"
