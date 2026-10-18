#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { DEPLOY_STAGES, DeployStage, PipelineStack } from "../lib/pipeline-stack";

const app = new App();

const getContext = (key: string): string => {
  const value = app.node.tryGetContext(key);
  if (typeof value !== "string" || value === "") {
    throw new Error(`context "${key}" が設定されていない（cdk.json または -c ${key}=... で指定する）`);
  }
  return value;
};

/**
 * パイプラインの Deploy ステージから -c stage=dev|prd で渡される対象環境。
 * ローカルからの初回デプロイ時は未指定（undefined）。
 */
const getStage = (): DeployStage | undefined => {
  const value = app.node.tryGetContext("stage");
  if (value === undefined) {
    return undefined;
  }
  if (!DEPLOY_STAGES.includes(value)) {
    throw new Error(`context "stage" は ${DEPLOY_STAGES.join(" / ")} のいずれかを指定する（指定値: ${value}）`);
  }
  return value as DeployStage;
};

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const prefix = getContext("prefix");
const stage = getStage();

// パイプライン自身。どのステージから cdk deploy しても同じ定義で更新される
new PipelineStack(app, `${prefix}-pipeline`, {
  env,
  prefix,
  pipelineName: getContext("pipelineName"),
  // 既定値は cdk.json の "main"。-c branch=<ブランチ名> で上書きできる
  branch: getContext("branch"),
  cdkSourceRepo: getContext("cdkSourceRepo"),
  appSourceRepo: getContext("appSourceRepo"),
});

// アプリ起因のリソース（Lambda / Step Functions）は未実装。
// 実装時は stage ごとのスタック（例: `${prefix}-app-${stage}`）をここで定義し、
// context "appSourceDir"（アプリ用ソースの展開先）からコードを読み込む。
void stage;
