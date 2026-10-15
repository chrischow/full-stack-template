# Prototype Stack for Rapid Deployment and Immediate User Onboarding

- **Status:** Draft for review
- **Date:** 2026-10-13
- **Related RFC:** [Pulumi IaC with self-managed state](2026-10-06-rfc-pulumi-iac-self-managed-state.md)
- **Provisional app-serving candidate:** Lambda container image + Lambda Web Adapter, with NestJS serving the API and SPA behind CloudFront + AWS WAF; this approach is not yet validated against the application or release requirements.
- **Recommended database:** Neon PostgreSQL in Singapore, subject to provider/security approval.
- **App-serving fallback:** ECS Express Mode with ALB + AWS WAF.
- **Database fallback:** Aurora PostgreSQL-Compatible Serverless v2 with private access and SSM troubleshooting.

## Problem Context

The team needs a deployed prototype that real users can test and immediately onboard to, not just a disposable demo. Developers expect to release 10–20 times per day and need straightforward database access to investigate user issues. Deployment machinery must be lightweight without treating user data as disposable.

The preceding IaC RFC establishes an isolated prototype AWS account, a TypeScript Pulumi workload project, GitHub Actions deployment, and self-managed S3 state protected by KMS. It deliberately leaves the workload architecture unspecified. This RFC selects that architecture without revisiting the account/state design or defining staging and production infrastructure.

The repository already packages NestJS and the React SPA in one container. NestJS serves the SPA and exposes the API beneath `/api`. PostgreSQL supports application data, sessions, and a database-backed cache. Consequently, database availability affects more than explicit application queries, and frequent background requests may prevent an otherwise pause-capable database from becoming idle.

Two decisions dominate the design:

1. **How to serve the application:** preserve the container model or adapt it to a serverless HTTP runtime.
2. **Where to host PostgreSQL:** favor immediate developer access and low operational overhead, or AWS-native private networking and control.

The proposed Singapore restriction is interpreted as **allowing application requests only from client IP addresses geolocated to Singapore**. It is not proof of a user's physical location or a guarantee that every network/control-plane operation occurs in Singapore.

## Goals

- Make 10–20 daily deployments routine, including failed-release recovery.
- Preserve reliable onboarding, sessions, and user data across deployments.
- Minimize initial platform work and ongoing developer friction.
- Provide controlled, documented database troubleshooting access.
- Protect public ingress without leaving an unprotected alternate origin.
- Keep infrastructure reproducible through the existing prototype Pulumi project.
- Explicitly compare hosting and database alternatives independently.

## Requirements

### Functional requirements

- Serve the existing NestJS API and React SPA over HTTPS on a stable hostname.
- Preserve `/api` routing and support deep links handled by React's client-side router.
- Provide PostgreSQL compatible with the existing Prisma PostgreSQL adapter, session store, and cache.
- Deploy immutable, identifiable releases from GitHub Actions and support application rollback.
- Run versioned database migrations through a controlled release step.
- Allow authorized developers to inspect the database with SQL tools without changing application ingress rules.
- Store application secrets outside source control, image layers, and plaintext Pulumi configuration.
- Allow Singapore application traffic and reject other geolocated countries; retain normal authentication and authorization.
- Provide application logs, health checks, error visibility, and a tested database recovery procedure.

### Non-functional requirements

- **Release frequency:** support 10–20 successful deployments per day without routine infrastructure replacement or user downtime caused by intentional stop/start deployment.
- **Release speed:** target within four minutes from push to a usable release for ordinary, backward-compatible application changes. Measure CI scheduling, required checks, builds, upload, version publication, alias activation, and public availability—not just artifact deployment. Initial provisioning, infrastructure changes, and substantial database migrations are separate workflows. This target requires benchmarking; it is not a vendor guarantee.
- **Recovery:** proposed target of restoring the previous application artifact within 10 minutes when schemas remain backward compatible. Database recovery is a separate procedure, not covered by this target.
- **Troubleshooting:** after one-time access setup, a developer should normally obtain authorized read-only SQL access within five minutes.
- **Durability:** no destructive database synchronization or reset against onboarded-user data; backups and restore validation are mandatory.
- **Security:** least-privilege runtime and deployment identities, TLS, restricted database credentials, and no unrestricted public database ingress where the selected provider supports enforceable restrictions.
- **Cost:** prefer low operational complexity and a modest idle floor, but do not trade away data recovery to reach a free tier. No approved monetary ceiling is currently specified.
- **Capacity:** initially assume modest prototype traffic, not a production SLA. Establish a load/concurrency envelope before onboarding and revisit sizing from measurements.

### Assumptions and non-goals

- An external database vendor is acceptable if its region, security controls, and recovery terms are approved. Otherwise select the AWS database fallback.
- The application does not require persistent process-local state for correctness. Existing database-backed sessions remain shared across replicas.
- WebSockets, long-running synchronous requests, large uploads, and in-process scheduled/background work are not established requirements; discover these before choosing Lambda.
- Compliance-grade Singapore-only processing, multi-region availability, per-developer complete environments, and production parity are not goals of this RFC.
- The prior RFC's prototype CI authentication policy remains unchanged. Any move to OIDC is a separate security decision.

## Options

### Decision 1: Serving the application

| Alternative | Existing application fit | Idle cost characteristics | Deployment and recovery | Principal tradeoff |
| --- | --- | --- | --- | --- |
| ECS Express Mode | Strong: existing container; WAF attaches to its ALB | Running tasks and generated ingress have a floor | Managed ECS rollout | Less assembly, with a narrower customization surface |
| Conventional ECS/Fargate + ALB | Strong: existing container | Tasks, ALB, and networking have a floor | Explicit health-gated rolling deployments and circuit breaker | More IaC, predictable ingress/security ownership |
| Lambda Web Adapter + CloudFront | Candidate Lambda container image containing NestJS and the React build; application compatibility and release path are unvalidated | Request-based compute; edge, logs, secrets, and DB still cost | Potential version/alias rollback of the application image; release path requires validation | Low idle compute versus cold starts and runtime/routing complexity |
| Lambda + API Gateway + CloudFront | Same candidate Lambda container image and NestJS static serving; unvalidated | Request-based compute plus gateway charges | Lambda version/alias release controls; image update path requires validation | API-oriented gateway adds cost/configuration but avoids some Function URL auth coupling |
| Managed container host, e.g. Render/Railway | Usually strong | Vendor/plan-dependent | Convenient deploy and rollback workflows | Additional vendor, region and geo-control requirements |
| Lightsail/EC2 VM + reverse proxy | Strong | Predictable instance floor | Team implements safe rollout and recovery | Low resource complexity, high patching and operations responsibility |

#### Option A: ECS Express Mode

Express Mode reduces the ECS, load-balancer, and autoscaling setup while retaining the current container. WAF can be attached to its ALB, so it supports the required ingress protection without hand-assembling equivalent ECS infrastructure.

**Pros**

- Minimal application/runtime adaptation.
- Managed scaffolding around an established container runtime.
- Suitable in principle for frequent immutable-image deployments.
- Avoids Lambda-specific limits and secret-bootstrap changes.

**Cons and operational considerations**

- Express Mode offers less resource customization than conventional ECS. Configure health checks, deployment controls, resource ownership, and replacement behavior through its supported interfaces.
- Managed convenience is not necessarily a lower bill: price tasks, ingress, logs, and networking together.
- Model the WAF association in Pulumi alongside Express Mode resources and test it during normal deployment and replacement checks, as with any ingress configuration.

**Disposition:** app-serving fallback if Lambda compatibility or measured runtime behavior fails the requirements. WAF attachment to its ALB is supported. Use Option B only if additional customization or resource ownership needs exceed Express Mode's supported controls.

#### Option B: Conventional ECS/Fargate with an explicitly managed ALB

Pulumi owns the ECS service, task definition, ALB, target group, web ACL, security groups, DNS/TLS, and networking. NestJS continues serving both API and SPA from the existing image.

**Pros**

- Closest match to the repository's current runtime and build artifact.
- Explicit ALB/WAF association makes the Singapore policy and its lifecycle understandable.
- Standard long-running Node behavior, predictable startup, and shared DB-backed sessions.
- Rolling deployment, health gates, and failure rollback can be configured directly.
- No initial need to split static artifacts from the backend release.

**Cons**

- More Pulumi resources than Express Mode and always-on task/ALB costs.
- Private tasks need an intentional egress design; NAT gateways can dominate a small prototype's bill.
- A single steady-state task is cheaper but is not highly available. Rolling updates need temporary spare capacity, and health checks must avoid cascading restarts during a DB incident.

**Disposition:** additional alternative when customization or resource ownership requirements exceed Express Mode's supported controls, not the selected app-serving fallback. It is not needed merely to attach WAF to an ALB.

#### Option C: Lambda Web Adapter with CloudFront and a Function URL

The candidate approach is to package the NestJS application, React build, and startup wrapper in a Lambda container image, with Lambda Web Adapter translating Lambda HTTP invocations to the Node HTTP server. NestJS would serve both the API and SPA/static files from the image; CloudFront would use the same Lambda origin for every behavior. There is no S3 static-content origin. This Lambda container-image approach has not yet been validated against the application's runtime, build, deployment, or release requirements.

**Pros**

- Low idle application-compute cost and automatic request-driven scaling.
- Immutable Lambda versions/aliases support fast application cutover and rollback.
- CloudFront can cache fingerprinted assets served by NestJS, avoiding Lambda invocation on cache hits while retaining one application artifact.
- Edge geo restrictions are a natural fit for the proposed ingress requirement.

**Cons**

- NestJS cold starts and database resume can combine into noticeable first-request latency. Provisioned concurrency can reduce this but weakens the low-idle-cost argument.
- Lambda concurrency can multiply both Prisma and cache/session connections. Pooling, explicit pool sizes, and concurrency limits are required.
- HTTP payload, duration, streaming, and background execution constraints need application-specific validation. API Gateway and Function URLs have different constraints.
- Static cache misses invoke Lambda and may encounter cold starts. Validate that static requests do not unnecessarily perform session/cache database work.
- Lambda container-image compatibility with the application's NestJS decorators/reflection, runtime dependencies, static-file paths, secret initialization, and origin authentication requires validation. Validate the image build and deployment path, runtime architecture and configuration, and image size. Do not assume the existing container can be deployed to Lambda unchanged.

**Container-image packaging and runtime secrets**

- Build a Lambda-compatible container image containing the backend and frontend build at the paths NestJS expects, then publish it to ECR and deploy it to Lambda. Validate the image build, Lambda configuration, Web Adapter integration, and immutable version/alias release flow before selecting this option. The image-based approach is not yet validated for this application.
- A Node startup wrapper retrieves runtime secrets, assigns the required values to `process.env`, and only then loads and starts NestJS. This supplies database configuration before clients are constructed. Avoid eager imports that initialize the application before the wrapper sets the environment.
- The wrapper can retrieve secrets through the AWS SDK using the execution role during startup. AWS's Parameters and Secrets Lambda Extension does not itself inject environment variables; if used, its retrieval endpoint must be available at the point the wrapper calls it. Invocation-only retrieval must not become a bootstrap dependency.
- Define cached-secret refresh/rotation behavior for warm environments. Never include secret values in the image, logs, or plaintext infrastructure state.

**CloudFront routing**

| Request | Origin/handling | Cache policy |
| --- | --- | --- |
| `/api` and `/api/*` | NestJS through the Lambda origin; never SPA fallback | Disabled; forward required cookies, query strings, and application auth |
| Known fingerprinted static-asset namespace | Same Lambda origin; NestJS serves the frontend build | Long-lived immutable cache; do not cache personalized responses |
| `/` and frontend routes | Same Lambda origin; NestJS serves `index.html` and handles SPA deep links | Short-lived or revalidated; disable caching if responses are personalized or set sessions |
| Missing API or asset | Preserve actual NestJS error | Never rewrite to `index.html` |

CloudFront selects cache behavior, not a separate static origin. Let NestJS handle frontend routing and verify that its fallback excludes API and missing-asset requests. Avoid distribution-wide 403/404-to-HTML error mappings. Define asset behaviors against the real frontend output, including unversioned files. Forward cookies and auth only where needed, and ensure cached static responses do not contain session cookies or user-specific content.

Use an IAM-authenticated Function URL with CloudFront OAC and a resource policy scoped to the distribution to prevent direct-origin bypass. Verify the current invocation permissions and signed request-body requirements, especially POST/PUT and upload handling. OAC origin signing can conflict with viewer `Authorization`; existing cookie sessions may fit, but bearer-token APIs need a deliberate forwarding/auth design. Do not simply disable origin signing to preserve a bearer header. Avoid forwarding the viewer `Host` to the Function URL; separately validate forwarded host/protocol handling and secure cookies.

For the candidate image-based approach, publish an immutable Lambda version from the image and shift the serving alias only after the image update is ready. Validate this update and promotion sequence before relying on it for releases. Developers validate the release at the main endpoint after cutover; there is no separate candidate-navigation or pre-promotion smoke-test gate. Rollback would move the alias to the previous compatible version. Point CloudFront at a Function URL associated with the stable serving alias: moving the alias does not change the origin URL or require CloudFront configuration propagation.

Disable HTML caching initially and cache fingerprinted assets immutably, avoiding invalidation as a required release step. Retain previous release assets within the serving package for an agreed compatibility window so already-loaded browsers can fetch older lazy-loaded chunks after a rollout; cached copies alone do not guarantee availability. Keep API contracts backward compatible for those clients.

**Disposition:** ZIP packaging is not a maintainable app-serving approach for this template. The measured ZIP contained 248,725,123 extracted bytes, leaving only 1,274,877 bytes below the nominal 250,000,000-byte function-plus-layers limit before adding the required Lambda Web Adapter layer; it also leaves inadequate headroom for dependency growth. Do not pursue ZIP packaging or further ad hoc pruning. A Lambda container image is an unvalidated app-serving candidate: do not treat its build, deployment, or alias-release path as established for this application. Validate application compatibility, release time, and cold/warm request latency before selecting it for the prototype. Use ECS Express Mode with ALB + AWS WAF as the app-serving fallback if Lambda compatibility, release requirements, or measured runtime behavior are unsuitable.

#### Option D: Lambda with API Gateway

API Gateway can provide a clearer API front door, authorizers, and explicit API policy than Function URL/OAC authentication. It retains Lambda cold-start, unvalidated container-image packaging, secret-bootstrap, and connection concerns while adding a gateway service and request charges. Under this candidate design, NestJS would still serve static files from the same image; there is no separate static origin or release. Validate the image and release path before selecting this option.

HTTP API and REST API have different features, quotas, and WAF integration; select explicitly rather than assuming interchangeable support. If CloudFront enforces geography, the gateway's own public endpoint must not offer a bypass. Evaluate gateway resource/access controls and origin verification before selection.

**Disposition:** prefer over Function URLs when API authentication or gateway features justify it, not as the simplest deployment of the existing container.

#### Options E–F: Managed hosts and a VM

**Render/Railway or similar hosts** may offer the fastest initial deployment and useful previews. Their drawbacks are a second platform control plane, plan-dependent geographic/network restrictions, and potential public-origin bypass when an external proxy applies geography. Select only after confirming Singapore hosting, recovery, exportability, and ingress enforcement.

**Lightsail/EC2** provides a familiar server and SQL tooling access but transfers patching, TLS/reverse-proxy operations, safe deploys, and recovery to the team. It is not recommended for an immediately onboardable service when reducing platform work is a primary objective. Co-locating PostgreSQL with the app worsens this tradeoff.

### Decision 2: PostgreSQL

“RDS Serverless v2” is interpreted here as **Amazon Aurora PostgreSQL-Compatible Serverless v2**, not provisioned RDS for PostgreSQL.

| Alternative | Troubleshooting access | Idle/cost behavior | Recovery and test environments | Main tradeoff |
| --- | --- | --- | --- | --- |
| Neon | Hosted SQL tools and direct TLS endpoint | Compute can suspend; storage/plan charges remain | Branching and plan-dependent restore | Easiest DB-only prototype workflow; external-vendor/security approval |
| Supabase | Dashboard SQL editor; direct/pooled endpoints | Paid commitment/compute floor; free pause is not a reliability strategy | Plan-dependent backups, PITR, and branching | Useful bundled services versus overlap with existing backend |
| Aurora Serverless v2 | Private DB via SSM tunnel | ACUs, storage/I/O/backup; eligible versions can auto-pause | AWS backups/PITR and cloning | AWS-native control with more network/access work |
| Provisioned RDS PostgreSQL | Private DB via SSM tunnel | Instance/storage floor; manual stop is not idle scaling | Automated backups/PITR; snapshots/restores | Predictable conventional PostgreSQL versus fixed capacity |
| Aurora provisioned | Same private access pattern | Instance and Aurora storage/I/O floor | Aurora backup/cloning features | Production-oriented capacity unnecessary without measured need |
| Self-managed PostgreSQL | Direct access under team control | Small VM may be inexpensive | Team owns backups, restore, patching, HA | Operational burden inconsistent with rapid product iteration |

#### Option A: Neon PostgreSQL

**Pros**

- Fast database provisioning and convenient SQL troubleshooting without deploying an access host.
- PostgreSQL compatibility, pooled application endpoints, and direct migration access.
- Branching supports migration rehearsal and isolated development.
- Compute suspension can reduce idle costs when the application's actual traffic allows it.

**Cons**

- External vendor, cross-service networking, and plan-dependent access restrictions/recovery.
- Suspend/resume latency may affect the first user request; continuous session/cache/health traffic may eliminate suspension savings.
- A pooled endpoint does not remove database capacity limits or guarantee compatibility with every session/cache query pattern.
- Private connectivity and stable-IP allowlisting may change the required plan and AWS egress architecture.

**Recommendation conditions:** choose a Singapore region after verifying current availability and residency terms, and a plan with acceptable backups/restore retention and enforceable access controls. Do not select a free plan solely to avoid initial spend. If those conditions cannot be met, use the AWS fallback.

#### Option B: Supabase PostgreSQL

**Pros**

- Convenient dashboard, SQL tools, managed PostgreSQL, and connection pooling.
- Attractive if the product also needs Supabase Auth, Storage, or Realtime.
- Singapore-region hosting and branching/recovery features are candidates to verify for the selected plan.

**Cons**

- This repository already implements backend APIs and sessions; adopting platform features could create duplicate auth or application ownership.
- Plan/compute commitments and backup/PITR/network entitlements need a full estimate.
- Direct connectivity can depend on IPv4/IPv6 availability and plan options; distinguish migration connections from pooled runtime connections.
- Free-project pausing is not an acceptable substitute for a dependable onboarded-user environment.

**Disposition:** prefer to Neon when bundled platform features are intentional product requirements, not merely because a dashboard is convenient.

#### Option C: Aurora Serverless v2

**Pros**

- Data-plane infrastructure and IAM operations remain inside AWS.
- Private VPC database access, managed backup/PITR, and elastic compute capacity.
- A natural choice when AWS-native security or organizational requirements outweigh external-provider convenience.

**Cons**

- Provisioning includes VPC placement, security groups, access tooling, and potentially proxy/egress services.
- Minimum-zero/auto-pause support depends on engine version and configuration. Resume adds latency; active sessions and features can prevent pausing.
- Validate the combined connection budget across application, session, and cache pools so scaling does not exhaust database connections.
- SQL troubleshooting is straightforward only after provisioning and documenting the access path.

**Access design:** private cluster, SSM-managed access host, no inbound SSH, and Session Manager port forwarding to the remote DB endpoint. The host needs SSM connectivity through endpoints or appropriate egress. Developers use TLS and named read-only DB identities; reserve time-limited elevated access for repairs. Do not expose PostgreSQL to `0.0.0.0/0` to simplify troubleshooting.

**Disposition:** AWS-native fallback. Omit RDS Proxy because it prevents Aurora from scaling to zero; this is a configuration choice, not a drawback of the selected approach. Use bounded client-side pools, connection reuse, and capped Lambda concurrency if Lambda is selected. Verify idle connection behavior and eligible engine/configuration settings for auto-pause. Choose an always-on minimum only if predictable first-request latency matters more than suspension.

#### Option D: Provisioned RDS PostgreSQL

A small provisioned instance may be simpler and more predictably priced than Aurora for a steady, small workload. It supports the same private SSM troubleshooting approach and managed backup workflow. Configure storage headroom and decide whether Single-AZ risk is acceptable; Multi-AZ adds cost and resilience.

It does not auto-scale to zero like a request-based service. Manual stopping is time-limited and unsuitable for a continuously onboardable app. Snapshot restores are slower and less convenient than branch-based development.

**Disposition:** additional alternative if later measurements justify fixed capacity; Aurora Serverless v2 remains the selected database fallback. Compare total costs without assuming serverless is automatically cheapest.

#### Options E–F: Aurora provisioned and self-managed PostgreSQL

Provisioned Aurora is worth revisiting for sustained demand or specific Aurora features, but has no clear prototype advantage over the alternatives today. Self-managed PostgreSQL saves service charges by transferring durability, patching, monitoring, and recovery work to the team; it is not recommended for storing immediately onboarded users' data.

## Proposed Solution

### A. Serving the application

#### Decision and rationale

Treat **hosting Option C: Lambda Web Adapter with CloudFront and a stable alias-backed Function URL** as an unvalidated candidate, not as an adopted serving architecture.

The candidate would use a Lambda container image containing NestJS and the React SPA, with a runtime-secret wrapper. Its application compatibility, image build and deployment path, release time, and fit with the four-minute push-to-usable-release target have not been validated. Measure these before selecting Lambda; do not assume that image-based releases meet the target.

If validation demonstrates that Lambda is suitable, it may offer request-based compute and less application-serving infrastructure, in exchange for packaging/initialization work, cold-start latency, and explicit concurrency/connection management. Use **ECS Express Mode with ALB + AWS WAF** as the app-serving fallback if Lambda is unsuitable or fails validation. Conventional ECS remains an additional customization alternative, not the selected fallback.

#### Request path and ingress protection

**Candidate Lambda request path:** Singapore client → CloudFront with AWS WAF → IAM-authenticated Function URL for the serving alias → Lambda Web Adapter/NestJS → Neon PostgreSQL over TLS. Validate this path before adoption.

If the Lambda container-image candidate is selected after validation, NestJS would serve the API, static assets, and SPA deep links from the image; there would be no S3 static-content origin. Configure `/api` and `/api/*` as uncached, forwarding required cookies, query strings, and application auth. Disable HTML caching initially. Cache only suitable fingerprinted assets immutably; never cache personalized responses or session cookies. Preserve missing-asset/API errors rather than broadly returning HTML.

Use CloudFront OAC and Lambda resource permissions scoped to the distribution so the Function URL cannot bypass the protected edge. Verify actual auth flows, signed mutation request bodies, forwarded host/protocol handling, and secure cookies as described in Option C. Use a stable hostname with ACM TLS.

Attach a CloudFront-scoped web ACL with:

- A block rule for client IPs not geolocated to Singapore.
- Managed common-threat rules, initially tuned in count mode where necessary before enforcement.
- Rate-based protection tuned to onboarding/login traffic, with application-level abuse controls.

Use the viewer source IP for geo/rate decisions, not arbitrary client-supplied forwarding headers. CloudFront geo filtering does not establish Singapore-only edge processing.

#### Network and cost posture

Start without Lambda VPC attachment when the approved Neon connectivity/access controls permit it. This avoids provisioning a workload VPC and NAT merely to reach an external database. Do not assume non-VPC Lambda provides stable outbound IPs: fixed-IP restrictions or private connectivity require a deliberate, priced network design.

The Aurora Serverless v2 fallback requires Lambda VPC connectivity to its private database and SSM access for troubleshooting. Account for secrets retrieval and other outbound dependencies through endpoints or suitable egress.

Record a complete monthly estimate covering Lambda, CloudFront, WAF, database plan/compute/storage/recovery, logs, secrets, DNS, artifact storage, transfer, and any VPC endpoints/NAT/access host. No current vendor dollar prices are asserted in this RFC.

#### Provisioning versus application-release ownership

Pulumi owns infrastructure and runtime configuration: IAM, any required Lambda image configuration, secret references, monitoring, CloudFront/WAF, the Function URL, and initial function/alias setup. If the Lambda container-image candidate is validated and selected, a maintained CI release script using the AWS CLI or SDK would own image publication, application updates, immutable version publication, serving-alias promotion, and rollback. Validate this division of ownership before adopting the candidate.

Pulumi itself does not cause CloudFront propagation: changing distribution configuration does. An unchanged distribution need not be updated during `pulumi up`. Nevertheless, routine releases use the narrowly scoped CI path rather than full infrastructure reconciliation to minimize work and latency.

Explicitly delegate the function's deployed code and the alias's target version to the release process. Define appropriate ignored fields and state/refresh handling so a later Pulumi apply cannot revert a release; `ignoreChanges` alone is not a complete ownership strategy. Test this interaction, including configuration changes and resource replacement. Preserve the preceding RFC's explicit Pulumi commands and S3 state locking; cloud provisioning stays outside normal Turborepo builds.

#### Release pipeline

1. On push, run required quality checks and build React and NestJS. For the unvalidated Lambda candidate, build a Lambda-compatible container image containing the frontend, backend, required dependencies/artifacts, and startup wrapper; publish and identify the image by commit. Validate this build and deployment path before adopting it. Cache dependencies/build work and measure runner scheduling and checks as part of the four-minute target.
2. Serialize releases to the shared prototype. Superseded unstarted jobs may be cancelled; never cancel a job mid-migration or promotion.
3. Rehearse migrations on a disposable database branch when feasible. Run versioned migrations once with a direct connection and scoped migration identity—not on each Lambda startup. Resolve separate migration/runtime configuration during implementation. Substantial migrations use a separate release window outside the four-minute target.
4. Use expand/contract schemas compatible with old/new versions and already-loaded browsers. Approve destructive contraction in a later release.
5. For the Lambda container-image candidate, publish the image, wait for AWS update readiness, publish an immutable version, and shift the stable serving alias. Validate this release sequence before adopting it. Record the previous version before promotion. Do not require candidate navigation or a pre-promotion smoke test: developers access the main endpoint after cutover.
6. Verify public availability and perform post-release checks at the main endpoint: SPA routes/assets, API, onboarding/login, sessions, and a DB round trip. These do not gate the alias shift; manual functional navigation follows promotion. If the release fails, move the alias back to the previous compatible version.
7. Keep the alias-backed origin URL and CloudFront configuration unchanged. HTML is uncached; fingerprinted assets remain immutable. Retain prior assets for the browser compatibility window rather than relying on cache presence. No required distribution update or invalidation sits on the ordinary release path.
8. Retain known-good versions and release metadata. Never automatically reverse migrations or reset user data on application rollback. Prefer a forward schema fix; use the tested database restore procedure only for a data incident.

Benchmark push-to-public-availability separately from subsequent manual acceptance. Shifting an alias does not prewarm every execution environment; measure first-request latency and bound concurrency/connection pools before onboarding.

### B. Database

#### Decision and rationale

Adopt **database Option A: Neon PostgreSQL in Singapore, subject to provider/security approval**.

It is the best fit for the prototype because convenient SQL access and database branching reduce troubleshooting and migration-rehearsal overhead. Developers can support onboarded users without first building a private AWS database access path. This decision is independent of whether the application uses Express Mode, conventional ECS, or Lambda.

Accept an external database dependency and plan-dependent security/recovery features in exchange for straightforward support operations and less database infrastructure. Verify Singapore availability, access controls, and recovery terms before onboarding. Use **database Option C: Aurora PostgreSQL-Compatible Serverless v2 with private networking and SSM troubleshooting** as the fallback if Neon cannot meet approved requirements. Omit RDS Proxy to preserve eligible auto-pause behavior; bound application pools/concurrency and validate resume latency. Provisioned RDS is an additional alternative, not the selected fallback. Price the database together with application egress and the rest of the stack.

#### Database access, pooling, and recovery

- Give developers named read-only identities and the approved console/direct TLS connection procedure. Provide time-limited elevated access with an audit trail for repairs; do not distribute the application's owner password.
- Restrict provider access using supported plan controls. Confirm where administrative access logs are recorded and how access is revoked.
- Use a pooled runtime endpoint where compatible and a direct endpoint for migrations/troubleshooting. Test Prisma's `pg` adapter, the session store, and `KeyvPostgres` against the selected pooling mode, not just a sample query.
- Bound the total connection budget across application replicas, Prisma pools, cache/session pools, migration jobs, and developer sessions. Reuse connections and monitor queueing/timeouts.
- Choose explicit backup retention and proposed initial RPO/RTO with the team before onboarding. A plan's marketing claims are not an agreed recovery objective.
- Restore into a separate database/branch and validate application access before switching traffic. Document who can authorize the switch and how secrets/config are updated.
- Redact or synthesize user data in development branches. Branching is a testing tool, not a substitute for backups or permission controls.
- Once user onboarding begins, development `db:sync`/`db:reset` workflows are prohibited against this environment.

### Secrets and observability

Store runtime secrets in AWS Secrets Manager or an approved equivalent. If the Lambda container-image candidate is selected, the Node startup wrapper retrieves secrets and sets `process.env` before loading NestJS, as described in Option C; validate that initialization sequence. Define refresh/rotation behavior for warm environments. Use Pulumi secret references/config appropriately and ensure infrastructure outputs, images, and CI logs do not expose plaintext values. Runtime IAM should grant access only to necessary secrets.

Emit structured logs with request identifiers and release digests; redact passwords, session tokens, and sensitive user data. Set log retention and alerts for elevated errors, failed deployment health, DB connection exhaustion, and storage/capacity pressure. Track rollout duration, first-request latency after DB idle, query latency, and restore drill results.

### Validation before implementation commitment

- Treat Lambda container-image serving as unvalidated until confirmed with the real application. Test the image build and deployment path, NestJS startup and dependencies, startup secrets, static paths, SPA deep links, sessions/auth, Function URL/OAC mutation handling, pooling, and any persistent-connection/background-work requirements. If Lambda is unsuitable or fails the release/runtime requirements, use ECS Express Mode with ALB + AWS WAF as the fallback.
- Exercise 20 representative releases with cached and uncached builds. Measure push-to-public-availability including scheduling/checks/build/upload/publication/alias shift, plus cold/warm latency and DB-resume latency. Record the ordinary release envelope separately from provisioning and substantial migrations.
- Test broken startup/migration cases and post-promotion validation/alias rollback at the main endpoint. Do not introduce a separate candidate-navigation gate.
- Verify CloudFront/WAF protection and direct Function URL rejection, uncached HTML, safe asset caching, and no routine distribution change/invalidation requirement.
- Apply Pulumi after a CI release and verify it preserves release-managed code and alias targets; exercise runtime configuration changes and document replacement handling.
- Verify Neon Singapore availability, access/recovery entitlements, migration/pool compatibility, and a successful restore drill. Validate private connectivity, SSM access, connection limits, and auto-pause/resume settings if the Aurora fallback is selected.
- Produce and approve the complete regional cost estimate and recovery objectives.

### Open questions for review

1. What monthly budget and initial user/concurrency envelope should govern sizing?
2. Is external PostgreSQL approved, and does Singapore mean IP-geolocation filtering or a stricter processing/residency requirement?
3. What RPO, RTO, and acceptable first-request latency apply after users onboard?
4. Which payloads, auth schemes, background jobs, persistent connections, image-build/deployment cases, and release scenarios must the unvalidated Lambda container-image compatibility trial cover before deciding whether to adopt Lambda or use ECS Express Mode?
5. What measured build/check duration and CI runner scheduling allow the four-minute release target, including uncached runs?
6. Which domain and auth callback/passkey origins will be used?

### References and verification status

Repository findings came from the baseline RFC and inspected application/build configuration. The team's review confirms that WAF can be attached to Express Mode's ALB. **Live vendor documentation was not retrieved during this draft's research.** The following official references remain verification targets for current availability, pricing, plan entitlements, and detailed configuration; the confirmed WAF attachment is not an unresolved selection question.

- [ECS developer guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html) — locate the current Express Mode guide and supported configuration.
- [ECS deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html).
- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter).
- [Lambda Function URL access through CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html).
- [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html).
- [AWS Parameters and Secrets Lambda Extension](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html).
- [CloudFront geographic restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/georestrictions.html) and [AWS WAF geo match](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-geo-match.html).
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html) and [auto-pause](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html).
- [SSM port forwarding](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html).
- Neon: [regions](https://neon.com/docs/introduction/regions), [pooling](https://neon.com/docs/connect/connection-pooling), [branching](https://neon.com/docs/introduction/branching), [IP restrictions](https://neon.com/docs/manage/ip-allow), and [pricing](https://neon.com/pricing).
- Supabase: [regions](https://supabase.com/docs/guides/platform/regions), [connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [network restrictions](https://supabase.com/docs/guides/platform/network-restrictions), [backups](https://supabase.com/docs/guides/platform/backups), and [pricing](https://supabase.com/pricing).
- [Aurora pricing](https://aws.amazon.com/rds/aurora/pricing/) and [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/).
