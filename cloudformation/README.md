# cloudformation

## 概要

CDK Pipeline の前提となる S3 と IAM を作成する CloudFormation テンプレートである。

S3 と IAM は CDK の管理外とするため、CDK とは別に `prerequisites.yaml` で作成する。CDK のデプロイより前に、対象の AWS アカウントとリージョンで一度だけデプロイする。

---

## デプロイコマンド

```bash
export REGION=ap-northeast-1

aws cloudformation deploy \
  --template-file cloudformation/prerequisites.yaml \
  --stack-name multi-input-prerequisites \
  --region "${REGION}" \
  --capabilities CAPABILITY_NAMED_IAM
```

| パラメータ     | 既定値                 | 説明                                         |
| -------------- | ---------------------- | -------------------------------------------- |
| `Prefix`       | `multi-input`          | リソース名の接頭辞                           |
| `PipelineName` | `multi-input-pipeline` | CDK で作成する CodePipeline のパイプライン名 |
| `CdkQualifier` | `hnb659fds`            | `cdk bootstrap` の Qualifier                 |

---

## 作成リソース

| 種類        | 論理 ID           | リソース名                                         | 用途                                                         |
| ----------- | ----------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| S3 バケット | `AppSourceBucket` | `${Prefix}-app-source-<アカウントID>-<リージョン>` | アプリ用ソース配置（zip）                                    |
| S3 バケット | `CdkSourceBucket` | `${Prefix}-cdk-source-<アカウントID>-<リージョン>` | CDK・Pipeline 用ソース配置（zip）                            |
| S3 バケット | `ArtifactBucket`  | `${Prefix}-artifact-<アカウントID>-<リージョン>`   | パイプラインのアーティファクト置き場（30 日で削除）          |
| IAM ロール  | `PipelineRole`    | `${Prefix}-pipeline-role`                          | CodePipeline のサービスロール                                |
| IAM ロール  | `CodeBuildRole`   | `${Prefix}-codebuild-role`                         | CodeBuild（Synth / SelfMutate / Assets）のサービスロール     |
| IAM ロール  | `EventsRole`      | `${Prefix}-events-role`                            | S3 へのオブジェクト配置で EventBridge からパイプラインを起動 |
