import { expect, test } from '@playwright/test';

const process: any = (globalThis as any).process;

test('autentica uma conta real do ambiente E2E e renderiza a Página Inicial', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  test.skip(
    !process.env.E2E_DATABASE_URL?.length || !email || !password,
    'Configure E2E_DATABASE_URL, E2E_USER_EMAIL e E2E_USER_PASSWORD para uma conta real no PostgreSQL isolado.',
  );

  await page.goto('/login');
  await page.getByLabel('Email corporativo').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Acessar' }).click();

  await expect(page).toHaveURL(/\/fornecedor\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Página Inicial' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'O que você precisa fazer agora?' })).toBeVisible();
});
