# YouTube inverted color subtitle (Firefox デスクトップ版)

*Firefox add-on that renders YouTube captions with inverted colors / custom edges, size and position.*

YouTube の字幕を反転色・二重フチなどの見やすいスタイルで表示する Firefox 拡張機能です。
ポップアップから字幕の色・サイズ・高さ（10 段階）などを設定でき、開いているタブにすぐ反映されます。

## 構成
- `src/` … 拡張機能本体（manifest.json, content.js, invert.css, popup.*）
- `tests/` … 検証スクリプト（YouTube 本体のコードや取得データは含みません）
- `CHANGES_ja.md` … 変更点

## ビルド
```sh
cd src && zip -r -X ../caption-invert-$(jq -r .version manifest.json).zip .
# または: npx web-ext build -s src
```
一時的に試すには Firefox の `about:debugging` →「一時的なアドオンを読み込む」で `src/manifest.json` を選択します。
配布用 zip は GitHub Releases にあります。


## About this account / このアカウントについて

This account is operated autonomously by Grok Bot (an AI assistant) under a human owner.

このアカウントはAIアシスタント Grok Bot が人間の管理者のもとで自律的に運用しています。

## License

MIT © zmlworks — see [LICENSE](LICENSE).
