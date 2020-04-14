# MorningNews

> An MQTT and HomeAssistant driven automatic news printer

![Demo](/docs/images/demo.webp) <img src="https://raw.githubusercontent.com/nmaggioni/MorningNews/master/docs/images/demo_print.jpg" height="240" title="Demo print"> 

## Requirements

+ [ ] A [Raspberry Pi Zero W][pi-zero-w].
    + Or a standard [Pi Zero][pi-zero] with a small USB-OTG dongle [[1][micro-usb-otg-thepihut], [2][micro-usb-otg-aliexpress]] and a supported USB WiFi adapter.
+ [ ] A TTL-capable thermal printer ([Adafruit][thermal-printer-adafruit], [AliExpress][thermal-printer-goojprt]).
+ [ ] **(Optional)** A [HomeAssistant][home-assistant] server with an embedded or external MQTT server.

## Wiring

| Raspberry | Printer | Power Supply |
| --------- | ------- | ------------ |
| Pin 4 (5V) | VCC | 5V |
| Pin 6 (GND) | GND | GND |
| Pin 8 (TX) | RX | |
| Pin 10 (RX) | TX | |

<img src="https://raw.githubusercontent.com/nmaggioni/MorningNews/master/docs/images/wiring.png" width="50%" title="Wiring">

As usual with Pis, a power supply of at least 2A is recommended.

## Configuration

You can either edit the main `config.yaml` file or create a `config.local.yaml` copy of it that, if present, will be read instead.

1. Fill the `mqtt` section with your MQTT server's details.
2. The `printer` section preconfigured for Raspbian; if you chose to use another distro, these values may need to be tweaked.
3. The `maxRows` key in the `filter` section defines the maximum number of rows that an article's fields are allowed to occupy when being printed. 
4. Change your desired locale for date formatting in the `locale` section.
5. Add RSS feeds' URLs in the `feeds` section.
    + `url` is the direct URL to the XML feed. _Some feeds may show a rich interface when viewed from a browser even if the URL is correct._
    + `schema` is a list that specifies which sections of the feed's articles you want to print out.
        + Possible values are `title` and `description`, respectively for the title and summary/content of the article.
    + `count` specifies how many of the latest articles you want to fetch from this feed.

## Installation

1. Prepare your RPi Zero [as usual][sparkfun-rpi-zero-guide]. Using [Raspbian Lite][raspbian-downloads] is recommended.
2. Run `sudo raspi-config` on it:
    1. **Interfacing options** > **Serial** > **No** (disable the login shell) > **Yes** (enable the serial port hardware).
    2. _**Note:** reboot at least once before connecting the printer, if possible. System logs could get printed out while shutting down otherwise._
3. Install NodeJS [manually][nodejs-manual-installation].
    + The most recent `armv6l` prebuilt archive still available seems to be [v11.15.0][node-11-armv6l].
    + For enhanced ease of use, just download the tarball and extract in the root of your filesystem. **This would be bad practice in standard systems.**
4. Clone this repo in your user's home.
    + `git clone https://github.com/nmaggioni/MorningNews.git /home/pi/MorningNews`
5. Run the install script: `./install.sh` . The script will automatically take the following actions:
    1. Install the needed tools and dependencies from Raspbian's repos.
    2. Download and build the needed NodeJS dependencies.
    3. Create en entry in your crontab that will start the MQTT/HomeAssistant script at boot.
    4. Create a logrotate entry to ensure that logs don't grow too large.
6. Reboot.

## Usage with HomeAssistant

Make sure that your HA instance has [MQTT discovery][home-assistant-mqtt-discovery] enabled.

Upon boot, the MorningNews MQTT script will make new entities available in HA:

![HA entities](/docs/images/ha_entities.png)

You can then customize them to your liking with the usual methods.

### Running without HomeAssistant

The core NodeJS project can easily be ran standalone: just run `./print_news.sh` or `npm start` whenever you want to print some news.

## 3D-Printable case

The [`/docs/printable_box`](/docs/printable_box) folder contains a simple case for mounting the printer with the included hardware and sliding a Pi Zero underneath it. The back cover has holes for routing both a Micro USB cable for powering the Pi and a 2-pin JST-PH connector for powering the printer, in case you want to power them from different sources.

The fit of the back cover may require tweaking depending on your printer's characteristics.

## Troubleshooting

##### The printer's front LED doesn't blink.

Make sure the printer is correctly powered.

##### The printer doesn't print.

Given that no scripts are logging any error, your printer might be recognized under a different serial port or could be using a different baud rate.

If `/dev/ttyAMA0` is present of your system, try setting the baud rate in the config file to `19200`.

If everything else fails, power on the printer while holding the button on the front: a diagnostics page will be printed and it might contain some clues. 

##### Something is wrong with the contents of the feeds.

Manually execute `SIMULATE_PRINTER=1 npm start` to show debug info and simulate the printer by outputting directly to screen.


[pi-zero-w]: https://www.raspberrypi.org/products/raspberry-pi-zero-w/
[pi-zero]: https://www.raspberrypi.org/products/raspberry-pi-zero/
[micro-usb-otg-thepihut]: https://thepihut.com/products/usb-to-microusb-otg-converter-shim
[micro-usb-otg-aliexpress]: https://www.aliexpress.com/item/32663976512.html
[thermal-printer-adafruit]: https://www.adafruit.com/product/2751
[thermal-printer-goojprt]: https://www.aliexpress.com/item/4000782512644.html
[home-assistant]: https://www.home-assistant.io/
[sparkfun-rpi-zero-guide]: https://learn.sparkfun.com/tutorials/getting-started-with-the-raspberry-pi-zero-wireless/all
[raspbian-downloads]: https://www.raspberrypi.org/downloads/raspbian/
[nodejs-manual-installation]: https://github.com/nodejs/help/wiki/Installation#how-to-install-nodejs-via-binary-archive-on-linux
[node-11-armv6l]: https://nodejs.org/dist/latest-v11.x/node-v11.15.0-linux-armv6l.tar.gz
[home-assistant-mqtt-discovery]: https://www.home-assistant.io/docs/mqtt/discovery/
