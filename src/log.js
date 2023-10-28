const colors = require("colors");
class Log {
  static infoTitle(message) {
    this.log(message, "bold", "black", "bgCyan", "mx-2", "px-1");
  }
  static successTitle(message) {
    this.log(message, "bold", "black", "bgGreen", "mx-2", "px-1");
  }
  static errorTitle(message) {
    this.log(
      this.prefixWithTime(message),
      "bold",
      "black",
      "bgRed",
      "mx-2",
      "px-1"
    );
  }
  static warningTitle(message) {
    this.log(
      this.prefixWithTime(message),
      "bold",
      "black",
      "bgYellow",
      "mx-2",
      "px-1"
    );
  }
  static clusterTitle(message) {
    this.log(
      this.prefixWithTime(message),
      "bold",
      "yellow",
      "bgMagenta",
      "mx-2",
      "px-1"
    );
  }
  static httpTitle(message) {
    this.infoTitle(this.prefixWithTime(message));
  }
  static discoverTitle(message) {
    this.log(
      this.prefixWithTime(message),
      "bold",
      "gray",
      "bgBrightCyan",
      "mx-2",
      "px-1"
    );
  }
  static websocketTitle(message) {
    this.successTitle(this.prefixWithTime(message));
  }
  static webhookSenderTitle(message) {
    this.log(
      this.prefixWithTime(message),
      "bold",
      "blue",
      "bgWhite",
      "mx-2",
      "px-1"
    );
  }
  static info(message) {
    this.log(message, "cyan", "mx-2");
  }
  static success(message) {
    this.log(message, "green", "mx-2");
  }
  static error(message) {
    this.log(message, "red", "mx-2");
  }
  static warning(message) {
    this.log(message, "yellow", "mx-2");
  }
  static cluster(message) {
    this.log(message, "bold", "magenta", "mx-2");
  }
  static http(message) {
    this.info(message);
  }
  static discover(message) {
    this.log(message, "bold", "brightCyan", "mx-2");
  }
  static websocket(message) {
    this.success(message);
  }
  static webhookSender(message) {
    this.log(message, "bold", "white", "mx-2");
  }
  static br() {
    console.log("");
  }
  static prefixWithTime(message) {
    if (typeof message === "string") {
      return "[" + new Date().toString() + "] " + message;
    }
    return message;
  }
  static log(message, ...styles) {
    let withColor = colors;
    if (typeof message !== "string") {
      return console.log(message);
    }
    styles
      .filter((style) => !/^[m|p]x-/.test(style))
      .forEach((style) => (withColor = withColor[style]));
    const applyMargins = (message) => {
      const spaces = styles
        .filter((style) => /^mx-/.test(style))
        .map((style) => " ".repeat(parseInt(style.substr(3))))
        .join("");
      return spaces + message + spaces;
    };
    const applyPadding = (message) => {
      const spaces = styles
        .filter((style) => /^px-/.test(style))
        .map((style) => " ".repeat(parseInt(style.substr(3))))
        .join("");
      return spaces + message + spaces;
    };
    console.log(applyMargins(withColor(applyPadding(message))));
  }
}

module.exports = { Log };
