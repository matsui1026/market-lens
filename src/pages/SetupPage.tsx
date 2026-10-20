import { Link } from 'react-router'
import { useApp } from '../app/appContext'
import { IS_DEMO_BUILD } from '../app/env'
import { useLocalStatus } from '../app/queries'
import { Notice } from '../components/States'

export function SetupPage() {
  const { sourceKind, setSourceKind } = useApp()
  const status = useLocalStatus()

  return (
    <div className="page stack-lg">
      <h1>J-Quants を使うためのセットアップ</h1>

      {IS_DEMO_BUILD ? (
        <Notice tone="warn">
          この公開版はデモ専用です。J-Quants のデータを見るには、リポジトリを手元に取得して PC
          上で起動してください（README 参照）。
        </Notice>
      ) : (
        sourceKind === 'jquants' &&
        status.data !== undefined && (
          <Notice tone={status.data.apiKeyConfigured ? 'info' : 'warn'}>
            {status.data.apiKeyConfigured
              ? `API キーは設定済みです（レート制限: ${status.data.ratePerMin} 回/分）。`
              : 'API キーはまだ設定されていません。'}
          </Notice>
        )
      )}

      <section className="card prose" aria-labelledby="setup-steps">
        <h2 id="setup-steps">手順</h2>
        <ol>
          <li>
            J-Quants（https://jpx-jquants.com/）でユーザー登録し、プランを選びます。Free
            プランは無料です。
          </li>
          <li>ダッシュボードの「設定 » API キー」で API キーを発行します。</li>
          <li>
            このリポジトリのフォルダでターミナルを開き、次のコマンドを実行して API
            キーを貼り付けます（入力内容は表示されません）。
            <pre>npm run setup</pre>
          </li>
          <li>
            アプリを起動して、ブラウザで <code>http://127.0.0.1:4173</code> を開きます。
            <pre>npm start</pre>
          </li>
        </ol>
        <p className="muted small">
          API キーは <code>.env.local</code> に保存され、Git
          にはコミットされません。ブラウザ側のコードには渡しません。
        </p>
      </section>

      <div className="row">
        {!IS_DEMO_BUILD && (
          <button type="button" className="btn btn--primary" onClick={() => void status.refetch()}>
            設定を再確認
          </button>
        )}
        {!IS_DEMO_BUILD && sourceKind === 'jquants' && (
          <button type="button" className="btn" onClick={() => setSourceKind('demo')}>
            デモデータで試す
          </button>
        )}
        <Link className="btn" to="/">
          ホームへ
        </Link>
      </div>
    </div>
  )
}
