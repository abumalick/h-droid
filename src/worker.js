const TYPES = {
  apk: "application/vnd.android.package-archive",
  jar: "application/java-archive",
  json: "application/json",
  xml: "application/xml",
  html: "text/html; charset=utf-8",
  css: "text/css",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { pathname } = new URL(request.url);
    if (pathname === "/") {
      return Response.redirect(new URL("/repo/index.html", request.url), 302);
    }
    if (!pathname.startsWith("/repo/")) {
      return new Response("Not found", { status: 404 });
    }

    const key = decodeURIComponent(pathname.slice(1));
    const object = await env.REPO.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set(
      "content-type",
      TYPES[key.split(".").pop()] ?? "application/octet-stream",
    );
    headers.set("cache-control", "public, max-age=0, must-revalidate");

    if (!("body" in object)) return new Response(null, { status: 304, headers });

    const range = object.range;
    if (request.headers.has("range") && range && "offset" in range) {
      const start = range.offset ?? 0;
      const end = start + (range.length ?? object.size - start) - 1;
      headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
      headers.set("content-length", String(end - start + 1));
      return new Response(request.method === "HEAD" ? null : object.body, {
        status: 206,
        headers,
      });
    }

    headers.set("content-length", String(object.size));
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers,
    });
  },
};
