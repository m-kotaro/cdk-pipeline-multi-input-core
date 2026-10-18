# cdk-pipeline-multi-input-core

## 概要

Lambda や Step Functions など、アプリケーション起因のリソースを構築するための CDK Pipeline である。

インフラ（IaC）とアプリケーションの責任範囲を分けることを目的としている。

- IaC 側の責任範囲: CDK のコードと Pipeline の定義。このリポジトリで管理し、専用の S3 バケットに配置する
- アプリ側の責任範囲: Lambda や Step Functions などのアプリケーションのソース。別リポジトリ（今回は S3）で管理し、zip で配置する

どちらの S3 に配置しても Pipeline が起動するため、IaC 側とアプリ側はそれぞれ独立して変更をデプロイできる。

---

## アーキテクチャ図

![アーキテクチャ図](img/architecture.drawio.svg)

---

## 初期設定（Bootstrap）

対象の AWS アカウントとリージョンで `cdk bootstrap` を実行する。手順は [初期構築: CDK Bootstrap](docs/bootstrap.md) を参照。

---

## 初期依存リソースのデプロイ

CDK Pipeline のデプロイ前に、初期依存リソース（S3・IAM）を CloudFormation でデプロイする必要がある。これらは CDK の管理外とするため、CDK とは別に作成する。手順は [cloudformation/README.md](cloudformation/README.md) を参照。

---

## CDK デプロイ

初期設定と初期依存リソースのデプロイが完了したあとに、CDK Pipeline をデプロイする。初回はローカルから `cdk deploy` を実行し、以降は CDK・Pipeline 用の S3 に `cdk.zip` を配置して更新する。手順は [CDK デプロイ](docs/deploy.md) を参照。
