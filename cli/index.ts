#!/usr/bin/env node
import { Command } from "commander";
import replayCommand from "./commands/replay";
import logsCommand from "./commands/logs";

const program = new Command();

program
  .name("webhook-gateway")
  .description("Devtools for testing webhook workflows")
  .version("0.1.0");

program.addCommand(replayCommand);
program.addCommand(logsCommand);

program.parse(process.argv);
 