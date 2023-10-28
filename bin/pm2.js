#! /usr/bin/env node

const { Cli } = require("./../src/cli/cli");

process.title = "soketi-server";

Cli.startWithPm2();
