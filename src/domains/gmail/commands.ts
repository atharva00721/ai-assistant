export function parseGmailConnectCommand(message: string): boolean {
  return message.toLowerCase().trim() === "/gmail_connect" || message.toLowerCase().trim() === "/gmail";
}

export function parseGmailDisconnectCommand(message: string): boolean {
  return message.toLowerCase().trim() === "/gmail_disconnect";
}

export function parseGmailStatusCommand(message: string): boolean {
  return message.toLowerCase().trim() === "/gmail_status";
}

export function parseGmailHelpCommand(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return lower === "/gmail_help";
}

export function buildGmailConnectReply(authUrl: string): string {
  return `🔗 Connect your Gmail account:\n\n[Click here to authorize Gmail access](${authUrl})\n\nThis will allow me to:\n• Read your emails\n• Send emails on your behalf\n• Search and summarize messages\n\nYour data stays secure with Google OAuth 2.0 🔒`;
}

export function buildGmailConnectedReply(email: string): string {
  return `✅ Gmail connected successfully!\n\n📧 Account: ${email}\n\nYou can now:\n• \"Show my recent emails\"\n• \"Search emails about project X\"\n• \"Send email to john@example.com\"\n• \"Summarize emails from last week\"\n• \"What's in my inbox?\"\n\nJust ask naturally! 📨`;
}

export function buildGmailStatusReply(isConnected: boolean, email?: string): string {
  if (isConnected && email) {
    return `✅ Gmail connected\n📧 Account: ${email}\n\nCommands:\n• /gmail_disconnect - Remove access\n• Just ask naturally about emails!`;
  }
  return `❌ Gmail not connected\n\nUse /gmail_connect to get started`;
}

export function buildGmailDisconnectedReply(): string {
  return `✅ Gmail disconnected\n\nYour access has been removed. Use /gmail_connect to reconnect anytime.`;
}

export function buildGmailHelpReply(isConnected: boolean): string {
  const baseHelp = `📧 Gmail Commands:\n\n🔗 /gmail_connect - Connect your Gmail\n📊 /gmail_status - Check connection\n❌ /gmail_disconnect - Remove access`;
  
  if (isConnected) {
    return `${baseHelp}\n\n💬 Natural language examples:\n• \"Show my recent emails\"\n• \"Search emails about [topic]\"\n• \"Send email to [address]\"\n• \"Summarize unread emails\"\n• \"What emails did I get today?\"\n\nJust ask naturally! 🚀`;
  }
  
  return baseHelp;
}