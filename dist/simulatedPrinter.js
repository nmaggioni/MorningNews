"use strict";
/* eslint-disable @typescript-eslint/ban-ts-ignore */
Object.defineProperty(exports, "__esModule", { value: true });
let buffer = "";
class Printer {
    constructor() {
        this.hasPaper = function (callback) {
            callback(true);
        };
        this.print = function (callback) {
            console.log(buffer);
            buffer = "";
            callback();
        };
        this.lineFeed = function (linesToFeed) {
            buffer += "\n".repeat(linesToFeed ? linesToFeed : 1);
            // @ts-ignore
            return this;
        };
        this.bold = function (onOff) {
            buffer += onOff ? "<b>" : "</b>";
            // @ts-ignore
            return this;
        };
        this.big = function (onOff) {
            buffer += onOff ? "<big>" : "</big>";
            // @ts-ignore
            return this;
        };
        this.underline = function (onOff) {
            buffer += onOff ? "<u>" : "</u>";
            // @ts-ignore
            return this;
        };
        this.small = function (onOff) {
            buffer += onOff ? "<small>" : "</small>";
            // @ts-ignore
            return this;
        };
        this.inverse = function (onOff) {
            buffer += onOff ? "<inverse>" : "</inverse>";
            // @ts-ignore
            return this;
        };
        this.left = function () {
            // @ts-ignore
            return this;
        };
        this.right = function () {
            // @ts-ignore
            return this;
        };
        this.center = function () {
            // @ts-ignore
            return this;
        };
        this.indent = function () {
            // @ts-ignore
            return this;
        };
        this.horizontalLine = function (length) {
            buffer += `${"-".repeat(length > 32 ? 32 : length)}\n`;
            // @ts-ignore
            return this;
        };
        this.printText = function (text) {
            buffer += text;
            // @ts-ignore
            return this;
        };
        this.addText = this.printText;
        this.printLine = function (text) {
            buffer += `${text}\n`;
            // @ts-ignore
            return this;
        };
    }
}
exports.Printer = Printer;
//# sourceMappingURL=simulatedPrinter.js.map