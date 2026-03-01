/**
 * パスワード認証が必要な一般受講者や、課題クリア後の限定アクセス先を定義する。
 * j-terada: インフラ基礎課題1クリア後は指定の2リンクのみアクセス可能。
 */

export const J_TERADA_USERNAME = 'j-terada'
export const J_TERADA_PASSWORD = 'JK6SJw6T'

/** j-terada が課題1クリア後にアクセスできるリンク（Windows Server 研修用） */
export const J_TERADA_ALLOWED_LINKS = [
  {
    label: 'Windows Server 研修資料（スライド）',
    url: 'https://docs.google.com/presentation/d/1Xw--LXH056ekfvkneyzl-ZCFPKJon4vd/edit?usp=drivesdk&ouid=100622650885455094391&rtpof=true&sd=true',
  },
  {
    label: '研修WBS（スプレッドシート）',
    url: 'https://docs.google.com/spreadsheets/d/127QyXSU1_nLAeRF5HPfsYcECDWjNZKZW/edit?usp=drivesdk&ouid=100622650885455094391&rtpof=true&sd=true',
  },
] as const

export function isJTerada(username: string): boolean {
  return username.trim().toLowerCase() === J_TERADA_USERNAME.toLowerCase()
}
