export function parseTodoistTokenCommand(message: string): string | null {
  if (!message.toLowerCase().startsWith("/todoist_token")) return null;
  const tokenMatch = message.match(/\/todoist_token\s+(.+)/);
  if (!tokenMatch || !tokenMatch[1]) return null;
  return tokenMatch[1].trim();
}

export function isTodoistDisconnect(message: string): boolean {
  return message.toLowerCase() === "/todoist_disconnect";
}

export function isTodoistHelp(message: string): boolean {
  const lower = message.toLowerCase();
  return lower === "/todoist_help" || lower === "/todoist";
}

export function buildTodoistTokenPrompt(hasToken: boolean): string {
  if (hasToken) {
    return "Your Todoist is connected! ✅\n\nTo update your token, use:\n/todoist_token YOUR_NEW_TOKEN\n\nTo disconnect, use:\n/todoist_disconnect";
  }
  return "Connect your Todoist account by setting your API token:\n\n/todoist_token YOUR_API_TOKEN\n\nGet your token from:\nhttps://todoist.com/app/settings/integrations/developer";
}

export function buildTodoistConnectedReply(): string {
  return "✅ Todoist connected!\n\nYou can now:\n• \"Add task to buy milk tomorrow\"\n• \"Show my tasks for today\"\n• \"Complete task about groceries\"\n• \"Create project called Work\"\n• \"What are my projects?\"\n• \"Show urgent tasks\"\n\nAnd much more! Just ask naturally.";
}

export function buildTodoistHelpReply(hasToken: boolean): string {
  if (!hasToken) {
    return "❌ Todoist not connected.\n\nConnect with:\n/todoist_token YOUR_API_TOKEN\n\nGet your token from:\nhttps://todoist.com/app/settings/integrations/developer";
  }
  return "🎯 Todoist – ask naturally:\n\n📝 Add tasks:\n• \"Add buy milk, eggs, bread\"\n• \"Add call mom tomorrow\"\n• \"Add task [description]\"\n\n📋 List & search:\n• \"Show my tasks\" / \"Tasks for today\"\n• \"Show urgent tasks\"\n\n✅ Complete:\n• \"Mark [task] as done\"\n• \"Mark all done\" / \"Complete everything\"\n\n🗑️ Delete:\n• \"Delete task [name]\"\n• \"Delete all tasks\" / \"Clear everything\"\n• \"Delete all tasks for today\"\n\n📁 Projects & labels: \"Create project X\", \"Show projects\", etc.\n\n💡 Use normal language – e.g. \"add groceries and workout for tomorrow\"";
}
