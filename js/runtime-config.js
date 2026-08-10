(function () {
  "use strict";

  // Central Cloudflare D1 service in production; local development stays local.
  const isLocalDevelopment = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1";
  window.MATH_ROCKET_API_URL = window.MATH_ROCKET_API_URL
    || (isLocalDevelopment
      ? "./api/progress"
      : "https://math-rocket-jjcc-sync.jensenhchen.workers.dev/api/progress");
})();
