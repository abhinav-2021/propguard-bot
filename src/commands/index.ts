import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import { drawdownCommand } from './drawdown';
import { cutoffCommand } from './cutoff';
import { disputeCheckCommand } from './disputeCheck';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  drawdownCommand,
  cutoffCommand,
  disputeCheckCommand,
];

export const commandMap = new Map<string, Command>(
  commands.map((cmd) => [cmd.data.name, cmd])
);

export { drawdownCommand, cutoffCommand, disputeCheckCommand };
