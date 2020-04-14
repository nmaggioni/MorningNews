import { FeedFields } from "./types";

function createMissingKeyError(key: string): Error {
  return new Error(`Missing "${key}" config key`);
}

function createBadKeyTypeError(key: string, expected: string): Error {
  return new Error(`Bad "${key}" config key type, expected ${expected}`);
}

export function validateExternalConfig(externalConfig: any): Error | undefined {
  if (!externalConfig.printer) {
    return createMissingKeyError("printer");
  }
  if (!externalConfig.printer.port) {
    return createMissingKeyError("printer.port");
  }
  if (typeof (externalConfig.printer.port) !== "string") {
    return createBadKeyTypeError("printer.port", "string");
  }
  if (!externalConfig.printer.bauds) {
    return createMissingKeyError("printer.bauds");
  }
  if (typeof (externalConfig.printer.bauds) !== "number") {
    return createBadKeyTypeError("printer.bauds", "number");
  }

  if (!externalConfig.filters) {
    return createMissingKeyError("filters");
  }
  if (!externalConfig.filters.maxRows) {
    return createMissingKeyError("filters.maxRows");
  }
  if (!externalConfig.filters.maxRows.title) {
    return createMissingKeyError("filters.maxRows.title");
  }
  if (typeof (externalConfig.filters.maxRows.title) !== "number") {
    return createBadKeyTypeError("filters.maxRows.title", "number");
  }
  if (!externalConfig.filters.maxRows.description) {
    return createMissingKeyError("filters.maxRows.description");
  }
  if (typeof (externalConfig.filters.maxRows.description) !== "number") {
    return createBadKeyTypeError("filters.maxRows.description", "number");
  }

  if (!externalConfig.locale) {
    return createMissingKeyError("locale");
  }
  if (typeof (externalConfig.locale) !== "string") {
    return createBadKeyTypeError("locale", "string");
  }

  if (!externalConfig.feeds) {
    return createMissingKeyError("feeds");
  }
  if (!Array.isArray(externalConfig.feeds)) {
    return createBadKeyTypeError("feeds", "array");
  }
  if (!externalConfig.feeds.length) {
    return new Error("No feeds defined");
  }
  let feedsCounter = 0;
  for (const feed of externalConfig.feeds) {
    if (!feed.url) {
      return createMissingKeyError(`feeds[${feedsCounter}].url`);
    }
    if (typeof (feed.url) !== "string") {
      return createBadKeyTypeError(`feeds[${feedsCounter}].url`, "string");
    }
    if (!feed.schema) {
      return createMissingKeyError(`feeds[${feedsCounter}].schema`);
    }
    if (!Array.isArray(feed.schema)) {
      return createBadKeyTypeError(`feeds[${feedsCounter}].schema`, "array");
    }
    for (const entry of feed.schema) {
      if (typeof(entry) !== "string" || entry !== FeedFields.TITLE && entry !== FeedFields.DESCRIPTION) {
        return createBadKeyTypeError(`feeds[${feedsCounter}].schema[]`, `${FeedFields.TITLE} or ${FeedFields.DESCRIPTION}`);
      }
    }
    if (!feed.count) {
      return createMissingKeyError(`feeds[${feedsCounter}].count`);
    }
    if (typeof (feed.count) !== "number") {
      return createBadKeyTypeError(`feeds[${feedsCounter}].count`, "number");
    }

    feedsCounter++;
  }

  return;
}
