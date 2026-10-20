import { IS_DEMO_BUILD } from '../app/env'
import { TRADING_DAYS_PER_YEAR, MIN_CORRELATION_DAYS } from '../lib/analytics'

export function AboutPage() {
  return (
    <div className="page stack-lg">
      <h1>このツールについて</h1>

      <section className="card prose" aria-labelledby="about-what">
        <h2 id="about-what">Market Lens とは</h2>
        <p>
          J-Quants API の株価・財務データを、自分の PC
          上で分析・可視化する個人学習用のツールです。日本取引所グループおよび J-Quants
          とは関係のない、非公式のツールです。
        </p>
        <p>
          表示する数値は学習のためのもので、投資助言や売買の推奨ではありません。正確性・完全性は保証しません。
        </p>
      </section>

      <section className="card prose" aria-labelledby="about-data">
        <h2 id="about-data">データの扱い</h2>
        <ul>
          <li>
            J-Quants のデータは、
            <strong>
              利用者それぞれが自分で J-Quants API を契約し、自分の API キーで取得します
            </strong>
            。 このツールの作者がデータを配信・中継することはありません。
          </li>
          <li>
            データの取得は、利用者の PC
            上で動くローカルサーバー（127.0.0.1）が行います。取得したデータは、その PC の{' '}
            <code>.cache/</code> フォルダにだけ保存され、外部に送信されません。
          </li>
          <li>データや分析結果を共有・公開する機能はありません。</li>
          <li>
            ブラウザに保存するのは、ウォッチリストなどの銘柄コードと表示設定だけです。株価・財務データは保存しません。
          </li>
          <li>
            プランの解約やダウングレードの後は、<code>npm run cache:clear</code>{' '}
            で保存済みデータを削除してください（J-Quants の利用条件で求められています）。
          </li>
          {IS_DEMO_BUILD && (
            <li>
              この公開版は、乱数で作った<strong>架空のデモデータ</strong>だけを表示します。J-Quants
              には接続しません。
            </li>
          )}
        </ul>
        <p className="muted small">
          参考: J-Quants API ヘルプ「利用目的・ライセンス」（https://jpx-jquants.com/ja/help/usage）
        </p>
      </section>

      <section className="card prose" aria-labelledby="about-defs">
        <h2 id="about-defs">指標の定義</h2>
        <dl className="defs">
          <dt>株価</dt>
          <dd>株式分割・併合を考慮した調整済み株価（J-Quants の AdjO / AdjH / AdjL / AdjC）。</dd>
          <dt>期間騰落率</dt>
          <dd>期間の最後の終値 ÷ 期間の最初の終値 − 1。</dd>
          <dt>年率ボラティリティ</dt>
          <dd>
            日次の対数リターン ln(当日終値 ÷ 前日終値) の標本標準偏差 × √{TRADING_DAYS_PER_YEAR}。1
            年を {TRADING_DAYS_PER_YEAR} 営業日として年率に換算しています。
          </dd>
          <dt>最大下落率</dt>
          <dd>期間中、それまでの最高値から最も大きく下がった割合。</dd>
          <dt>平均売買代金</dt>
          <dd>期間中の 1 日あたりの売買代金（調整なし）の平均。</dd>
          <dt>移動平均</dt>
          <dd>直近 25 営業日・75 営業日の終値の単純平均。</dd>
          <dt>比較（初日 = 100）</dt>
          <dd>比較するすべての銘柄にデータがある期間にそろえ、その初日の終値を 100 とした指数。</dd>
          <dt>相関</dt>
          <dd>
            2 銘柄がともに取引された日の日次対数リターンのピアソン相関係数。共通の取引日が{' '}
            {MIN_CORRELATION_DAYS} 日未満の場合は表示しません。
          </dd>
          <dt>財務</dt>
          <dd>
            通期の決算短信（開示書類種別が FYFinancialStatements、会計期間が
            FY）の値。同じ決算期に複数の開示がある場合は、最も新しい開示を使います。
          </dd>
          <dt>取引がない日</dt>
          <dd>売買停止などで四本値がない日は、リターンと指標の計算から除外します。</dd>
        </dl>
      </section>

      <section className="card prose" aria-labelledby="about-limits">
        <h2 id="about-limits">制限事項</h2>
        <ul>
          <li>J-Quants の Free プランのデータは約 12 週間遅れで、取得できるのは約 2 年分です。</li>
          <li>
            Free プランは 1 分間に 5
            回までしか取得できないため、初回の表示に時間がかかることがあります。
          </li>
          <li>
            TOPIX などの指数との比較は、Free
            プランでは指数データを取得できないため対応していません。
          </li>
          <li>配当による株価の調整は含まれません（J-Quants の調整済み株価の仕様）。</li>
        </ul>
      </section>
    </div>
  )
}
