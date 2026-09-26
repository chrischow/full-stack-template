# Guidelines for Creating NestJS Backend Components

When creating NestJS components like modules, services, and controllers (non-exhaustive), **ALWAYS** use the `nest_generate` tool.

If you have to create multiple NestJS components, you **MUST** respect the following order:

1. `module`
2. `service`
3. `provider`
4. `gateway`
5. `pipe`
6. `filter`
7. `guard`
8. `interceptor`
9. `controller`
10. `decorator`
11. `middleware`

For example, if required to create a `service`, `guard`, and `module`, do the following:

1. Call `nest_generate` with `module` and `<resource name>`
2. Call `nest_generate` with `service` and `<resource name>`
3. Call `nest_generate` with `guard` and `<resource name>`
