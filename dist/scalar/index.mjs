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
export {
  ScalarRender
};
