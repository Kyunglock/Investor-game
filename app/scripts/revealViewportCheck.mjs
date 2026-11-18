import assert from 'node:assert/strict'

/** 회전하는 빛살의 모든 방향에서도 결과 창이 가로로 넓어지지 않아야 한다. */
export async function checkRevealViewport(page, kind, fixed = false) {
  const dialog = page.getByTestId(`${kind}-reveal`)
  await page.getByTestId(`${kind}-drawn`).waitFor()
  const sizes = await dialog.evaluate((el) => {
    const ray = el.querySelector('.weapon-reveal-rays')
    const animations = ray.getAnimations()
    const result = []
    for (const ratio of [0, 0.125, 0.25, 0.375, 0.5, 0.75]) {
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = Number(animation.effect.getTiming().duration) * ratio
      }
      result.push({
        w: el.clientWidth,
        sw: el.scrollWidth,
        h: el.clientHeight,
        sh: el.scrollHeight,
      })
    }
    for (const animation of animations) animation.play()
    return result
  })
  assert(
    sizes.every((s) => s.sw <= s.w + 1),
    `${kind}: horizontal overflow ${JSON.stringify(sizes)}`,
  )
  if (fixed)
    assert(
      sizes.every((s) => s.sh <= s.h + 1),
      `${kind}: vertical overflow ${JSON.stringify(sizes)}`,
    )
  await page.mouse.move(100, 200)
  await page.mouse.wheel(500, fixed ? 500 : 0)
  const cdp = await page.context().newCDPSession(page)
  for (const [dx, dy] of [
    [-120, 0],
    [0, -120],
  ]) {
    if (dy && !fixed) continue
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 200, y: 220 }],
    })
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 200 + (dx * i) / 5, y: 220 + (dy * i) / 5 }],
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await cdp.detach()
  await page.waitForTimeout(150)
  const scroll = await dialog.evaluate((el) => ({
    x: el.scrollLeft,
    y: el.scrollTop,
    pageX: window.scrollX,
  }))
  assert.equal(scroll.x, 0)
  assert.equal(scroll.pageX, 0)
  if (fixed) assert.equal(scroll.y, 0)
}
