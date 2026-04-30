# Software Development & DevOps Codex Harnesses

이 프로젝트에는 카테고리 2: 소프트웨어 개발 & DevOps (16~30) 하네스 전체가 Codex 형식으로 통합 적용되어 있다.

## Codex 공식 문서 기준

- `AGENTS.md`는 Codex가 작업 전에 읽는 프로젝트 지침 파일이다.
- custom agent는 `.codex/agents/*.toml` 파일로 정의하며 top-level `name`, `description`, `developer_instructions`를 포함한다.
- repo-scoped skill은 `.agents/skills/<skill-name>/SKILL.md`에 두며 YAML front matter에 `name`, `description`을 포함한다.
- Codex 공식 문서에 따르면 하위 에이전트는 사용자가 명시적으로 요청할 때만 생성된다.

## 통합 설계

- 추론한 설계: 하나의 프로젝트에 15개 하네스를 동시에 적용하기 위해 agent 이름과 파일명에 하네스 prefix를 붙였다.
- 추론한 설계: skill 이름은 16~30 범위에서 충돌이 없어 원래 이름을 유지한다.
- 추론한 설계: 원본 Claude 팀 오케스트레이션은 Codex에서 명시적 subagent 요청 시 사용할 수 있는 custom agent 조합과 skill 워크플로우로 보존한다.

## 적용된 하네스

- `16-fullstack-webapp`: 풀스택 웹앱: 설계→프론트→백엔드→테스트→배포
- `17-mobile-app-builder`: 모바일 앱: UI/UX→코드→API→스토어배포
- `18-api-designer`: REST/GraphQL API 설계·문서화·목업·테스트
- `19-database-architect`: DB: 모델링→마이그레이션→인덱싱→최적화
- `20-cicd-pipeline`: CI/CD 파이프라인 설계·구축·최적화
- `21-code-reviewer`: 코드 리뷰: 스타일→보안→성능→아키텍처
- `22-legacy-modernizer`: 레거시 현대화: 분석→리팩토링→마이그레이션
- `23-microservice-designer`: 마이크로서비스 아키텍처 설계·분해·통신
- `24-test-automation`: 테스트 자동화: 전략→작성→CI→커버리지
- `25-incident-postmortem`: 장애 사후분석: 타임라인→근본원인→재발방지
- `26-infra-as-code`: IaC: Terraform/Pulumi→보안→비용최적화
- `27-data-pipeline`: 데이터 파이프라인: ETL→품질검증→모니터링
- `28-security-audit`: 보안 감사: 취약점→코드분석→침투테스트→권고
- `29-performance-optimizer`: 성능 최적화: 프로파일링→병목→최적화→벤치마크
- `30-open-source-launcher`: 오픈소스 런칭: 코드정리→문서→라이선스→커뮤니티

## 사용 방법

1. 사용자 요청이 특정 하네스와 맞으면 관련 `.agents/skills/**/SKILL.md`를 우선 적용한다.
2. 사용자가 하위 에이전트 사용을 명시하면 `.codex/agents/<harness>-<agent>.toml`에서 필요한 역할을 선택한다.
3. 여러 하네스가 필요한 요청은 산출물 경로와 작업 범위를 먼저 나누고, `_workspace/` 아래에 하네스별 문서를 정리한다.
4. 구현, 검토, 테스트, 배포 관련 변경은 실행한 명령과 결과를 최종 응답에 보고한다.

## 출력 기준

- 변경 파일과 목적을 경로별로 요약한다.
- 실행한 검증 명령과 결과를 포함한다.
- 실행하지 못한 검증은 이유와 잔여 위험을 남긴다.
- 보안, 성능, 배포, 데이터 손실 가능성이 있는 작업은 위험과 완화 방안을 분리해서 적는다.

## 실행 시 유의사항

- 기존 사용자 변경을 되돌리지 않는다.
- 새 의존성, 외부 서비스, 인프라 변경은 필요성과 영향을 먼저 명확히 한다.
- 보안 감사, 배포, IaC, 장애 분석 작업에서는 파괴적 명령이나 실제 외부 공격 실행을 하지 않는다.
- 모호한 요구사항은 합리적 가정을 문서화하고, 위험한 가정은 사용자에게 확인한다.

## Agents

- `.codex/agents/16-fullstack-webapp-architect.toml`
- `.codex/agents/16-fullstack-webapp-backend-dev.toml`
- `.codex/agents/16-fullstack-webapp-devops-engineer.toml`
- `.codex/agents/16-fullstack-webapp-frontend-dev.toml`
- `.codex/agents/16-fullstack-webapp-qa-engineer.toml`
- `.codex/agents/17-mobile-app-builder-api-integrator.toml`
- `.codex/agents/17-mobile-app-builder-app-developer.toml`
- `.codex/agents/17-mobile-app-builder-qa-engineer.toml`
- `.codex/agents/17-mobile-app-builder-store-manager.toml`
- `.codex/agents/17-mobile-app-builder-ux-designer.toml`
- `.codex/agents/18-api-designer-api-architect.toml`
- `.codex/agents/18-api-designer-doc-writer.toml`
- `.codex/agents/18-api-designer-mock-tester.toml`
- `.codex/agents/18-api-designer-review-auditor.toml`
- `.codex/agents/18-api-designer-schema-validator.toml`
- `.codex/agents/19-database-architect-data-modeler.toml`
- `.codex/agents/19-database-architect-integration-reviewer.toml`
- `.codex/agents/19-database-architect-migration-manager.toml`
- `.codex/agents/19-database-architect-performance-analyst.toml`
- `.codex/agents/19-database-architect-security-auditor.toml`
- `.codex/agents/20-cicd-pipeline-infra-engineer.toml`
- `.codex/agents/20-cicd-pipeline-monitoring-specialist.toml`
- `.codex/agents/20-cicd-pipeline-pipeline-designer.toml`
- `.codex/agents/20-cicd-pipeline-pipeline-reviewer.toml`
- `.codex/agents/20-cicd-pipeline-security-scanner.toml`
- `.codex/agents/21-code-reviewer-architecture-reviewer.toml`
- `.codex/agents/21-code-reviewer-performance-analyst.toml`
- `.codex/agents/21-code-reviewer-review-synthesizer.toml`
- `.codex/agents/21-code-reviewer-security-analyst.toml`
- `.codex/agents/21-code-reviewer-style-inspector.toml`
- `.codex/agents/22-legacy-modernizer-legacy-analyzer.toml`
- `.codex/agents/22-legacy-modernizer-migration-engineer.toml`
- `.codex/agents/22-legacy-modernizer-modernization-reviewer.toml`
- `.codex/agents/22-legacy-modernizer-refactoring-strategist.toml`
- `.codex/agents/22-legacy-modernizer-regression-tester.toml`
- `.codex/agents/23-microservice-designer-architecture-reviewer.toml`
- `.codex/agents/23-microservice-designer-communication-designer.toml`
- `.codex/agents/23-microservice-designer-domain-analyst.toml`
- `.codex/agents/23-microservice-designer-observability-engineer.toml`
- `.codex/agents/23-microservice-designer-service-architect.toml`
- `.codex/agents/24-test-automation-coverage-analyst.toml`
- `.codex/agents/24-test-automation-integration-tester.toml`
- `.codex/agents/24-test-automation-qa-reviewer.toml`
- `.codex/agents/24-test-automation-test-strategist.toml`
- `.codex/agents/24-test-automation-unit-tester.toml`
- `.codex/agents/25-incident-postmortem-impact-assessor.toml`
- `.codex/agents/25-incident-postmortem-postmortem-reviewer.toml`
- `.codex/agents/25-incident-postmortem-remediation-planner.toml`
- `.codex/agents/25-incident-postmortem-root-cause-investigator.toml`
- `.codex/agents/25-incident-postmortem-timeline-reconstructor.toml`
- `.codex/agents/26-infra-as-code-cost-optimizer.toml`
- `.codex/agents/26-infra-as-code-drift-detector.toml`
- `.codex/agents/26-infra-as-code-iac-reviewer.toml`
- `.codex/agents/26-infra-as-code-infra-architect.toml`
- `.codex/agents/26-infra-as-code-security-engineer.toml`
- `.codex/agents/27-data-pipeline-data-quality-manager.toml`
- `.codex/agents/27-data-pipeline-etl-architect.toml`
- `.codex/agents/27-data-pipeline-monitoring-specialist.toml`
- `.codex/agents/27-data-pipeline-pipeline-reviewer.toml`
- `.codex/agents/27-data-pipeline-scheduler-engineer.toml`
- `.codex/agents/28-security-audit-audit-reviewer.toml`
- `.codex/agents/28-security-audit-code-analyst.toml`
- `.codex/agents/28-security-audit-pentest-reporter.toml`
- `.codex/agents/28-security-audit-security-consultant.toml`
- `.codex/agents/28-security-audit-vulnerability-scanner.toml`
- `.codex/agents/29-performance-optimizer-benchmark-manager.toml`
- `.codex/agents/29-performance-optimizer-bottleneck-analyst.toml`
- `.codex/agents/29-performance-optimizer-optimization-engineer.toml`
- `.codex/agents/29-performance-optimizer-perf-reviewer.toml`
- `.codex/agents/29-performance-optimizer-profiler.toml`
- `.codex/agents/30-open-source-launcher-code-organizer.toml`
- `.codex/agents/30-open-source-launcher-community-manager.toml`
- `.codex/agents/30-open-source-launcher-doc-writer.toml`
- `.codex/agents/30-open-source-launcher-launch-reviewer.toml`
- `.codex/agents/30-open-source-launcher-license-specialist.toml`

## Skills

- `.agents/skills/api-designer/SKILL.md`
- `.agents/skills/api-error-design/SKILL.md`
- `.agents/skills/api-security-checklist/SKILL.md`
- `.agents/skills/app-store-optimization/SKILL.md`
- `.agents/skills/caching-strategy-selector/SKILL.md`
- `.agents/skills/cicd-pipeline/SKILL.md`
- `.agents/skills/cloud-cost-models/SKILL.md`
- `.agents/skills/code-reviewer/SKILL.md`
- `.agents/skills/community-health-metrics/SKILL.md`
- `.agents/skills/component-patterns/SKILL.md`
- `.agents/skills/cve-analysis/SKILL.md`
- `.agents/skills/dag-orchestration-patterns/SKILL.md`
- `.agents/skills/data-pipeline/SKILL.md`
- `.agents/skills/data-quality-framework/SKILL.md`
- `.agents/skills/database-architect/SKILL.md`
- `.agents/skills/ddd-context-mapping/SKILL.md`
- `.agents/skills/dependency-analysis/SKILL.md`
- `.agents/skills/deployment-strategies/SKILL.md`
- `.agents/skills/distributed-patterns/SKILL.md`
- `.agents/skills/fullstack-webapp/SKILL.md`
- `.agents/skills/incident-postmortem/SKILL.md`
- `.agents/skills/infra-as-code/SKILL.md`
- `.agents/skills/legacy-modernizer/SKILL.md`
- `.agents/skills/license-compatibility-matrix/SKILL.md`
- `.agents/skills/microservice-designer/SKILL.md`
- `.agents/skills/mobile-app-builder/SKILL.md`
- `.agents/skills/mobile-ux-patterns/SKILL.md`
- `.agents/skills/mocking-strategy/SKILL.md`
- `.agents/skills/normalization-patterns/SKILL.md`
- `.agents/skills/open-source-launcher/SKILL.md`
- `.agents/skills/owasp-testing-guide/SKILL.md`
- `.agents/skills/performance-optimizer/SKILL.md`
- `.agents/skills/pipeline-security-gates/SKILL.md`
- `.agents/skills/query-optimization-catalog/SKILL.md`
- `.agents/skills/query-optimization-patterns/SKILL.md`
- `.agents/skills/rca-methodology/SKILL.md`
- `.agents/skills/refactoring-catalog/SKILL.md`
- `.agents/skills/rest-api-conventions/SKILL.md`
- `.agents/skills/security-audit/SKILL.md`
- `.agents/skills/sla-impact-calculator/SKILL.md`
- `.agents/skills/strangler-fig-patterns/SKILL.md`
- `.agents/skills/terraform-module-patterns/SKILL.md`
- `.agents/skills/test-automation/SKILL.md`
- `.agents/skills/test-design-patterns/SKILL.md`
- `.agents/skills/threat-modeling/SKILL.md`
- `.agents/skills/vulnerability-patterns/SKILL.md`