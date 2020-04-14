import { Config, ExternalConfig, FeedConfig, FeedFields, FetchedFeed, ParsedFeed, PrintableFeed } from "./types";
import { validateExternalConfig } from "./configValidator";

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


const config: Config = {
  serial: {
    port: "/dev/ttyAMA0",
    bauds: 9600,
  },
  printer: {  // https://github.com/xseignard/thermalPrinter/blob/master/src/printer.js#L12
    heatingTime: 120,
    heatingInterval: 2,
    chineseFirmware: true,
    charset: 1,
  },
  filters: {
    maxRows: {
      [FeedFields.TITLE]: 4,
      [FeedFields.DESCRIPTION]: 8,
    },
    replacements: [
      ["’", "'"],
      ["«", "\""],
      ["»", "\""],
      ["“", "\""],
      ["”", "\""],
      ["  ", " "],
    ],
  },
  localization: {
    moment: "en-gb", // https://github.com/moment/moment/tree/master/locale
  },
};

const feeds: FeedConfig[] = [];

async function printFeeds(printableFeeds: PrintableFeed[], printer?: any): Promise<void> {
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
      } else if (entry.title) {
        p.printLine(entry.title);
      } else if (entry.description) {
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
      } else {
        console.error("Printer ran out of paper!");
        process.exit(2);
      }
    });
  });
}

function orderFeeds(printableFeeds: PrintableFeed[]): PrintableFeed[] {
  return printableFeeds.sort((a: PrintableFeed, b: PrintableFeed): number => {
    if (a.title < b.title) {
      return -1;
    }
    if (a.title > b.title) {
      return 1;
    }
    return 0;
  });
}

function replaceFilteredChars(input: string): string {
  for (const replaceChar of config.filters.replacements) {
    if (input.includes(replaceChar[0])) {
      input = input.replace(new RegExp(replaceChar[0], "g"), replaceChar[1]);
    }
  }
  return input;
}

async function prepareFeedForPrinting(parsedFeed: ParsedFeed): Promise<PrintableFeed> {
  const printableFeed: PrintableFeed = {
    title: parsedFeed.feed.title.length > 32 ? `${parsedFeed.feed.title.substring(0, 29)}...` : parsedFeed.feed.title,
    entries: [],
  };
  const countedEntries = parsedFeed.feed.items.slice(0, parsedFeed.config.count);
  await Promise.all(
    countedEntries.map(async (feedEntry): Promise<void> => {
      let title = parsedFeed.config.schema.includes(FeedFields.TITLE) ? replaceFilteredChars(feedEntry.title) : undefined;
      const maxTitleLength = (32 * config.filters.maxRows[FeedFields.TITLE]) - 7;
      if (title && title.length > maxTitleLength) {
        title = `${title.substring(0, maxTitleLength - 4)}[..]`;
      }
      let description = parsedFeed.config.schema.includes(FeedFields.DESCRIPTION) ? feedEntry.contentSnippet || feedEntry.content : undefined;
      const maxDescriptionLength = (32 * config.filters.maxRows[FeedFields.DESCRIPTION]) - 7;
      if (description) {
        description = replaceFilteredChars(description);
        if (description.length > maxDescriptionLength) {
          description = `${description.substring(0, maxDescriptionLength - 4)}[..]`;
        }
      }
      printableFeed.entries.push({ title, description });
    }),
  );
  return printableFeed;
}

async function prepareFeedsForPrinting(parsedFeeds: ParsedFeed[]): Promise<PrintableFeed[]> {
  const preparedFeeds: PrintableFeed[] = [];
  let counter = 0;
  console.log(`${counter}/${feeds.length} feeds prepared for printing`);
  await Promise.all(
    parsedFeeds.map(async (parsedFeed): Promise<void> => {
      preparedFeeds.push(await prepareFeedForPrinting(parsedFeed));
      console.log(`${++counter}/${feeds.length} feeds prepared for printing`);
    }),
  );
  return preparedFeeds;
}

async function parseFeed(fetchedFeed: FetchedFeed): Promise<ParsedFeed> {
  const rssParser = new RssParser();
  const parsedFeed = await rssParser.parseString(fetchedFeed.body);
  return {
    config: fetchedFeed.config,
    feed: parsedFeed,
  };
}

async function parseFeeds(fetchedFeeds: FetchedFeed[]): Promise<ParsedFeed[]> {
  const parsedFeeds: ParsedFeed[] = [];
  let counter = 0;
  console.log(`${counter}/${feeds.length} feeds parsed`);
  await Promise.all(
    fetchedFeeds.map(async (fetchedFeed): Promise<void> => {
      parsedFeeds.push(await parseFeed(fetchedFeed));
      console.log(`${++counter}/${feeds.length} feeds parsed`);
    }),
  );
  return parsedFeeds;
}

async function fetchFeed(feedUrl: string): Promise<string> {
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

async function fetchFeeds(): Promise<FetchedFeed[]> {
  const feedBodies: FetchedFeed[] = [];
  let counter = 0;
  console.log(`${counter}/${feeds.length} feeds fetched`);
  await Promise.all(
    feeds.map(async (feedConfig): Promise<void> => {
      const feedBody = await fetchFeed(feedConfig.url);
      feedBodies.push({
        config: feedConfig,
        body: feedBody,
      });
      console.log(`${++counter}/${feeds.length} feeds fetched`);
    }),
  );
  return feedBodies;
}

async function fetchAndProcessFeeds(): Promise<PrintableFeed[]> {
  const fetchedFeeds = await fetchFeeds();
  const parsedFeeds = await parseFeeds(fetchedFeeds);
  const printableFeeds = await prepareFeedsForPrinting(parsedFeeds);
  return orderFeeds(printableFeeds);
}

function printerHasPaper(printer): Promise<void> {
  return new Promise((resolve, reject) => {
    printer.hasPaper((hasPaper) => {
      if (hasPaper) {
        resolve();
      } else {
        reject(new Error("Printer is out of paper!"));
      }
    });
  });
}

function isSimulationActive(): boolean {
  return process.env["SIMULATE_PRINTER"] !== undefined;
}

async function loadConfig(): Promise<void> {
  let configPath = path.resolve(__dirname, "..", "config.local.yaml");
  try {
    await fsp.access(configPath, fs.constants.F_OK | fs.constants.R_OK);
  } catch {
    configPath = path.resolve(__dirname, "..", "config.yaml");
  }
  const externalConfig = yaml.safeLoad(fs.readFileSync(configPath, "utf8")) as ExternalConfig;
  const configError = validateExternalConfig(externalConfig);
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

async function init(): Promise<void> {
  if (!isSimulationActive()) {
    try {
      await fsp.access(config.serial.port, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      throw new Error(`Cannot access ${config.serial.port}, check path existence and r/w permissions`);
    }
  }
  moment.locale(config.localization.moment);
}

async function start(): Promise<void> {
  if (isSimulationActive()) {
    console.log("Simulation active, skipping serial port and printer handling.");
    const processedFeeds = await fetchAndProcessFeeds();
    console.log(`\n${util.inspect(processedFeeds, false, null, true)}\n`);
    await printFeeds(processedFeeds);
  } else {
    const serialport = new SerialPort(config.serial.port, { baudRate: config.serial.bauds });

    serialport.on("open", () => {
      console.log("Serial port opened, waiting for printer...");
      const printer = new Printer(serialport, config.printer);
      printer.on("ready", async () => {
        try {
          await printerHasPaper(printer);
        } catch (e) {
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

(async (): Promise<void> => {
  try {
    await loadConfig();
    await init();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  await start();
})();
