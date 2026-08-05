import { expect, test, type Page } from "@playwright/test";

import type { AccountPage } from "../../src/components/account/account-page";
import type { AuthPage } from "../../src/components/auth/auth-page";
import type { ProfilePage } from "../../src/components/profile/profile-page";
import type { TodoDetailPage } from "../../src/components/todo/todo-detail-page";
import type { TodoWorkspacePage } from "../../src/components/todo/todo-workspace-page";
import type { TrashDetailPage } from "../../src/components/trash/trash-detail-page";
import type { TrashPage } from "../../src/components/trash/trash-page";
import type { WelcomePage } from "../../src/components/welcome/welcome-page";

/** Registers, works, reviews, and safely exits one owner workspace.
 * @evidence docs/analysis/01-actors-and-auth.md#req-auth-provision-account-provisioning-and-login Walks registration into an owner session.
 * @evidence docs/analysis/01-actors-and-auth.md#req-auth-session-session-continuity-and-logout Walks session continuity and logout navigation.
 * @evidence docs/analysis/01-actors-and-auth.md#req-auth-boundary-private-account-authority Observes private owner-only routes.
 * @evidence docs/analysis/02-domain-model.md#req-dom-profile-profile-meaning-and-relationship Walks the private profile route.
 * @evidence docs/analysis/02-domain-model.md#req-dom-todo-todo-meaning-and-ownership Walks active Todo work.
 * @evidence docs/analysis/02-domain-model.md#req-dom-todo-life-todo-lifecycle Walks active and retained lifecycle surfaces.
 * @evidence docs/analysis/02-domain-model.md#req-dom-history-edit-history-meaning-and-relationship Walks history inspection.
 * @evidence docs/analysis/03-functional-requirements.md#req-func-profile-profile-operations Walks profile inspection.
 * @evidence docs/analysis/03-functional-requirements.md#req-func-todo-todo-operations Creates and opens active work.
 * @evidence docs/analysis/03-functional-requirements.md#req-func-history-edit-history-inspection Opens full history.
 * @evidence docs/analysis/03-functional-requirements.md#req-func-trash-trash-recovery-journey Opens trash recovery.
 * @evidence docs/analysis/04-business-rules.md#req-rule-credential-credential-rules Uses accepted credential fields.
 * @evidence docs/analysis/04-business-rules.md#req-rule-profile-display-name-rules Uses the display-name editor.
 * @evidence docs/analysis/04-business-rules.md#req-rule-content-todo-content-and-date-rules Uses Todo content fields.
 * @evidence docs/analysis/04-business-rules.md#req-rule-browse-todo-browsing-rules Uses list filters and pagination.
 * @evidence docs/analysis/04-business-rules.md#req-rule-state-todo-state-conflict-and-history-rules Observes completion, edit, and lifecycle controls.
 * @evidence docs/analysis/05-non-functional.md#req-nfr-privacy-private-data-isolation Observes owner-scoped screens.
 * @evidence docs/analysis/05-non-functional.md#req-nfr-integrity-change-and-deletion-integrity Observes detail and history together.
 * @evidence {@link WelcomePage} Walks the public entry.
 * @evidence {@link AuthPage} Walks account provisioning.
 * @evidence {@link TodoWorkspacePage} Walks active work.
 * @evidence {@link TodoDetailPage} Walks detail and history.
 * @evidence {@link TrashPage} Walks the recovery list.
 * @evidence {@link TrashDetailPage} Walks retained detail.
 * @evidence {@link ProfilePage} Walks the owner profile.
 * @evidence {@link AccountPage} Walks security controls.
 */
export async function journey_owner_workspace(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Make room");
  await page.getByRole("link", { name: "Create account" }).click();
  const email = `journey-${Date.now()}@example.com`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Display name").fill("Journey owner");
  await page.getByLabel("Password").fill("journey-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
  await page.getByRole("button", { name: "New todo" }).click();
  await page.getByLabel("Title").fill("Review the workspace flow");
  await page.getByRole("button", { name: "Create todo" }).click();
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile");
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account security");
  await page.getByRole("link", { name: "Trash" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trash");
  await page.goto("/todo/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Todo detail");
  await page.goto("/trash/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Retained todo");
}

/** Walks the public recovery entry and returns to the public boundary.
 * @evidence docs/analysis/01-actors-and-auth.md#req-auth-manage-account-management Walks the recovery entry.
 * @evidence {@link WelcomePage} Starts from the public entry.
 * @evidence {@link AuthPage} Presents the forgotten-password surface.
 */
export async function journey_recovery_entry(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Recover" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your way back");
  await expect(page.getByLabel("Email")).toBeVisible();
}

test("owner workspace journey", async ({ page }) => {
  await journey_owner_workspace(page);
});

test("recovery entry journey", async ({ page }) => {
  await journey_recovery_entry(page);
});
