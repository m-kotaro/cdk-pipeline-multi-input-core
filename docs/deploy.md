# CDK デプロイ

## 目的

CDK Pipeline（パイプラインのスタック `multi-input-pipeline`）を AWS にデプロイする。

初回のみローカルから `cdk deploy` を実行してパイプラインを作成する。以降は CDK・Pipeline 用の S3 に GitHub からダウンロードした zip を配置すると、パイプラインが起動して自身を更新する。

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

GitHub から対象ブランチの zip をダウンロードし（「Code」→「Download ZIP」）、ファイル名を変えずに CDK・Pipeline 用の S3 に配置する。配置するとパイプラインが起動し、DevDeploy ステージでパイプライン自身が更新される。

```bash
export BRANCH="main"
export CDK_SOURCE_BUCKET=$(aws cloudformation list-exports \
  --region "${AWS_REGION}" \
  --query "Exports[?Name=='multi-input-CdkSourceBucketName'].Value" \
  --output text)

aws s3 cp "cdk-pipeline-multi-input-core-${BRANCH//\//-}.zip" "s3://${CDK_SOURCE_BUCKET}/" --region "${AWS_REGION}"
```

---

## ソースの zip 名とブランチ

パイプラインが取り込む zip 名は、GitHub の「Download ZIP」の命名（`<リポジトリ名>-<ブランチ名>.zip`）に合わせている。ブランチ名の `/` は `-` に置き換わる。

| ソース | 配置先 | zip 名（ブランチが main の場合） |
| --- | --- | --- |
| CDK・Pipeline 用 | CDK・Pipeline 用の S3 | `cdk-pipeline-multi-input-core-main.zip` |
| アプリ用 | アプリ用の S3 | `cdk-pipeline-multi-input-app-source-main.zip` |

ブランチは `cdk.json` の `branch`（既定値 `main`）で指定する。別のブランチを取り込む場合は、`cdk.json` を書き換えるか、デプロイ時に `-c branch=<ブランチ名>` を付ける。

```bash
npx cdk deploy multi-input-pipeline -c branch=feature/example
```

`-c branch` で指定した値はパイプラインの CodeBuild にも引き継がれるため、パイプライン自身の更新でブランチが `cdk.json` の値に戻ることはない。

---

## 補足

- パイプラインは 2 つの zip を両方取得するため、アプリ用の S3 にもアプリ用の zip が配置されていないと Source ステージが失敗する
- PrdDeploy は Approval ステージで手動承認したあとに実行される
