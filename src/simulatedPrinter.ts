/* eslint-disable @typescript-eslint/ban-ts-ignore */

let buffer = "";

export class Printer {
  hasPaper = function (callback: Function): void {
    callback(true);
  };

  print = function (callback: Function): void {
    console.log(buffer);
    buffer = "";
    callback();
  };

  lineFeed = function (linesToFeed?: number): any {
    buffer += "\n".repeat(linesToFeed ? linesToFeed : 1);
    // @ts-ignore
    return this;
  };

  bold = function (onOff: number): any {
    buffer += onOff ? "<b>" : "</b>";
    // @ts-ignore
    return this;
  };

  big = function (onOff: number): any {
    buffer += onOff ? "<big>" : "</big>";
    // @ts-ignore
    return this;
  };

  underline = function (onOff: number): any {
    buffer += onOff ? "<u>" : "</u>";
    // @ts-ignore
    return this;
  };

  small = function (onOff: number): any {
    buffer += onOff ? "<small>" : "</small>";
    // @ts-ignore
    return this;
  };

  inverse = function (onOff: number): any {
    buffer += onOff ? "<inverse>" : "</inverse>";
    // @ts-ignore
    return this;
  };

  left = function (): any {
    // @ts-ignore
    return this;
  };

  right = function (): any {
    // @ts-ignore
    return this;
  };

  center = function (): any {
    // @ts-ignore
    return this;
  };

  indent = function (): any {
    // @ts-ignore
    return this;
  };

  horizontalLine = function (length: number): any {
    buffer += `${"-".repeat(length > 32 ? 32 : length)}\n`;
    // @ts-ignore
    return this;
  };

  printText = function (text: string): any {
    buffer += text;
    // @ts-ignore
    return this;
  };

  addText = this.printText;

  printLine = function (text: string): any {
    buffer += `${text}\n`;
    // @ts-ignore
    return this;
  };
}
