import { expect, test } from "@playwright/test";

test("manifest exposes Epta LifeOS install metadata", async ({ request }) => {
  const response = await request.get("/manifest.json");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe("Epta LifeOS");
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual(
    expect.arrayContaining(["/icon-192.png", "/icon-512.png", "/icon.svg"])
  );
});

test("service worker contains push and notification action handlers", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  const source = await response.text();
  expect(source).toContain('self.addEventListener("push"');
  expect(source).toContain("EPTA_NOTIFICATION_ACTION");
  expect(source).toContain("snooze_15");
});

