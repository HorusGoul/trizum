export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const photoUrl = url.searchParams.get("url");

    if (!photoUrl) {
      return new Response("Missing 'url' query parameter", { status: 400 });
    }

    // Validate that the URL is from a trusted domain (Tricount's S3)
    const photoUrlObj = new URL(photoUrl);
    if (
      !photoUrlObj.hostname.includes(
        "bunq-prod-model-storage-public.s3.eu-central-1.amazonaws.com",
      )
    ) {
      return new Response("Invalid photo URL domain", { status: 400 });
    }

    // Fetch the photo from the original URL
    const response = await fetch(photoUrl);

    if (!response.ok) {
      return new Response(
        `Failed to fetch photo: ${response.status} ${response.statusText}`,
        {
          status: response.status,
        },
      );
    }

    // Get the content type from the original response
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    // Get the content length if available
    const contentLength = response.headers.get("content-length");

    // Create response headers for the proxy
    const proxyHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3153600000, immutable",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    if (contentLength) {
      proxyHeaders.set("Content-Length", contentLength);
    }

    // Return the photo data with appropriate headers
    return new Response(response.body, {
      status: 200,
      headers: proxyHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
