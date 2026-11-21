import { expect, test } from '@playwright/test';

/**
 * 六语界面验收：设置页即时切换、刷新后持久化、html lang 同步，
 * 以及 auto 模式按浏览器首选语言解析。只检查真实 DOM，不依赖截图。
 */

const LOCALES = [
  { value: 'zh-CN', lang: 'zh-Hans', label: '设置' },
  { value: 'en', lang: 'en', label: 'Settings' },
  { value: 'ja', lang: 'ja', label: '設定' },
  { value: 'ru', lang: 'ru', label: 'Настройки' },
  { value: 'es', lang: 'es', label: 'Ajustes' },
  { value: 'pt-BR', lang: 'pt-BR', label: 'Ajustes' },
] as const;

test.describe('六语界面', () => {
  test('E10 六种语言可即时切换，导航/标题/html lang 同步并持久化', async ({ page }) => {
    await page.goto('/#/settings');
    const select = page.getByTestId('locale-select');
    await expect(select).toBeVisible();

    for (const locale of LOCALES) {
      await select.selectOption(locale.value);
      await expect(page.locator('.settings__title')).toHaveText(locale.label);
      await expect(page.locator('.app-nav__link', { hasText: locale.label })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', locale.lang);
      await expect(page).toHaveTitle(`${locale.label} · Twisty Atlas`);
      expect(await page.evaluate(() => localStorage.getItem('twisty-atlas:locale'))).toBe(
        locale.value,
      );
    }

    // 刷新后仍是最后选择的语言（持久化来自 localStorage，而不是内存）
    await page.reload();
    await expect(page.locator('.settings__title')).toHaveText('Ajustes');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });

  test('E10b auto 模式按浏览器首选语言解析', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ja-JP' });
    try {
      const page = await context.newPage();
      await page.goto('/#/settings');
      await expect(page.getByTestId('locale-select')).toHaveValue('auto');
      await expect(page.locator('.settings__title')).toHaveText('設定');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    } finally {
      await context.close();
    }
  });
});
