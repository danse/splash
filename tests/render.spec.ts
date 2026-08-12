import { test, expect, type Locator, type Page } from '@playwright/test'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

async function box(locator: Locator): Promise<Rect> {
  const b = (await locator.boundingBox())!
  return { x: b.x, y: b.y, w: b.width, h: b.height }
}

async function clickPlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Play/ }).click()
  await expect(page.getByText('Pick your brawler')).toBeVisible()
}

async function startBrawl(page: Page, difficulty: 'Easy' | 'Medium' | 'Hard'): Promise<void> {
  await clickPlay(page)
  await page.getByRole('button', { name: difficulty }).click()
  await page.getByRole('button', { name: /Brawl/ }).click()
  await expect(page.locator('#hud')).toBeVisible()
}

test.describe('reference size: 1280x720 landscape (touch)', () => {
  test('device gate boots the game (no desktop overlay)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.device-overlay:not(.hidden)')).toHaveCount(0)
    await expect(page.locator('#game-canvas')).toBeAttached()
    await expect(page.getByRole('heading', { name: 'SPLASH' })).toBeVisible()
  })

  test('menu renders at reference size', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#btn-play')).toBeVisible()
    await expect(page).toHaveScreenshot('menu-1280x720.png', { mask: [page.locator('#app-version')] })
  })

  test('select screen fits without overflow and renders', async ({ page }) => {
    await page.goto('/')
    await clickPlay(page)

    for (const label of ['Easy', 'Medium', 'Hard']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
    await expect(page.locator('.brawler-card')).toHaveCount(3)

    const fit = await page.evaluate(() => {
      const s = document.querySelector('.screen:not(.hidden)') as HTMLElement
      return { scrollW: s.scrollWidth, clientW: s.clientWidth, scrollH: s.scrollHeight, clientH: s.clientHeight }
    })
    expect(fit.scrollW).toBeLessThanOrEqual(fit.clientW)
    expect(fit.scrollH).toBeLessThanOrEqual(fit.clientH)

    await expect(page).toHaveScreenshot('select-1280x720.png')
  })

  test('brawl boots with correct layout and no overlap', async ({ page }) => {
    await page.goto('/')
    await startBrawl(page, 'Easy')

    const canvas = page.locator('#game-canvas')
    const cbox = await box(canvas)
    expect(cbox.w).toBe(1280)
    expect(cbox.h).toBe(720)

    const superBtn = page.locator('.super-btn')
    await expect(superBtn).toBeVisible()
    const sbox = await box(superBtn)
    expect(Math.round(sbox.w)).toBe(56)
    expect(Math.round(sbox.h)).toBe(56)
    expect(sbox.x + sbox.w).toBeLessThanOrEqual(1280)
    expect(sbox.y + sbox.h).toBeLessThanOrEqual(720)

    const bars = await box(page.locator('.bottom-hud'))
    expect(sbox.y + sbox.h).toBeLessThanOrEqual(bars.y)

    const top = [
      page.locator('#hud .kills'),
      page.locator('#hud .bots-left'),
      page.locator('#hud .timer'),
    ]
    const boxes = (await Promise.all(top.map((l) => l.boundingBox())))
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height }))
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].x + boxes[i].w).toBeLessThanOrEqual(1280)
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false)
      }
    }

    await page.mouse.move(1050, 500)
    await page.mouse.down()
    const aim = page.locator('.joy-base.aim')
    await expect(aim).toBeVisible()
    const abox = await box(aim)
    expect(overlaps(abox, sbox)).toBe(false)
    await page.mouse.up()

    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'test-results/match-1280x720.png' })
  })

  test('difficulty selector state persists across navigation', async ({ page }) => {
    await page.goto('/')
    await clickPlay(page)

    const easy = page.getByRole('button', { name: 'Easy' })
    const medium = page.getByRole('button', { name: 'Medium' })
    const hard = page.getByRole('button', { name: 'Hard' })
    await expect(hard).toHaveClass(/selected/)
    await expect(easy).not.toHaveClass(/selected/)

    await easy.click()
    await expect(easy).toHaveClass(/selected/)
    await expect(hard).not.toHaveClass(/selected/)

    await medium.click()
    await expect(medium).toHaveClass(/selected/)
    await expect(easy).not.toHaveClass(/selected/)

    await page.getByRole('button', { name: /Back/ }).click()
    await expect(page.getByRole('heading', { name: 'SPLASH' })).toBeVisible()
    await clickPlay(page)
    await expect(medium).toHaveClass(/selected/)
    await expect(easy).not.toHaveClass(/selected/)
  })
})
