export interface FeedConfig {
  url: string;
  schema: Array<FeedFields>;
  count: number;
}

export const enum FeedFields {
  TITLE = "title",
  DESCRIPTION = "description",
}

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

export interface ExternalConfig {
  mqtt: any;
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

export interface FetchedFeed {
  config: FeedConfig;
  body: string;
}

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

export interface PrintableFeedEntry {
  title?: string;
  description?: string;
}

export interface PrintableFeed {
  title: string;
  entries: PrintableFeedEntry[];
}
