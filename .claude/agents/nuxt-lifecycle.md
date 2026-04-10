---
name: nuxt-lifecycle-reference
description: 'Explains the server and client lifecycle of Nuxt applications, including plugin execution order, middleware running, page rendering, and Vue component lifecycle hooks. Use when building Nuxt applications, understanding when code executes on server vs client, debugging initialization issues, or determining where to place side effects.'
model: sonnet
color: green
tools: 'Bash, CronCreate, CronDelete, CronList, Edit, EnterWorktree, ExitWorktree, Glob, Grep, ListMcpResourcesTool, Monitor, NotebookEdit, Read, ReadMcpResourceTool, RemoteTrigger, Skill, TaskCreate, TaskGet, TaskList, TaskUpdate, ToolSearch, WebFetch, WebSearch, Write'
---

# Nuxt Lifecycle

> Understanding the lifecycle of Nuxt applications can help you gain deeper insights into how the framework operates, especially for both server-side and client-side rendering.

The goal of this chapter is to provide a high-level overview of the different parts of the framework, their execution order, and how they work together.

## Server lifecycle

On the server, the following steps are executed for every initial request to your application:

### Server plugins (executed once)

Nuxt is powered by [Nitro](https://nitro.build/), a modern server engine.

When Nitro starts, it initializes and executes the plugins under [`/server/plugins`](https://nuxt.com/docs/4.x/directory-structure/server#server-plugins). These plugins can:

- Capture and handle application-wide errors
- Register hooks that execute when Nitro shuts down
- Register hooks for request lifecycle events, such as modifying responses

**Note:** Nitro plugins are executed only once when the server starts. In a serverless environment, the server boots on each incoming request, and so do the Nitro plugins. However, they are not awaited.

[Server plugins documentation](https://nuxt.com/docs/4.x/directory-structure/server#server-plugins)

### Server middleware

After initializing the Nitro server, middleware under `server/middleware/` is executed for every request. Middleware can be used for tasks such as authentication, logging, or request transformation.

**Warning:** Returning a value from middleware will terminate the request and send the returned value as the response. This behavior should generally be avoided to ensure proper request handling.

[Server middleware documentation](https://nuxt.com/docs/4.x/directory-structure/server#server-middleware)

### App plugins

The Vue and Nuxt instances are created first. Afterward, Nuxt executes its app plugins. This includes:

- Built-in plugins, such as Vue Router and `unhead`
- Custom plugins located in `app/plugins/`, including those without a suffix (e.g., `myPlugin.ts`) and those with the `.server` suffix (e.g., `myServerPlugin.server.ts`)

Plugins execute in a specific order and may have dependencies on one another. For more details, including execution order and parallelism, refer to the [Plugins documentation](https://nuxt.com/docs/4.x/directory-structure/app/plugins).

After this step, Nuxt calls the [`app:created`](https://nuxt.com/docs/4.x/api/advanced/hooks#app-hooks-runtime) hook, which can be used to execute additional logic.

[App plugins documentation](https://nuxt.com/docs/4.x/directory-structure/app/plugins)

### Route validation

After initializing plugins and before executing middleware, Nuxt calls the `validate` method if defined in the `definePageMeta` function. The `validate` method, which can be synchronous or asynchronous, is often used to validate dynamic route parameters.

- The `validate` function should return `true` if the parameters are valid
- If validation fails, it should return `false` or an object containing a `status` and/or `statusText` to terminate the request

[Route validation documentation](https://nuxt.com/docs/4.x/getting-started/routing#route-validation)

### App middleware

Middleware allows you to run code before navigating to a particular route. It is often used for tasks such as authentication, redirection, or logging.

In Nuxt, there are three types of middleware:

- **Global route middleware**
- **Named route middleware**
- **Anonymous (inline) route middleware**

Nuxt executes all global middleware on the initial page load (both on server and client) and then again before any client-side navigation. Named and anonymous middleware are executed only on the routes specified in the middleware property of the page meta defined in the corresponding page components.

Any redirection on the server will result in a `Location:` header being sent to the browser; the browser then makes a fresh request to this new location. All application state will be reset when this happens, unless persisted in a cookie.

[App middleware documentation](https://nuxt.com/docs/4.x/directory-structure/app/middleware)

### Page and components

Nuxt renders the page and its components and fetches any required data with `useFetch` and `useAsyncData` during this step. Since there are no dynamic updates and no DOM operations occur on the server, Vue lifecycle hooks such as `onBeforeMount`, `onMounted`, and subsequent hooks are **NOT** executed during SSR.

By default, Vue pauses dependency tracking during SSR for better performance.

**Key concept:** There is no reactivity on the server side because Vue SSR renders the app top-down as static HTML, making it impossible to go back and modify content that has already been rendered.

### Important: Side effects in `<script setup>`

Avoid code that produces side effects that need cleanup in root scope of `<script setup>`. An example of problematic side effects is setting up timers with `setInterval`. In client-side only code you may setup a timer and then tear it down in `onBeforeUnmount` or `onUnmounted`. However, because the unmount hooks will never be called during SSR, the timers will stay around forever. To avoid this, move your side-effect code into `onMounted` instead.

For more information, watch this [video from Daniel Roe explaining Server Rendering and Global State](https://youtu.be/dZSNW07sO-A).

### HTML output

After all required data is fetched and the components are rendered, Nuxt combines the rendered components with settings from `unhead` to generate a complete HTML document. This HTML, along with the associated data, is then sent back to the client to complete the SSR process.

After rendering the Vue application to HTML, Nuxt calls the [`app:rendered`](https://nuxt.com/docs/4.x/api/advanced/hooks#app-hooks-runtime) hook.

Before finalizing and sending the HTML, Nitro calls the [`render:html`](https://nuxt.com/docs/4.x/api/advanced/hooks#nitro-app-hooks-runtime-server-side) hook. This hook allows you to manipulate the generated HTML, such as injecting additional scripts or modifying meta tags.

## Client lifecycle

This part of the lifecycle is fully executed in the browser, no matter which Nuxt mode you've chosen.

### App plugins

This step is similar to the server-side execution and includes both built-in and custom plugins.

Custom plugins in `app/plugins/`, such as those without a suffix (e.g., `myPlugin.ts`) and with the `.client` suffix (e.g., `myClientPlugin.client.ts`), are executed on the client side.

After this step, Nuxt calls the [`app:created`](https://nuxt.com/docs/4.x/api/advanced/hooks#app-hooks-runtime) hook, which can be used to execute additional logic.

[App plugins documentation](https://nuxt.com/docs/4.x/directory-structure/app/plugins)

### Route validation

This step is the same as the server-side execution and includes the `validate` method if defined in the `definePageMeta` function.

### App middleware

Nuxt middleware runs on both the server and the client. If you want certain code to run in specific environments, consider splitting it by using `import.meta.client` for the client and `import.meta.server` for the server.

[Middleware documentation](https://nuxt.com/docs/4.x/directory-structure/app/middleware#when-middleware-runs)

### Mount Vue app and hydrate

Calling `app.mount('#__nuxt')` mounts the Vue application to the DOM. If the application uses SSR or SSG mode, Vue performs a hydration step to make the client-side application interactive. During hydration, Vue recreates the application (excluding [Server Components](https://nuxt.com/docs/4.x/directory-structure/app/components#server-components)), matches each component to its corresponding DOM nodes, and attaches DOM event listeners.

To ensure proper hydration, it's important to maintain consistency between the data on the server and the client. For API requests, it is recommended to use `useAsyncData`, `useFetch`, or other SSR-friendly composables. These methods ensure that the data fetched on the server side is reused during hydration, avoiding repeated requests. Any new requests should only be triggered after hydration, preventing hydration errors.

Before mounting the Vue application, Nuxt calls the [`app:beforeMount`](https://nuxt.com/docs/4.x/api/advanced/hooks#app-hooks-runtime) hook.

After mounting the Vue application, Nuxt calls the [`app:mounted`](https://nuxt.com/docs/4.x/api/advanced/hooks#app-hooks-runtime) hook.

### Vue lifecycle

Unlike on the server, the browser executes the full [Vue lifecycle](https://vuejs.org/guide/essentials/lifecycle).
