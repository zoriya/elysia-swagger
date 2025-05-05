// src/index.ts
import { Elysia } from "elysia";

// src/swagger/index.ts
function isSchemaObject(schema) {
  return "type" in schema || "properties" in schema || "items" in schema;
}
function isDateTimeProperty(key, schema) {
  return (key === "createdAt" || key === "updatedAt") && "anyOf" in schema && Array.isArray(schema.anyOf);
}
function transformDateProperties(schema) {
  if (!isSchemaObject(schema) || typeof schema !== "object" || schema === null) {
    return schema;
  }
  const newSchema = { ...schema };
  Object.entries(newSchema).forEach(([key, value]) => {
    if (isSchemaObject(value)) {
      if (isDateTimeProperty(key, value)) {
        const dateTimeFormat = value.anyOf?.find(
          (item) => isSchemaObject(item) && item.format === "date-time"
        );
        if (dateTimeFormat) {
          const dateTimeSchema = {
            type: "string",
            format: "date-time",
            default: dateTimeFormat.default
          };
          newSchema[key] = dateTimeSchema;
        }
      } else {
        newSchema[key] = transformDateProperties(value);
      }
    }
  });
  return newSchema;
}
var SwaggerUIRender = (info, version, theme, stringifiedSwaggerOptions, autoDarkMode) => {
  const swaggerOptions = JSON.parse(stringifiedSwaggerOptions);
  if (swaggerOptions.components && swaggerOptions.components.schemas) {
    swaggerOptions.components.schemas = Object.fromEntries(
      Object.entries(swaggerOptions.components.schemas).map(([key, schema]) => [
        key,
        transformDateProperties(schema)
      ])
    );
  }
  const transformedStringifiedSwaggerOptions = JSON.stringify(swaggerOptions);
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${info.title}</title>
    <meta
        name="description"
        content="${info.description}"
    />
    <meta
        name="og:description"
        content="${info.description}"
    />
    ${autoDarkMode && typeof theme === "string" ? `
    <style>
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #222;
                color: #faf9a;
            }
            .swagger-ui {
                filter: invert(92%) hue-rotate(180deg);
            }

            .swagger-ui .microlight {
                filter: invert(100%) hue-rotate(180deg);
            }
        }
    </style>` : ""}
    ${typeof theme === "string" ? `<link rel="stylesheet" href="${theme}" />` : `<link rel="stylesheet" media="(prefers-color-scheme: light)" href="${theme.light}" />
<link rel="stylesheet" media="(prefers-color-scheme: dark)" href="${theme.dark}" />`}
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${version}/swagger-ui-bundle.js" crossorigin></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle(${transformedStringifiedSwaggerOptions});
        };
    </script>
</body>
</html>`;
};

// src/scalar/index.ts
import { elysiajsTheme } from "@scalar/themes";
var ScalarRender = (info, version, config, cdn) => `<!doctype html>
<html>
  <head>
    <title>${info.title}</title>
    <meta
        name="description"
        content="${info.description}"
    />
    <meta
        name="og:description"
        content="${info.description}"
    />
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
      }
    </style>
    <style>
      ${config.customCss ?? elysiajsTheme}
    </style>
  </head>
  <body>
    <div id="app"></div>

    <script src="${cdn ? cdn : `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${version}/dist/browser/standalone.min.js`}" crossorigin></script>

    <script>
      Scalar.createApiReference('#app', ${JSON.stringify(config)})
    </script>
  </body>
</html>`;

// src/utils.ts
import { replaceSchemaType, t } from "elysia";

// node_modules/@sinclair/typebox/build/esm/type/symbols/symbols.mjs
var TransformKind = Symbol.for("TypeBox.Transform");
var ReadonlyKind = Symbol.for("TypeBox.Readonly");
var OptionalKind = Symbol.for("TypeBox.Optional");
var Hint = Symbol.for("TypeBox.Hint");
var Kind = Symbol.for("TypeBox.Kind");

// src/utils.ts
var toOpenAPIPath = (path) => path.split("/").map((x) => {
  if (x.startsWith(":")) {
    x = x.slice(1, x.length);
    if (x.endsWith("?")) x = x.slice(0, -1);
    x = `{${x}}`;
  }
  return x;
}).join("/");
var mapProperties = (name, schema, models) => {
  if (schema === void 0) return [];
  if (typeof schema === "string")
    if (schema in models) schema = models[schema];
    else throw new Error(`Can't find model ${schema}`);
  return Object.entries(schema?.properties ?? []).map(([key, value]) => {
    const {
      type: valueType = void 0,
      description,
      examples,
      ...schemaKeywords
    } = value;
    return {
      // @ts-ignore
      description,
      examples,
      schema: { type: valueType, ...schemaKeywords },
      in: name,
      name: key,
      // @ts-ignore
      required: schema.required?.includes(key) ?? false
    };
  });
};
var mapTypesResponse = (types, schema) => {
  if (typeof schema === "object" && ["void", "undefined", "null"].includes(schema.type))
    return;
  const responses = {};
  for (const type of types) {
    responses[type] = {
      schema: typeof schema === "string" ? {
        $ref: `#/components/schemas/${schema}`
      } : "$ref" in schema && Kind in schema && schema[Kind] === "Ref" ? {
        ...schema,
        $ref: `#/components/schemas/${schema.$ref}`
      } : replaceSchemaType(
        { ...schema },
        {
          from: t.Ref(""),
          // @ts-expect-error
          to: ({ $ref, ...options }) => {
            if (!$ref.startsWith(
              "#/components/schemas/"
            ))
              return t.Ref(
                `#/components/schemas/${$ref}`,
                options
              );
            return t.Ref($ref, options);
          }
        }
      )
    };
  }
  return responses;
};
var capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);
var generateOperationId = (method, paths) => {
  let operationId = method.toLowerCase();
  if (paths === "/") return operationId + "Index";
  for (const path of paths.split("/")) {
    if (path.charCodeAt(0) === 123) {
      operationId += "By" + capitalize(path.slice(1, -1));
    } else {
      operationId += capitalize(path);
    }
  }
  return operationId;
};
var cloneHook = (hook) => {
  if (!hook) return;
  if (typeof hook === "string") return hook;
  if (Array.isArray(hook)) return [...hook];
  return { ...hook };
};
var registerSchemaPath = ({
  schema,
  path,
  method,
  hook,
  models
}) => {
  hook = cloneHook(hook);
  if (hook.parse && !Array.isArray(hook.parse)) hook.parse = [hook.parse];
  let contentType = hook.parse?.map((x) => {
    switch (typeof x) {
      case "string":
        return x;
      case "object":
        if (x && typeof x?.fn !== "string")
          return;
        switch (x?.fn) {
          case "json":
          case "application/json":
            return "application/json";
          case "text":
          case "text/plain":
            return "text/plain";
          case "urlencoded":
          case "application/x-www-form-urlencoded":
            return "application/x-www-form-urlencoded";
          case "arrayBuffer":
          case "application/octet-stream":
            return "application/octet-stream";
          case "formdata":
          case "multipart/form-data":
            return "multipart/form-data";
        }
    }
  }).filter((x) => x !== void 0);
  if (!contentType || contentType.length === 0)
    contentType = ["application/json", "multipart/form-data", "text/plain"];
  path = toOpenAPIPath(path);
  const contentTypes = typeof contentType === "string" ? [contentType] : contentType ?? ["application/json"];
  const bodySchema = cloneHook(hook?.body);
  const paramsSchema = cloneHook(hook?.params);
  const headerSchema = cloneHook(hook?.headers);
  const querySchema = cloneHook(hook?.query);
  let responseSchema = cloneHook(hook?.response);
  if (typeof responseSchema === "object") {
    if (Kind in responseSchema) {
      const {
        type,
        properties,
        required,
        additionalProperties,
        patternProperties,
        $ref,
        ...rest
      } = responseSchema;
      responseSchema = {
        "200": {
          ...rest,
          description: rest.description,
          content: mapTypesResponse(
            contentTypes,
            type === "object" || type === "array" ? {
              type,
              properties,
              patternProperties,
              items: responseSchema.items,
              required
            } : responseSchema
          )
        }
      };
    } else {
      Object.entries(responseSchema).forEach(
        ([key, value]) => {
          if (typeof value === "string") {
            if (!models[value]) return;
            const {
              type,
              properties,
              required,
              additionalProperties: _1,
              patternProperties: _2,
              ...rest
            } = models[value];
            responseSchema[key] = {
              ...rest,
              description: rest.description,
              content: mapTypesResponse(contentTypes, value)
            };
          } else {
            const {
              type,
              properties,
              required,
              additionalProperties,
              patternProperties,
              ...rest
            } = value;
            responseSchema[key] = {
              ...rest,
              description: rest.description,
              content: mapTypesResponse(
                contentTypes,
                type === "object" || type === "array" ? {
                  type,
                  properties,
                  patternProperties,
                  items: value.items,
                  required
                } : value
              )
            };
          }
        }
      );
    }
  } else if (typeof responseSchema === "string") {
    if (!(responseSchema in models)) return;
    const {
      type,
      properties,
      required,
      $ref,
      additionalProperties: _1,
      patternProperties: _2,
      ...rest
    } = models[responseSchema];
    responseSchema = {
      // @ts-ignore
      "200": {
        ...rest,
        content: mapTypesResponse(contentTypes, responseSchema)
      }
    };
  }
  const parameters = [
    ...mapProperties("header", headerSchema, models),
    ...mapProperties("path", paramsSchema, models),
    ...mapProperties("query", querySchema, models)
  ];
  schema[path] = {
    ...schema[path] ? schema[path] : {},
    [method.toLowerCase()]: {
      ...headerSchema || paramsSchema || querySchema || bodySchema ? { parameters } : {},
      ...responseSchema ? {
        responses: responseSchema
      } : {},
      operationId: hook?.detail?.operationId ?? generateOperationId(method, path),
      ...hook?.detail,
      ...bodySchema ? {
        requestBody: {
          required: true,
          content: mapTypesResponse(
            contentTypes,
            typeof bodySchema === "string" ? {
              $ref: `#/components/schemas/${bodySchema}`
            } : bodySchema
          )
        }
      } : null
    }
  };
};
var filterPaths = (paths, {
  excludeStaticFile = true,
  exclude = []
}) => {
  const newPaths = {};
  for (const [key, value] of Object.entries(paths))
    if (!exclude.some((x) => {
      if (typeof x === "string") return key === x;
      return x.test(key);
    }) && !key.includes("*") && (excludeStaticFile ? !key.includes(".") : true)) {
      Object.keys(value).forEach((method) => {
        const schema = value[method];
        if (key.includes("{")) {
          if (!schema.parameters) schema.parameters = [];
          schema.parameters = [
            ...key.split("/").filter(
              (x) => x.startsWith("{") && !schema.parameters.find(
                (params) => params.in === "path" && params.name === x.slice(1, x.length - 1)
              )
            ).map((x) => ({
              schema: { type: "string" },
              in: "path",
              name: x.slice(1, x.length - 1),
              required: true
            })),
            ...schema.parameters
          ];
        }
        if (!schema.responses)
          schema.responses = {
            200: {}
          };
      });
      newPaths[key] = value;
    }
  return newPaths;
};

// src/index.ts
var swagger = ({
  provider = "scalar",
  scalarVersion = "latest",
  scalarCDN = "",
  scalarConfig = {},
  documentation = {},
  version = "5.9.0",
  excludeStaticFile = true,
  path = "/swagger",
  specPath = `${path}/json`,
  exclude = [],
  swaggerOptions = {},
  theme = `https://unpkg.com/swagger-ui-dist@${version}/swagger-ui.css`,
  autoDarkMode = true,
  excludeMethods = ["OPTIONS"],
  excludeTags = []
} = {}) => {
  const schema = {};
  let totalRoutes = 0;
  if (!version)
    version = `https://unpkg.com/swagger-ui-dist@${version}/swagger-ui.css`;
  const info = {
    title: "Elysia Documentation",
    description: "Development documentation",
    version: "0.0.0",
    ...documentation.info
  };
  const app = new Elysia({ name: "@elysiajs/swagger" });
  const page = new Response(
    provider === "swagger-ui" ? SwaggerUIRender(
      info,
      version,
      theme,
      JSON.stringify(
        {
          url: specPath,
          dom_id: "#swagger-ui",
          ...swaggerOptions
        },
        (_, value) => typeof value === "function" ? void 0 : value
      ),
      autoDarkMode
    ) : ScalarRender(
      info,
      scalarVersion,
      {
        sources: [{ url: specPath }],
        ...scalarConfig,
        // so we can showcase the elysia theme
        _integration: "elysiajs"
      },
      scalarCDN
    ),
    {
      headers: {
        "content-type": "text/html; charset=utf8"
      }
    }
  );
  app.get(path, page, {
    detail: {
      hide: true
    }
  }).get(
    specPath,
    function openAPISchema() {
      const routes = app.getGlobalRoutes();
      if (routes.length !== totalRoutes) {
        const ALLOWED_METHODS = [
          "GET",
          "PUT",
          "POST",
          "DELETE",
          "OPTIONS",
          "HEAD",
          "PATCH",
          "TRACE"
        ];
        totalRoutes = routes.length;
        routes.forEach((route) => {
          if (route.hooks?.detail?.hide === true) return;
          if (excludeMethods.includes(route.method)) return;
          if (ALLOWED_METHODS.includes(route.method) === false && route.method !== "ALL")
            return;
          if (route.method === "ALL")
            ALLOWED_METHODS.forEach((method) => {
              registerSchemaPath({
                schema,
                hook: route.hooks,
                method,
                path: route.path,
                // @ts-ignore
                models: app.getGlobalDefinitions?.().type,
                contentType: route.hooks.type
              });
            });
          else
            registerSchemaPath({
              schema,
              hook: route.hooks,
              method: route.method,
              path: route.path,
              // @ts-ignore
              models: app.getGlobalDefinitions?.().type,
              contentType: route.hooks.type
            });
        });
      }
      return {
        openapi: "3.0.3",
        ...{
          ...documentation,
          tags: documentation.tags?.filter(
            (tag) => !excludeTags?.includes(tag?.name)
          ),
          info: {
            title: "Elysia Documentation",
            description: "Development documentation",
            version: "0.0.0",
            ...documentation.info
          }
        },
        paths: {
          ...filterPaths(schema, {
            excludeStaticFile,
            exclude: Array.isArray(exclude) ? exclude : [exclude]
          }),
          ...documentation.paths
        },
        components: {
          ...documentation.components,
          schemas: {
            // @ts-ignore
            ...app.getGlobalDefinitions?.().type,
            ...documentation.components?.schemas
          }
        }
      };
    },
    {
      detail: {
        hide: true
      }
    }
  );
  return app;
};
var index_default = swagger;
export {
  index_default as default,
  swagger
};
