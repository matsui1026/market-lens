import { AppError, type AppErrorKind } from './types'

export type ErrorCopy = {
  title: string
  body: string
  /** Whether retrying the same request may help. */
  retryable: boolean
  /** Whether the setup screen is the way out. */
  needsSetup: boolean
}

const COPY: Record<AppErrorKind, ErrorCopy> = {
  not_configured: {
    title: 'API キーが設定されていません',
    body: 'ターミナルで npm run setup を実行して API キーを保存してください。',
    retryable: false,
    needsSetup: true,
  },
  invalid_key: {
    title: 'API キーが無効です',
    body: 'J-Quants のダッシュボードでキーを確認し、npm run setup で設定し直してください。',
    retryable: false,
    needsSetup: true,
  },
  forbidden: {
    title: 'ご契約のプランでは取得できないデータです',
    body: 'J-Quants のプラン別データ仕様で、取得できる範囲を確認してください。',
    retryable: false,
    needsSetup: false,
  },
  out_of_range: {
    title: 'プランの取得可能期間の外です',
    body: 'ご契約のプランで取得できる期間を確認してください。',
    retryable: false,
    needsSetup: false,
  },
  bad_request: {
    title: 'J-Quants がリクエストを受け付けませんでした',
    body: '銘柄コードを確認して、もう一度お試しください。',
    retryable: false,
    needsSetup: false,
  },
  invalid_code: {
    title: '銘柄コードの形式が正しくありません',
    body: '4 桁の銘柄コード（例: 7203、130A）を入力してください。',
    retryable: false,
    needsSetup: false,
  },
  rate_limited: {
    title: 'J-Quants の回数制限に達しました',
    body: '約 2 分待ってから再試行してください。',
    retryable: true,
    needsSetup: false,
  },
  queue_timeout: {
    title: '取得の順番待ちが長くなっています',
    body: '回数制限（Free プランは 1 分間に 5 回）のため、少し待ってから再試行してください。',
    retryable: true,
    needsSetup: false,
  },
  server: {
    title: 'J-Quants でエラーが発生しました',
    body: '時間をおいて再試行してください。',
    retryable: true,
    needsSetup: false,
  },
  network: {
    title: 'J-Quants に接続できません',
    body: 'インターネット接続を確認して、再試行してください。',
    retryable: true,
    needsSetup: false,
  },
  timeout: {
    title: 'J-Quants からの応答がありません',
    body: '時間をおいて再試行してください。',
    retryable: true,
    needsSetup: false,
  },
  bad_response: {
    title: '想定外の応答を受け取りました',
    body: '再試行しても直らない場合は、npm run check:api で API の状態を確認してください。',
    retryable: true,
    needsSetup: false,
  },
  local_server_down: {
    title: 'ローカルサーバーに接続できません',
    body: 'ターミナルで npm start を実行してから、このページを再読み込みしてください。',
    retryable: true,
    needsSetup: false,
  },
  not_found: {
    title: '見つかりませんでした',
    body: 'URL を確認してください。',
    retryable: false,
    needsSetup: false,
  },
  unknown: {
    title: 'エラーが発生しました',
    body: '再試行しても直らない場合は、ターミナルのログを確認してください。',
    retryable: true,
    needsSetup: false,
  },
}

export function toAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('unknown')
}

export function errorCopy(error: unknown): ErrorCopy {
  return COPY[toAppError(error).kind]
}
