import { Elysia, t } from "elysia";
import { generateAuthUrl, exchangeCodeForTokens, getUserInfo } from "./oauth.js";
import { findGmailAccount, createGmailAccount, deleteGmailAccount } from "./repo.js";
import {
  parseGmailConnectCommand,
  parseGmailDisconnectCommand,
  parseGmailStatusCommand,
  parseGmailHelpCommand,
  buildGmailConnectReply,
  buildGmailConnectedReply,
  buildGmailStatusReply,
  buildGmailDisconnectedReply,
  buildGmailHelpReply,
} from "./commands.js";

export function registerGmailRoutes(app: Elysia) {
  return app
    .get("/gmail/connect", async ({ query, set }) => {
      const { userId } = query;
      
      if (!userId) {
        set.status = 400;
        return { error: "userId is required" };
      }

      try {
        const authUrl = generateAuthUrl(userId);
        
        // Return HTML page with redirect for web browsers
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Redirecting to Google...</title>
            <meta http-equiv="refresh" content="0;url=${authUrl}">
          </head>
          <body>
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
              <h2>Redirecting to Google OAuth...</h2>
              <p>If you're not redirected automatically, <a href="${authUrl}">click here</a></p>
            </div>
            <script>
              window.location.href = "${authUrl}";
            </script>
          </body>
          </html>
        `, {
          headers: {
            'Content-Type': 'text/html',
          }
        });
      } catch (error) {
        console.error("Gmail connect error:", error);
        set.status = 500;
        return { error: "Failed to generate auth URL" };
      }
    }, {
      query: t.Object({
        userId: t.String(),
      }),
    })

    .get("/gmail/callback", async ({ query, set }) => {
      const { code, state: userId, error } = query;

      if (error) {
        set.status = 400;
        return { error: `OAuth error: ${error}` };
      }

      if (!code || !userId) {
        set.status = 400;
        return { error: "Missing code or state parameter" };
      }

      try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);
        
        // Get user info
        const userInfo = await getUserInfo(tokens.access_token);
        
        // Calculate expiry time
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        // Store or update Gmail account
        const existingAccount = await findGmailAccount(userId);
        
        if (existingAccount) {
          await deleteGmailAccount(userId);
        }

        await createGmailAccount({
          userId,
          email: userInfo.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existingAccount?.refreshToken || "",
          expiresAt,
          scope: tokens.scope,
        });

        // Return success page
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Gmail Connected - AI Assistant</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center; 
                padding: 30px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container { 
                max-width: 500px; 
                margin: 0 auto;
                background: white;
                padding: 40px 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              }
              .success { color: #28a745; font-size: 2em; margin-bottom: 20px; }
              .email { color: #495057; font-weight: 600; }
              .instructions {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #007bff;
              }
              .examples {
                text-align: left;
                font-size: 14px;
                color: #6c757d;
                margin-top: 15px;
              }
              .close-btn {
                background: #dc3545;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                margin-top: 20px;
              }
              .close-btn:hover { background: #c82333; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="success">✅ Gmail Connected!</h1>
              <p>Your Gmail account <span class="email">${userInfo.email}</span> has been successfully connected to AI Assistant.</p>
              
              <div class="instructions">
                <h3>🎉 You're all set! Try asking me:</h3>
                <div class="examples">
                  • "Show my recent emails"<br>
                  • "What's the last email I received?"<br>
                  • "Search emails about work"<br>
                  • "Summarize my unread emails"<br>
                  • "Send email to someone@example.com"
                </div>
              </div>
              
              <button class="close-btn" onclick="window.close()">Close Window</button>
              <p style="margin-top: 15px; font-size: 13px; color: #6c757d;">
                <em>Return to your chat and start managing your emails!</em>
              </p>
            </div>
          </body>
          </html>
        `, {
          headers: {
            'Content-Type': 'text/html',
          }
        });
      } catch (error) {
        console.error("Gmail callback error:", error);
        return `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Connection Failed</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #dc3545; }
              .container { max-width: 600px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">❌ Connection Failed</h1>
              <p>Sorry, we couldn't connect your Gmail account.</p>
              <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
              <p>Please try again or contact support.</p>
            </div>
          </body>
          </html>
        `;
      }
    }, {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
    })

    .get("/gmail/status", async ({ query, set }) => {
      const { userId } = query;

      if (!userId) {
        set.status = 400;
        return { error: "userId is required" };
      }

      try {
        const account = await findGmailAccount(userId);
        
        return {
          connected: !!account,
          email: account?.email || null,
          expiresAt: account?.expiresAt || null,
        };
      } catch (error) {
        console.error("Gmail status error:", error);
        set.status = 500;
        return { error: "Failed to get Gmail status" };
      }
    }, {
      query: t.Object({
        userId: t.String(),
      }),
    })

    .delete("/gmail/disconnect", async ({ body, set }) => {
      const { userId } = body;

      if (!userId) {
        set.status = 400;
        return { error: "userId is required" };
      }

      try {
        await deleteGmailAccount(userId);
        
        return { success: true, message: "Gmail disconnected successfully" };
      } catch (error) {
        console.error("Gmail disconnect error:", error);
        set.status = 500;
        return { error: "Failed to disconnect Gmail" };
      }
    }, {
      body: t.Object({
        userId: t.String(),
      }),
    });
}

// Helper function to handle Gmail commands in chat
export async function handleGmailCommand(message: string, userId: string): Promise<string | null> {
  if (parseGmailConnectCommand(message) || parseGmailHelpCommand(message)) {
    const account = await findGmailAccount(userId);
    
    if (account) {
      return buildGmailHelpReply(true);
    }
    
    const authUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/gmail/connect?userId=${userId}`;
    return buildGmailConnectReply(authUrl);
  }

  if (parseGmailStatusCommand(message)) {
    const account = await findGmailAccount(userId);
    return buildGmailStatusReply(!!account, account?.email);
  }

  if (parseGmailDisconnectCommand(message)) {
    const account = await findGmailAccount(userId);
    
    if (!account) {
      return "❌ No Gmail account connected.";
    }
    
    await deleteGmailAccount(userId);
    return buildGmailDisconnectedReply();
  }

  return null;
}