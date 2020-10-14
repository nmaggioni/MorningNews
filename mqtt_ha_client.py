#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MorningNews' MQTT HomeAssistant connector, invokes the bash wrapper of a NodeJS RSS feeds collector and printer.
"""

import json
import os
import paho.mqtt.client as mqtt
import subprocess
from sys import exit
import threading
from time import sleep
import yaml

# Your HomeAssistant MQTT autodiscovery prefix (https://www.home-assistant.io/docs/mqtt/discovery/#discovery_prefix)
mqtt_ha_prefix = 'homeassistant'
# Device-specific identifier (should be unique for each one, change it if you want to run multiple MorningNews printers)
mqtt_node_id = 'morning_news_printer'

mqtt_printer_object_id, mqtt_paper_object_id, mqtt_error_object_id = 'printer', 'paper', 'error'
mqtt_printer_topic_config = '{}/switch/{}/{}/config'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_printer_object_id)
mqtt_printer_topic_state = '{}/switch/{}/{}/state'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_printer_object_id)
mqtt_printer_topic_availability = '{}/switch/{}/{}/availability'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_printer_object_id)
mqtt_printer_topic_command = '{}/switch/{}/{}/set'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_printer_object_id)
mqtt_paper_topic_config = '{}/binary_sensor/{}/{}/config'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_paper_object_id)
mqtt_paper_topic_state = '{}/binary_sensor/{}/{}/state'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_paper_object_id)
mqtt_error_topic_config = '{}/binary_sensor/{}/{}/config'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_error_object_id)
mqtt_error_topic_state = '{}/binary_sensor/{}/{}/state'.format(mqtt_ha_prefix, mqtt_node_id, mqtt_error_object_id)
config, script_dir = {}, ""


def publish_ha_autodiscovery(client):
    """ 
    Lets HomeAssistant know about this device's properties.
  
    Publishes the latest configuration data via MQTT, replacing existing messages and retaining this one instead.
    Refer to the official docs for the format and allowed keys: https://www.home-assistant.io/docs/mqtt/discovery/#examples
  
    Parameters: 
    client (mqtt.Client): An active and connected MQTT client.
    """

    printer_config = {
        "name": "Morning News",
        "unique_id": "{}_{}".format(mqtt_node_id, mqtt_printer_object_id),
        "icon": "mdi:printer",
        "state_topic": mqtt_printer_topic_state,
        "command_topic": mqtt_printer_topic_command,
        "payload_on": "on",
        "payload_off": "off",
        "availability_topic": mqtt_printer_topic_availability,
        "payload_available": "online",
        "payload_not_available": "offline",
    }
    paper_config = {
        "name": "Morning News (out of paper)",
        "unique_id": "{}_{}".format(mqtt_node_id, mqtt_paper_object_id),
        "device_class": "problem",
        "expire_after": 86400,
        "state_topic": mqtt_paper_topic_state,
        "payload_on": "on",
        "payload_off": "off",
        "availability_topic": mqtt_printer_topic_availability,
        "payload_available": "online",
        "payload_not_available": "offline"
    }
    error_config = {
        "name": "Morning News (error)",
        "unique_id": "{}_{}".format(mqtt_node_id, mqtt_error_object_id),
        "device_class": "problem",
        "expire_after": 86400,
        "force_update": True,
        "state_topic": mqtt_error_topic_state,
        "payload_on": "on",
        "payload_off": "off",
        "availability_topic": mqtt_printer_topic_availability,
        "payload_available": "online",
        "payload_not_available": "offline"
    }
    print("Republishing HA autoconfig data")
    client.publish(mqtt_printer_topic_config, payload=json.dumps(printer_config), retain=True)
    client.publish(mqtt_paper_topic_config, payload=json.dumps(paper_config), retain=True)
    client.publish(mqtt_error_topic_config, payload=json.dumps(error_config), retain=True)


def set_lwt(client):
    """ 
    Makes sure the device is marked as unavaliable in HA when it disconnects uncleanly (ex.: power loss, crash).
  
    Parameters: 
    client (mqtt.Client): A **not yet connected** MQTT client.
    """

    print("Presetting LWT as (offline)")
    client.will_set(mqtt_printer_topic_availability, payload="offline", retain=True)
    # Only a single LWT message is allowed by the standard MQTT specs


def send_available(client):
    """ 
    Sets the device as "Available" (user interactions enabled) in HA.
  
    Parameters: 
    client (mqtt.Client): An active and connected MQTT client.
    """

    print("Setting availability to (online)")
    client.publish(mqtt_printer_topic_availability, payload="online", retain=True)


def send_birth(client):
    """ 
    Resets the device's state in HA at (re)connection.

    Sets the printer as inactive and resets all error sensors.
  
    Parameters: 
    client (mqtt.Client): An active and connected MQTT client.
    """
    
    send_available(client)
    print("Resetting initial state to (off)")
    client.publish(mqtt_printer_topic_state, payload="off")
    client.publish(mqtt_paper_topic_state, payload="off")
    client.publish(mqtt_error_topic_state, payload="off")


def on_connect(client, userdata, flags, rc):
    """ 
    Callback invoked after the client has connected to the MQTT server.

    Refer to the module's docs: https://pypi.org/project/paho-mqtt/#callbacks
    """
    
    print("Connected with result code "+str(rc))
    publish_ha_autodiscovery(client)
    send_birth(client)
    client.subscribe(mqtt_printer_topic_command)


def on_disconnect(client, userdata, flags, rc):
    """ 
    Callback invoked after the client has disconnected from the MQTT server.

    Refer to the module's docs: https://pypi.org/project/paho-mqtt/#callbacks
    """
    
    if rc == 0:
        print("Successfully disconnected")
    else:
        print("Unexpected disconnection (code {})".format(rc))


def on_message(client, userdata, msg):
    """ 
    Callback invoked when the client receives a message from the MQTT server.

    Refer to the module's docs: https://pypi.org/project/paho-mqtt/#callbacks
    """
    
    msg.payload = msg.payload.decode('utf-8')
    print(msg.topic+" "+str(msg.payload))
    if msg.topic == mqtt_printer_topic_command:
        if msg.payload == "on":
            threading.Thread(target=print_news).start()
        elif msg.payload == "off":
            # TODO: try to stop an already running print
            client.publish(mqtt_printer_topic_state, payload="off")


def print_news():
    """
    Actual print handler. Runs the feed fetching & printing script and reports the final status of the printer to HA.

    Sets the printer as busy in HA, runs the printing wrapper script and handles exit code values that trigger error sensors.
    """
    
    print("Updating printer state with (on)")
    client.publish(mqtt_printer_topic_state, payload="on")

    print("Printing...")
    exit_code = subprocess.call("bash {}/print_news.sh".format(script_dir), shell=True)
    print("Printing done (exit code {})".format(exit_code))

    print("Updating printer state with (off)")
    client.publish(mqtt_printer_topic_state, payload="off")

    if exit_code == 0:
        print("Updating paper and error state with (off)")
        client.publish(mqtt_paper_topic_state, payload="off")
        client.publish(mqtt_error_topic_state, payload="off")
    elif exit_code == 2:
        print("Updating out of paper state with (on)")
        client.publish(mqtt_paper_topic_state, payload="on")
    else:
        print("Updating error state with (on)")
        client.publish(mqtt_error_topic_state, payload="on")


def validate_config():
    """
    Validates the config loaded from the YAML file.

    Only checks values that are relevant for this script, ignores the rest.
    """

    try:
        if not isinstance(config['mqtt']['host'], str):
            raise TypeError()
        if not isinstance(config['mqtt']['port'], int):
            raise TypeError()
        if not isinstance(config['mqtt']['username'], str):
            raise TypeError()
        if not isinstance(config['mqtt']['password'], str):
            raise TypeError()
    except KeyError as ke:
        print("Missing \"{}\" config key!".format(ke.args[0]))
        exit(1)
    except TypeError as te:
        print("Bad \"{}\" config key type!".format(te.args[0]))
        exit(1)


if __name__ == '__main__':
    # Load the config from disk, preferring `config.local.yaml` over `config.yaml`
    script_dir = os.path.dirname(os.path.realpath(__file__))
    configPath = "{}/config.local.yaml".format(script_dir)
    if not os.path.isfile(configPath):
        configPath = "{}/config.yaml".format(script_dir)
    with open(configPath, 'r') as configFile:
        config = yaml.load(configFile, Loader=yaml.Loader)
    validate_config()

    # Prepare the MQTT client and set the LWT payload
    client = mqtt.Client(mqtt_node_id)
    client.username_pw_set(config['mqtt']['username'], config['mqtt']['password'])
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    set_lwt(client)

    while True:
        try:
            # Actually connect to the MQTT server
            print("Connecting to MQTT broker")
            client.connect(config['mqtt']['host'], config['mqtt']['port'], 60)  # 60s client keep-alive
            client.loop_forever()
        except Exception as e:
            # Log exceptions and try to recover
            print(e)
            sleep(3)
            # TODO: disconnect client to ensure that no double connections are made?
