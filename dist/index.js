"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configValidator_1 = require("./configValidator");
const fs = require("fs");
const fsp = fs.promises;
const got = require("got");
const moment = require("moment");
const path = require("path");
const Printer = require("thermalprinter");
const RssParser = require("rss-parser");
const SerialPort = require("serialport");
const SimulatedPrinter = require("./simulatedPrinter");
const util = require("util");
const yaml = require("js-yaml");
const config = {
    serial: {
        port: "/dev/ttyAMA0",
        bauds: 9600,
    },
    printer: {
        heatingTime: 120,
        heatingInterval: 2,
        chineseFirmware: true,
        charset: 1,
    },
    filters: {
        maxRows: {
            ["title" /* TITLE */]: 4,
            ["description" /* DESCRIPTION */]: 8,
        },
        replacements: [
            ["–", "-"],
            ["‘", "'"],
            ["’", "'"],
            ["«", "\""],
            ["»", "\""],
            ["“", "\""],
            ["”", "\""],
            ["  ", " "],
        ],
    },
    localization: {
        moment: "en-gb",
    },
};
const feeds = [];
async function printFeeds(printableFeeds, printer) {
    console.log("Enqueuing printer commands...");
    if (isSimulationActive() || printer === undefined) {
        printer = new SimulatedPrinter.Printer();
    }
    const p = printer
        .center().big(true).printLine("Morning News").big(false).left()
        .center().printLine(moment().format("llll")).left()
        .lineFeed()
        .horizontalLine(32);
    for (const feed of printableFeeds) {
        p.lineFeed()
            .underline(1)
            .printLine(feed.title)
            .underline(0);
        for (const entry of feed.entries) {
            p.lineFeed();
            if (entry.title && entry.description) {
                p.underline(1).printText("TITLE:").underline(0)
                    .printLine(" " + entry.title)
                    .underline(1).printText("DESCR:").underline(0)
                    .printLine(" " + entry.description);
            }
            else if (entry.title) {
                p.printLine(entry.title);
            }
            else if (entry.description) {
                p.printLine(entry.description);
            }
            p.lineFeed()
                .center().printLine("------").left();
        }
        p.lineFeed()
            .horizontalLine(32);
    }
    p.lineFeed(2);
    console.log("Sending commands to printer...");
    p.print(() => {
        console.log("Print done");
        printer.hasPaper((hasPaper) => {
            if (hasPaper) {
                process.exit(0);
            }
            else {
                console.error("Printer ran out of paper!");
                process.exit(2);
            }
        });
    });
}
function orderFeeds(printableFeeds) {
    return printableFeeds.sort((a, b) => {
        if (a.title < b.title) {
            return -1;
        }
        if (a.title > b.title) {
            return 1;
        }
        return 0;
    });
}
function replaceFilteredChars(input) {
    for (const replaceChar of config.filters.replacements) {
        if (input.includes(replaceChar[0])) {
            input = input.replace(new RegExp(replaceChar[0], "g"), replaceChar[1]);
        }
    }
    return input;
}
async function prepareFeedForPrinting(parsedFeed) {
    const printableFeed = {
        title: parsedFeed.feed.title.length > 32 ? `${parsedFeed.feed.title.substring(0, 29)}...` : parsedFeed.feed.title,
        entries: [],
    };
    const countedEntries = parsedFeed.feed.items.slice(0, parsedFeed.config.count);
    await Promise.all(countedEntries.map(async (feedEntry) => {
        let title = parsedFeed.config.schema.includes("title" /* TITLE */) ? replaceFilteredChars(feedEntry.title) : undefined;
        const maxTitleLength = (32 * config.filters.maxRows["title" /* TITLE */]) - 7;
        if (title && title.length > maxTitleLength) {
            title = `${title.substring(0, maxTitleLength - 4)}[..]`;
        }
        let description = parsedFeed.config.schema.includes("description" /* DESCRIPTION */) ? feedEntry.contentSnippet || feedEntry.content : undefined;
        const maxDescriptionLength = (32 * config.filters.maxRows["description" /* DESCRIPTION */]) - 7;
        if (description) {
            description = replaceFilteredChars(description);
            if (description.length > maxDescriptionLength) {
                description = `${description.substring(0, maxDescriptionLength - 4)}[..]`;
            }
        }
        printableFeed.entries.push({ title, description });
    }));
    return printableFeed;
}
async function prepareFeedsForPrinting(parsedFeeds) {
    const preparedFeeds = [];
    let counter = 0;
    console.log(`${counter}/${feeds.length} feeds prepared for printing`);
    await Promise.all(parsedFeeds.map(async (parsedFeed) => {
        preparedFeeds.push(await prepareFeedForPrinting(parsedFeed));
        console.log(`${++counter}/${feeds.length} feeds prepared for printing`);
    }));
    return preparedFeeds;
}
async function parseFeed(fetchedFeed) {
    const rssParser = new RssParser();
    const parsedFeed = await rssParser.parseString(fetchedFeed.body);
    return {
        config: fetchedFeed.config,
        feed: parsedFeed,
    };
}
async function parseFeeds(fetchedFeeds) {
    const parsedFeeds = [];
    let counter = 0;
    console.log(`${counter}/${feeds.length} feeds parsed`);
    await Promise.all(fetchedFeeds.map(async (fetchedFeed) => {
        parsedFeeds.push(await parseFeed(fetchedFeed));
        console.log(`${++counter}/${feeds.length} feeds parsed`);
    }));
    return parsedFeeds;
}
async function fetchFeed(feedUrl) {
    const res = await got(feedUrl, {
        method: "GET",
        headers: {
            "accept": "text/html,application/xhtml+xml",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36",
        },
        responseType: "text",
        encoding: "utf8",
        timeout: 15000,
        retry: 2,
        followRedirect: true,
        decompress: true,
    });
    return res.body;
}
async function fetchFeeds() {
    const feedBodies = [];
    let counter = 0;
    console.log(`${counter}/${feeds.length} feeds fetched`);
    await Promise.all(feeds.map(async (feedConfig) => {
        const feedBody = await fetchFeed(feedConfig.url);
        feedBodies.push({
            config: feedConfig,
            body: feedBody,
        });
        console.log(`${++counter}/${feeds.length} feeds fetched`);
    }));
    return feedBodies;
}
async function fetchAndProcessFeeds() {
    const fetchedFeeds = await fetchFeeds();
    const parsedFeeds = await parseFeeds(fetchedFeeds);
    const printableFeeds = await prepareFeedsForPrinting(parsedFeeds);
    return orderFeeds(printableFeeds);
}
function printerHasPaper(printer) {
    return new Promise((resolve, reject) => {
        printer.hasPaper((hasPaper) => {
            if (hasPaper) {
                resolve();
            }
            else {
                reject(new Error("Printer is out of paper!"));
            }
        });
    });
}
function isSimulationActive() {
    return process.env["SIMULATE_PRINTER"] !== undefined;
}
async function loadConfig() {
    let configPath = path.resolve(__dirname, "..", "config.local.yaml");
    try {
        await fsp.access(configPath, fs.constants.F_OK | fs.constants.R_OK);
    }
    catch (_a) {
        configPath = path.resolve(__dirname, "..", "config.yaml");
    }
    const externalConfig = yaml.safeLoad(fs.readFileSync(configPath, "utf8"));
    const configError = configValidator_1.validateExternalConfig(externalConfig);
    if (configError) {
        throw configError;
    }
    config.serial.port = externalConfig.printer.port;
    config.serial.bauds = externalConfig.printer.bauds;
    config.filters.maxRows = externalConfig.filters.maxRows;
    config.localization.moment = externalConfig.locale;
    for (const feed of externalConfig.feeds) {
        feeds.push(feed);
    }
}
async function init() {
    if (!isSimulationActive()) {
        try {
            await fsp.access(config.serial.port, fs.constants.R_OK | fs.constants.W_OK);
        }
        catch (_a) {
            throw new Error(`Cannot access ${config.serial.port}, check path existence and r/w permissions`);
        }
    }
    moment.locale(config.localization.moment);
}
async function start() {
    if (isSimulationActive()) {
        console.log("Simulation active, skipping serial port and printer handling.");
        const processedFeeds = await fetchAndProcessFeeds();
        console.log(`\n${util.inspect(processedFeeds, false, null, true)}\n`);
        await printFeeds(processedFeeds);
    }
    else {
        const serialport = new SerialPort(config.serial.port, { baudRate: config.serial.bauds });
        serialport.on("open", () => {
            console.log("Serial port opened, waiting for printer...");
            const printer = new Printer(serialport, config.printer);
            printer.on("ready", async () => {
                try {
                    await printerHasPaper(printer);
                }
                catch (e) {
                    console.error(e);
                    process.exit(2);
                }
                console.log("Printer ready, starting to fetch feeds.");
                await printFeeds(await fetchAndProcessFeeds(), printer);
            });
            printer.on("error", (err) => {
                console.error("Failed to initialize printer:", err);
                process.exit(1);
            });
        });
        serialport.on("error", (err) => {
            console.error("Failed to open serial port:", err);
            process.exit(1);
        });
    }
}
(async () => {
    try {
        await loadConfig();
        await init();
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
    await start();
})();
//# sourceMappingURL=index.js.map
