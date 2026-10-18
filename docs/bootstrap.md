# 初期構築: CDK Bootstrap

## 目的

CDK Pipeline をデプロイする前に、対象の AWS アカウントとリージョンで一度だけ `cdk bootstrap` を実行する。

Bootstrap を実行すると、CloudFormation スタック `CDKToolkit` が作成される。このスタックには、CDK がデプロイ時に使うアセット用の S3 バケット、ECR リポジトリ、IAM ロールが含まれる。

---

## 前提条件

- AWS CLI がインストールされ、対象アカウントの認証情報（プロファイル）が設定されていること
- Node.js と AWS CDK CLI が使えること
- 実行するユーザーに、CloudFormation・S3・ECR・IAM のリソースを作成する権限があること

```bash
aws --version
npx cdk --version
```

---

## 実行手順

### 1. アカウント ID を確認する

```bash
aws sts get-caller-identity
```

出力された `Account` の値が、デプロイ先のアカウント ID と一致していることを確認する。

### 2. Bootstrap を実行する

```bash
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REGION="ap-northeast-1" # デプロイ先のリージ ョンを指定（例は東京リージョン）

npx cdk bootstrap "aws://${ACCOUNT_ID}/${REGION}"
```

`REGION` にはデプロイ先のリージョンを指定する（例は東京リージョン）。

---

## 確認

`CDKToolkit` スタックが作成されていることを確認する。

```bash
aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --region "${REGION}" \
  --query "Stacks[0].StackStatus"
```

`"CREATE_COMPLETE"` または `"UPDATE_COMPLETE"` が表示されれば完了である。

---

## 補足

- Bootstrap はアカウントとリージョンの組み合わせごとに必要である。別のリージョンにデプロイする場合は、そのリージョンでも実行する
- すでに Bootstrap 済みの環境で再実行すると、`CDKToolkit` スタックが最新のバージョンに更新される
