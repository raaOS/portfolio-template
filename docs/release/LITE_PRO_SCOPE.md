# Lite / Pro Product Scope

Both plans are self-service. The Master admin controls site creation, plan, quota add-ons, billing metadata, client access, suspension, and support overrides.

## Lite

Recommended default for smaller portfolio sites.

| Area | Lite |
| --- | --- |
| Client dashboard | Enabled |
| Client password reset | Enabled when email provider is configured |
| Project CRUD | Enabled |
| Project limit | `PLAN_LITE_PROJECT_LIMIT` |
| Storage limit | `PLAN_LITE_STORAGE_MB` |
| Media per project | `PLAN_LITE_MEDIA_PER_PROJECT` |
| Custom quota add-on | Optional per site through Master Dashboard |
| Gallery image upload | Enabled within quota |
| Gallery video upload | Optional within quota |
| AI generation | Off by default |
| External notifications | Off by default |
| Custom domain | Off by default |
| Analytics | Off by default |

Lite should stay simple: portfolio CRUD, basic media, and predictable quota.

## Pro

Recommended for heavier portfolio sites or managed clients.

| Area | Pro |
| --- | --- |
| Client dashboard | Enabled |
| Client password reset | Enabled when email provider is configured |
| Project CRUD | Enabled |
| Project limit | `PLAN_PRO_PROJECT_LIMIT` |
| Storage limit | `PLAN_PRO_STORAGE_MB` |
| Media per project | `PLAN_PRO_MEDIA_PER_PROJECT` |
| Custom quota add-on | Optional per site through Master Dashboard |
| Gallery image upload | Enabled within quota |
| Gallery video upload | Enabled within quota |
| AI generation | Optional through `FEATURE_AI` |
| External notifications | Optional through `FEATURE_NOTIFICATIONS` |
| Custom domain | Optional through `FEATURE_CUSTOM_DOMAIN` |
| Analytics | Optional through `FEATURE_ANALYTICS` |

Pro can include higher quota and optional platform-owned integrations, but integrations must remain generic and `site_id` scoped.

## Master Dashboard Responsibilities

Master admin owns:

- Create site.
- Change plan.
- Set plan defaults through env/product config.
- Set per-site custom quota add-ons for upsell or support.
- Create/reset client access.
- Support client self-service password reset delivery.
- Suspend/activate site.
- Safe hard delete with slug confirmation.
- Billing metadata status.
- Support override when a client needs help.

Master admin should not be required to manually fill every client project. Clients edit their own content through the self-service dashboard.

## Downgrade Rule

Default plan quota comes from env, but each site can have custom quota add-ons stored in D1 through `site_quota_overrides`. Effective quota is:

- Default plan quota when no override is set.
- The higher custom value when a custom value is above the default plan quota.
- Lower custom values are treated as reset-to-default, not as a way to reduce a plan below its default.

Downgrade from Pro to Lite, reset of custom quota, or custom quota reduction must be blocked when current usage exceeds the next effective quota:

- Project count above Lite project limit.
- Storage usage above Lite storage limit.
- Media per project above Lite media limit.

The API protects project count, storage, and max media per existing project during plan/custom quota updates. Project media limits are also enforced during create/update flows.

## Feature Flag Rules

- Keep default Lite conservative.
- Do not enable AI or notification providers without product-owned credentials.
- Never use personal keys as product defaults.
- Every optional integration must be scoped by `site_id` and plan.
