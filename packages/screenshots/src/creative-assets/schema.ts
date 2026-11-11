import { z } from "zod";

export const creativeAssetSchema = z
  .object({
    locale: z.string().min(1),
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    placement_type: z.enum(["PRODUCT_PAGE_HEADER_ASSET", "APP_STORE_SEARCH_RESULTS_ASSET"]),
    media_type: z.enum(["video", "image"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().optional(),
    duration: z.number().optional(),
    preview_frame_time_code: z.string().optional(),
  })
  .superRefine((asset, context) => {
    if (
      asset.media_type === "video" &&
      (asset.fps === undefined || asset.duration === undefined || !asset.preview_frame_time_code)
    ) {
      context.addIssue({
        code: "custom",
        message: "Video metadata and poster timecode are required",
      });
    }
  });

export const creativeManifestSchema = z.object({
  app_identifier: z.literal("app.trizum.capacitor"),
  assets: z.array(creativeAssetSchema).min(1),
});

export const videoProbeSchema = z.object({
  streams: z.tuple([
    z.object({
      codec_type: z.literal("video"),
      codec_name: z.literal("h264"),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      r_frame_rate: z.string().regex(/^\d+\/\d+$/),
    }),
  ]),
  format: z.object({ duration: z.coerce.number().min(5).max(30) }),
});

export type CreativeAsset = z.infer<typeof creativeAssetSchema>;

export type CreativeManifest = z.infer<typeof creativeManifestSchema>;
