#!/bin/bash

# Save shell options to be restored later
previous_state="$(set +o); set -$-"
set -xe

# Install packaged dependencies
sudo apt update
sudo apt install -y build-essential python3-yaml python3-paho-mqtt

# Install NodeJS dependencies
npm ci

# Add crontab entry for MQTT script
CRONTAB_ENTRY='@reboot /bin/sleep 15 && /usr/bin/python3 -u /home/pi/MorningNews/mqtt_ha_client.py >/tmp/MorningNews_MQTT.log 2>&1'
if crontab -l | grep -q "$CRONTAB_ENTRY"; then
  echo "Crontab entry is already in place"
else
  TMPFILE="$(mktemp)"
  crontab -l > "$TMPFILE"
  echo -e "\n$CRONTAB_ENTRY" >> "$TMPFILE"
  crontab "$TMPFILE"
  rm "$TMPFILE"
fi

# Add logrotate entry
cat << EOF | sudo tee /etc/logrotate.d/morning_news >/dev/null
/tmp/MorningNews.log
/tmp/MorningNews_MQTT.log {
  rotate 0
  daily
  missingok
  notifempty
  copytruncate
}
EOF

# Restore previously saved shell options
set +xe
eval "$previous_state"
