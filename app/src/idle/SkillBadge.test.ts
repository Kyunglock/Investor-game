import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SkillBadge } from './SkillBadge'
import { SKILLS, type SkillCode } from './skills'

const html = (props: Parameters<typeof SkillBadge>[0]) =>
  renderToStaticMarkup(createElement(SkillBadge, props))
/** 아래 테두리의 별 수: 별은 꼭짓점이 열 개인 길이다. */
const stars = (markup: string) => markup.match(/<path d="M[^"]*(L[^"]*){9}Z"/g)?.length ?? 0
const ids = (markup: string) => [...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])

describe('스킬 배지 (531번)', () => {
  it('스킬마다 그림이 있고, 레벨만큼 별이 박힌다', () => {
    for (const skill of Object.keys(SKILLS) as SkillCode[]) {
      for (let level = 1; level <= 5; level++) {
        const markup = html({ skill, level, size: 60 })
        expect(markup).toContain(`data-skill="${skill}"`)
        expect(markup).toContain(`data-level="${level}"`)
        expect(stars(markup)).toBe(level)
      }
    }
  })

  it('레벨에 따라 그림이 세 단계로 달라지고, Lv.3부터는 같은 그림이다', () => {
    const glyph = (level: number) =>
      html({ skill: 'water', level, size: 60 }).match(/skill-badge-glyph[^>]*>(.*?)<\/g>/)?.[1]
    expect(new Set([1, 2, 3].map(glyph)).size).toBe(3)
    expect(glyph(4)).toBe(glyph(3))
    expect(glyph(5)).toBe(glyph(3))
  })

  it('Lv.4부터 햇살이 돋는다', () => {
    const rays = (level: number) =>
      html({ skill: 'bolt', level, size: 60 }).match(/rotate\(/g)?.length ?? 0
    // 하이라이트의 rotate 하나는 늘 있다.
    expect(rays(3)).toBe(1)
    expect(rays(4)).toBeGreaterThan(rays(3))
    expect(rays(5)).toBeGreaterThan(rays(4))
  })

  it('못 가진 스킬은 흑백에 자물쇠고 별·반짝임이 없다', () => {
    const markup = html({ skill: 'meteor', level: 5, size: 60, locked: true })
    expect(markup).toContain('is-locked')
    expect(markup).toContain('data-level="0"')
    expect(markup).toContain('<rect')
    expect(stars(markup)).toBe(0)
    expect(markup).not.toContain('skill-badge-glints')
    // 스킬 색이 하나도 없다.
    expect(markup).not.toMatch(/#ff9a3d|#dc3b2a/)
  })

  it('작게 그리면 별·반짝임·햇살을 빼고 그림을 키운다', () => {
    const markup = html({ skill: 'ram', level: 5, size: 20 })
    expect(markup).toContain('viewBox="3 3 42 42"')
    expect(stars(markup)).toBe(0)
    expect(markup).not.toContain('skill-badge-glints')
    expect(html({ skill: 'ram', level: 5, size: 60 })).toContain('viewBox="0 0 48 48"')
  })

  it('한 화면의 배지마다 그라데이션 이름이 다르다', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(SkillBadge, { skill: 'water' }),
        createElement(SkillBadge, { skill: 'water' }),
      ),
    )
    const all = ids(markup)
    expect(all.length).toBe(8)
    expect(new Set(all).size).toBe(8)
    for (const id of all) expect(markup).toContain(`url(#${id})`)
  })

  it('이름을 주면 그림으로 읽히고, 없으면 꾸밈이다', () => {
    expect(html({ skill: 'water', label: '물 스킬 Lv.2' })).toContain(
      'role="img" aria-label="물 스킬 Lv.2"',
    )
    expect(html({ skill: 'water' })).toContain('aria-hidden="true"')
  })
})
