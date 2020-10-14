// Single feed config entry
export interface FeedConfig {
  url: string;
  schema: Array<FeedFields>;
  count: number;
}

// Feed fields to include in the output. Values get inlined.
export const enum FeedFields {
  TITLE = "title",
  DESCRIPTION = "description",
}

// Internal config structure.
export interface Config {
  serial: {
    port: string;
    bauds: number;
  };
  printer: {
    heatingTime: number;
    heatingInterval: number;
    chineseFirmware: boolean;
    charset: number;
  };
  filters: {
    maxRows: {
      title: number;
      description: number;
    };
    replacements: string[][];
  };
  localization: {
    moment: string;
  };
}

// Config structure that maps the relevant portion of the external YAML file.
// Fields not used by this script are ignored.
export interface ExternalConfig {
  mqtt?: any;
  printer: {
    port: string;
    bauds: number;
  };
  filters: {
    maxRows: {
      title: number;
      description: number;
    };
  };
  locale: string;
  feeds: FeedConfig[];
}

// Feed representation after having beed fetched.
export interface FetchedFeed {
  config: FeedConfig;
  body: string;
}

// Feed representation after having been parsed.
export interface ParsedFeed {
  config: FeedConfig;
  feed: {
    items: {
      title: string;
      link?: string;
      content?: string;
      contentSnippet?: string;
      isoDate?: string;
      [x: string]: any; // allow extra properties
    }[];
    title: string;
    description?: string;
    link?: string;
    [x: string]: any; // allow extra properties
  };
}

// Single article representation when ready for printing.
export interface PrintableFeedEntry {
  title?: string;
  description?: string;
}

// Entire feed representation when ready for printing.
export interface PrintableFeed {
  title: string;
  entries: PrintableFeedEntry[];
}
