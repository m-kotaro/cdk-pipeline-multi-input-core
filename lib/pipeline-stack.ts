import { Fn, Stack, StackProps } from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

/** デプロイ先の環境 */
export const DEPLOY_STAGES = ["dev", "prd"] as const;
export type DeployStage = (typeof DEPLOY_STAGES)[number];

export interface PipelineStackProps extends StackProps {
  /** cloudformation/prerequisites.yaml の Prefix と同じ値 */
  readonly prefix: string;
  /** CodePipeline のパイプライン名（prerequisites.yaml の PipelineName と同じ値） */
  readonly pipelineName: string;
  /** CDK・Pipeline 用ソースの S3 オブジェクトキー */
  readonly cdkSourceKey: string;
  /** アプリ用ソースの S3 オブジェクトキー */
  readonly appSourceKey: string;
}

/**
 * S3 の 2 つのソース（CDK・Pipeline 用 / アプリ用）を入力とする CodePipeline。
 * ステージ構成: Source → DevDeploy → Approval（手動承認）→ PrdDeploy
 *
 * S3 と IAM は CDK の管理外（cloudformation/prerequisites.yaml）で作成済みのものを参照する。
 * IAM ロールは mutable: false で参照し、CDK 側からポリシーを追加しない。
 */
export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const { prefix, pipelineName, cdkSourceKey, appSourceKey } = props;
    const importValue = (name: string) => Fn.importValue(`${prefix}-${name}`);

    // ------------------------------------------------------------
    // CDK 管理外リソースの参照
    // ------------------------------------------------------------
    const appSourceBucket = s3.Bucket.fromBucketName(this, "AppSourceBucket", importValue("AppSourceBucketName"));
    const cdkSourceBucket = s3.Bucket.fromBucketName(this, "CdkSourceBucket", importValue("CdkSourceBucketName"));
    const artifactBucket = s3.Bucket.fromBucketName(this, "ArtifactBucket", importValue("ArtifactBucketName"));

    const pipelineRole = iam.Role.fromRoleArn(this, "PipelineRole", importValue("PipelineRoleArn"), { mutable: false });
    const codeBuildRole = iam.Role.fromRoleArn(this, "CodeBuildRole", importValue("CodeBuildRoleArn"), { mutable: false });
    const eventsRole = iam.Role.fromRoleArn(this, "EventsRole", importValue("EventsRoleArn"), { mutable: false });

    // ------------------------------------------------------------
    // Pipeline
    // ------------------------------------------------------------
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName,
      pipelineType: codepipeline.PipelineType.V2,
      executionMode: codepipeline.ExecutionMode.QUEUED,
      role: pipelineRole,
      artifactBucket,
      crossAccountKeys: false,
      // アクションごとのロールを CDK に作らせず、パイプラインのロールで実行する
      usePipelineRoleForActions: true,
    });

    // Source: 起動は EventBridge ルールで行うため、アクション側のトリガーは無効にする
    const cdkOutput = new codepipeline.Artifact("Cdk");
    const appOutput = new codepipeline.Artifact("App");

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new actions.S3SourceAction({
          actionName: "CdkSource",
          bucket: cdkSourceBucket,
          bucketKey: cdkSourceKey,
          output: cdkOutput,
          trigger: actions.S3Trigger.NONE,
        }),
        new actions.S3SourceAction({
          actionName: "AppSource",
          bucket: appSourceBucket,
          bucketKey: appSourceKey,
          output: appOutput,
          trigger: actions.S3Trigger.NONE,
        }),
      ],
    });

    // Dev Deploy → Approval → Prd Deploy
    const deployAction = (stage: DeployStage) =>
      new actions.CodeBuildAction({
        actionName: "CdkDeploy",
        project: this.createDeployProject(prefix, stage, codeBuildRole),
        input: cdkOutput,
        extraInputs: [appOutput],
      });

    pipeline.addStage({
      stageName: "DevDeploy",
      actions: [deployAction("dev")],
    });

    pipeline.addStage({
      stageName: "Approval",
      actions: [
        new actions.ManualApprovalAction({
          actionName: "ManualApproval",
          additionalInformation: "dev 環境の動作を確認してから承認する",
        }),
      ],
    });

    pipeline.addStage({
      stageName: "PrdDeploy",
      actions: [deployAction("prd")],
    });

    // ------------------------------------------------------------
    // Trigger: どちらの S3 にオブジェクトを配置してもパイプラインを起動する
    // ------------------------------------------------------------
    const sources = [
      { id: "CdkSourceRule", bucket: cdkSourceBucket, key: cdkSourceKey },
      { id: "AppSourceRule", bucket: appSourceBucket, key: appSourceKey },
    ];
    for (const source of sources) {
      new events.Rule(this, source.id, {
        eventPattern: {
          source: ["aws.s3"],
          detailType: ["Object Created"],
          detail: {
            bucket: { name: [source.bucket.bucketName] },
            object: { key: [source.key] },
          },
        },
        targets: [new targets.CodePipeline(pipeline, { eventRole: eventsRole })],
      });
    }
  }

  /**
   * 環境ごとに cdk deploy を実行する CodeBuild プロジェクト。
   * -c stage で対象環境を、-c appSourceDir でアプリ用ソースの展開先（CODEBUILD_SRC_DIR_App）を CDK に渡す。
   */
  private createDeployProject(prefix: string, stage: DeployStage, role: iam.IRole): codebuild.PipelineProject {
    return new codebuild.PipelineProject(this, `DeployProject-${stage}`, {
      projectName: `${prefix}-deploy-${stage}`,
      role,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "22" },
            commands: ["npm ci"],
          },
          build: {
            commands: [
              `npx cdk deploy --all --require-approval never -c stage=${stage} -c appSourceDir="\${CODEBUILD_SRC_DIR_App}"`,
            ],
          },
        },
      }),
    });
  }
}
