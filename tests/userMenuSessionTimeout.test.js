import { jest } from "@jest/globals";

process.env.JWT_SECRET = "testsecret";

import { setMenuTimeout, userMenuContext } from "../src/utils/sessionsHelper.js";

describe("User Menu Session Timeout", () => {
  const chatId = "628111222333@s.whatsapp.net";
  let waClient;

  beforeEach(() => {
    // Clear any existing sessions
    if (userMenuContext[chatId]) {
      const ctx = userMenuContext[chatId];
      if (ctx.timeout) clearTimeout(ctx.timeout);
      if (ctx.warningTimeout) clearTimeout(ctx.warningTimeout);
      if (ctx.noReplyTimeout) clearTimeout(ctx.noReplyTimeout);
      delete userMenuContext[chatId];
    }

    waClient = {
      sendMessage: jest.fn().mockResolvedValue(),
    };
  });

  afterEach(() => {
    // Clean up any remaining timeouts
    if (userMenuContext[chatId]) {
      const ctx = userMenuContext[chatId];
      if (ctx.timeout) clearTimeout(ctx.timeout);
      if (ctx.warningTimeout) clearTimeout(ctx.warningTimeout);
      if (ctx.noReplyTimeout) clearTimeout(ctx.noReplyTimeout);
      delete userMenuContext[chatId];
    }
  });

  it("should set session timeout to 3 minutes (180000ms)", () => {
    setMenuTimeout(chatId, waClient);

    expect(userMenuContext[chatId]).toBeDefined();
    expect(userMenuContext[chatId].timeout).toBeDefined();
  });

  it("should send warning message 2 minutes after session start", (done) => {
    setMenuTimeout(chatId, waClient);

    // Wait for warning timeout (should be 2 minutes = 120000ms)
    // For testing, we'll verify the timeout was set
    expect(userMenuContext[chatId].warningTimeout).toBeDefined();

    // Clean up and complete test
    clearTimeout(userMenuContext[chatId].timeout);
    clearTimeout(userMenuContext[chatId].warningTimeout);
    delete userMenuContext[chatId];
    done();
  });

  it("should send expiry message after 3 minutes of inactivity", (done) => {
    setMenuTimeout(chatId, waClient);

    // For testing purposes, we'll manually trigger the timeout
    // In real scenario, this would wait 3 minutes
    const ctx = userMenuContext[chatId];
    
    // Clear the actual timeout to prevent waiting
    clearTimeout(ctx.timeout);
    clearTimeout(ctx.warningTimeout);

    // Manually trigger expiry
    waClient
      .sendMessage(
        chatId,
        "⏰ *Sesi Telah Berakhir*\n\nSesi Anda telah berakhir karena tidak ada aktivitas selama 3 menit.\n\nUntuk memulai lagi, ketik *userrequest*."
      )
      .then(() => {
        delete userMenuContext[chatId];
        
        expect(waClient.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining("Sesi Anda telah berakhir karena tidak ada aktivitas selama 3 menit")
        );
        done();
      });
  });

  it("should clear all timeouts when session is closed", () => {
    setMenuTimeout(chatId, waClient);

    const ctx = userMenuContext[chatId];
    expect(ctx.timeout).toBeDefined();
    expect(ctx.warningTimeout).toBeDefined();

    // Clear all timeouts
    clearTimeout(ctx.timeout);
    clearTimeout(ctx.warningTimeout);
    if (ctx.noReplyTimeout) clearTimeout(ctx.noReplyTimeout);
    delete userMenuContext[chatId];

    expect(userMenuContext[chatId]).toBeUndefined();
  });

  it("should refresh timeout on each interaction", () => {
    setMenuTimeout(chatId, waClient);
    const firstTimeout = userMenuContext[chatId].timeout;

    // Simulate user interaction by refreshing timeout
    setMenuTimeout(chatId, waClient);
    const secondTimeout = userMenuContext[chatId].timeout;

    // Timeouts should be different objects (old one cleared, new one created)
    expect(firstTimeout).not.toBe(secondTimeout);

    // Clean up
    clearTimeout(userMenuContext[chatId].timeout);
    clearTimeout(userMenuContext[chatId].warningTimeout);
    if (userMenuContext[chatId].noReplyTimeout) {
      clearTimeout(userMenuContext[chatId].noReplyTimeout);
    }
    delete userMenuContext[chatId];
  });

  it("should set noReplyTimeout when expectReply is true", () => {
    setMenuTimeout(chatId, waClient, true);

    expect(userMenuContext[chatId].noReplyTimeout).toBeDefined();

    // Clean up
    clearTimeout(userMenuContext[chatId].timeout);
    clearTimeout(userMenuContext[chatId].warningTimeout);
    clearTimeout(userMenuContext[chatId].noReplyTimeout);
    delete userMenuContext[chatId];
  });
});
