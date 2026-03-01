import type { QuizQuestion } from './linuxLevel1Data'

export const TCPIP_LEVEL2_QUESTIONS: QuizQuestion[] = [
  { id: 't01', prompt: 'TCP/IP の「IP」が主に担当するレイヤーは？', choices: ['アプリケーション層', 'トランスポート層', 'ネットワーク層', 'データリンク層'], correctIndex: 2 },
  { id: 't02', prompt: 'TCP が提供する主な機能は？', choices: ['ルーティング', '信頼性の高い通信（再送・順序保証）', 'アドレス解決', '暗号化'], correctIndex: 1 },
  { id: 't03', prompt: 'IPv4 アドレスのビット長は？', choices: ['32ビット', '64ビット', '128ビット', '256ビット'], correctIndex: 0 },
  { id: 't04', prompt: 'サブネットマスク 255.255.255.0 の CIDR 表記は？', choices: ['/24', '/16', '/8', '/32'], correctIndex: 0 },
  { id: 't05', prompt: 'ループバックアドレス（IPv4）として正しいのは？', choices: ['127.0.0.1', '192.168.0.1', '0.0.0.0', '255.255.255.255'], correctIndex: 0 },
  { id: 't06', prompt: 'ポート番号で HTTP が一般的に使うのは？', choices: ['80', '443', '8080', '21'], correctIndex: 0 },
  { id: 't07', prompt: 'UDP の特徴として正しいのは？', choices: ['コネクション型で信頼性が高い', 'コネクションレスで軽量', '必ず到着順を保証する', '暗号化を標準で行う'], correctIndex: 1 },
  { id: 't08', prompt: 'DNS が主に解決するのは？', choices: ['IPアドレスとMACアドレスの対応', 'ドメイン名とIPアドレスの対応', 'ポート番号とプロトコルの対応', '証明書と秘密鍵の対応'], correctIndex: 1 },
  { id: 't09', prompt: 'デフォルトゲートウェイの役割として適切なのは？', choices: ['同一ネットワーク内の通信のみ', '他ネットワークへの出口（ルーター）', 'DNSの代行', 'ファイアウォールのみ'], correctIndex: 1 },
  { id: 't10', prompt: 'プライベートIPアドレス範囲として正しいのは？', choices: ['8.8.8.0/24', '192.168.1.0/24', '203.0.113.0/24', '0.0.0.0/8'], correctIndex: 1 },
]

export const L2_PROGRESS_KEY = 'kira-training-l2-progress'
export const L2_CLEARED_KEY = 'kira-training-l2-cleared'
