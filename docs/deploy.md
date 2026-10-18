# CDK デプロイ

## 目的

CDK Pipeline（パイプラインのスタック `multi-input-pipeline`）を AWS にデプロイする。

初回のみローカルから `cdk deploy` を実行してパイプラインを作成する。以降は CDK・Pipeline 用の S3 に `cdk.zip` を配置すると、パイプラインが起動して自身を更新する。

---

## 前提条件

- [初期構築: CDK Bootstrap](bootstrap.md) が完了していること
- [初期依存リソース（S3・IAM）](../cloudformation/README.md) のスタックがデプロイ済みであること
- リポジトリのルートで実行すること

---

## 初回デプロイ

### 1. 依存パッケージをインストールする

```bash
npm ci
```

### 2. デプロイ先のリージョンを指定する

```bash
export AWS_REGION="ap-northeast-1"
```

`AWS_REGION` にはデプロイ先のリージョンを指定する（例は東京リージョン）。

### 3. 差分を確認する

```bash
npx cdk diff multi-input-pipeline
```

### 4. デプロイする

```bash
npx cdk deploy multi-input-pipeline
```

---

## 確認

パイプラインのステージが Source → DevDeploy → Approval → PrdDeploy の順に作成されていることを確認する。

```bash
aws codepipeline get-pipeline \
  --name multi-input-pipeline \
  --region "${AWS_REGION}" \
  --query "pipeline.stages[].name"
```

---

## 2 回目以降の更新

リポジトリを `cdk.zip` にまとめ、CDK・Pipeline 用の S3 に配置する。配置するとパイプラインが起動し、DevDeploy ステージでパイプライン自身が更新される。

```bash
export CDK_SOURCE_BUCKET=$(aws cloudformation list-exports \
  --region "${AWS_REGION}" \
  --query "Exports[?Name=='multi-input-CdkSourceBucketName'].Value" \
  --output text)

git archive --format=zip -o cdk.zip HEAD
aws s3 cp cdk.zip "s3://${CDK_SOURCE_BUCKET}/cdk.zip" --region "${AWS_REGION}"
```

`git archive` はコミット済みのファイルだけを zip にする。未コミットの変更は含まれない。

---

## 補足

- パイプラインは `cdk.zip` と `app.zip` の両方を取得するため、アプリ用の S3 にも `app.zip` が配置されていないと Source ステージが失敗する
- PrdDeploy は Approval ステージで手動承認したあとに実行される
