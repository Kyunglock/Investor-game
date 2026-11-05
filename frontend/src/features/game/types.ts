/** 도트 그림이 쓰는 화면 쪽 값. 서버 계약에는 없다. */
export type Sex = 'M' | 'F'

/** 능력치 다섯. 그림의 장식·약점 표시를 고를 때 쓴다. */
export interface Stats {
  insight: number
  patience: number
  courage: number
  conviction: number
  luck: number
}
