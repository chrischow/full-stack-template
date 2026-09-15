# Guidelines for Creating an API Endpoint

## 1. Set Up the Schema
Decide on the response shape. This must be a Zod schema. Look in `packages/api-contract/src/schemas`:

- If the schema already exists and is fit for purpose, use that in the subsequent steps.
- Else if only small modifications are required to an existing schema S, modify S, and make the necessary changes in the endpoints that use S.
- Otherwise, you will need to create a new schema. Refer to the [instructions for creating Zod schemas](../api-contract/creating-zod-schemas.md).


## 2. Set Up the Route

Create a route under a contract:

- If the route you intend to create naturally belongs to an existing contract file, add the route to the contract in that file.
- Otherwise, create a new contract file, set up an array of tags, and add the barrel export to `packages/api-contract/src/contracts/index.ts`.

When adding a new key to the contract:

- If the route naturally belongs to an existing key, add the route as a nested key there.
- Else if the route is at the same logical level as the other existing keys, add the route directly as an adjacent key.
- Otherwise, if the new key forms a logically coherent group with one or more existing keys, create a new key for the route group, create a nested key for the new route, and nest any related existing keys under that new key for the route group.

When adding the route as a key:

- Use `oc.route({})`, and add the common tags specified in that contract file.
- If the route only involves one type of parameter (e.g. route OR query OR body), use the compact input structure mode, which is the default configuration. In other words, there is no need to add a `inputStructure` key. However, if the route involves more than one type of parameter, use the `detailed` input structure mode by setting `inputStructure: 'detailed'`.
- If the route has inputs, you must specify a Zod schema as the input for the route in a chained `.input(<input_schema>)` call.
- If the route has outputs, you must specify a Zod schema as the output for the route in a chained `.output(<output_schema>)` call.

## 3. Create a Controller Method

Create a controller method:

- If a module for the resource in question already exists:
  - If a NestJS Controller for the resource in question already exists, add the controller method to that existing controller.
  - Otherwise, create a NestJS Controller file with `nest g controller <resoure_name>`, and add the new controller method to that file.
- Otherwise, create a NestJS Module and Controller with `nest g module <resource_name>` and `nest g controller <resource_name>`. Then, add the new controller method to that file.

When writing the controller method:

- The controller method should have the `@Implement(<route-in-contract>)` decorator to implement the route defined in the contract.
- The method should directly return the result of `implement(<route-in-contract>).handler(<async-callback-to-call-service-method>)`.
- The callback in the handler should grab context and inputs as required, and return the outputs specified in the route.
- The controller method name should be named with a prefix (e.g. `list`, `get`, `update`, `delete`) that describes the data being returned. For example:
  - `listAllPosts`: To get a list of all posts in a collection endpoint.
  - `listUserPosts`: To get a list of all posts by a specific user in a collection endpoint.
  - `getPost`: To get details of a specific post.
  - `updatePost` / `editPost`: To update a specific post.
  - `deletePost` / `removePost`: To delete a specific post.

An example of a controller method:

```ts
@Implement(contract.posts.listByUser)
listUserPosts() {
  return implement(contract.posts.listByUser).handler(async ({ context, input }) => {
    const { user } = context.request.session
    
    return await this.postsService.listUserPosts({ user })
  })
}
```

## 4. Create a Service Method

Create the service method:

- If a service for the resource in question already exists, add the service method to that existing service.
- Otherwise, create a NestJS Service file with `nest g service <resource_name>`

When writing the service method:

- The service method name should have the same name as the controller.
- The service method must specify the return type, which should be the type inferred from the Zod schema specified as the output of the route that this service method supports.
- The service method must perform output validation by returning the data parsed using the output schema.

Building on the previous example of a controller method, this is an example of a service method:

```ts
export class PostsService() {
  async listUserPosts(): Promise<UserPostsList> {
    // Business logic to retrieve posts and process data

    return UserPostsListSchema.parse(<data-processed-in-the-service>)
  }
}
```
