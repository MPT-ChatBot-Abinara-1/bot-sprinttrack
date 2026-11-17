export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface BotCommandContext {
  sender: string;
  command: string;
  args: string[];
  reply: (text: string) => Promise<void>;
}
