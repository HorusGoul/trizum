import { describe, expect, it } from "vite-plus/test";
import { configMatches, desiredConfig, validateStorage, type Machine, type Volume } from "./fly.js";

const machine: Machine = {
  id: "machine-1",
  name: "sync",
  region: "cdg",
  state: "started",
  instance_id: "version-1",
  config: {
    image: "old-image",
    env: { EXISTING: "keep" },
    mounts: [{ volume: "volume-1", path: "/mnt/data" }],
    init: { cmd: ["/app/entrypoint.sh"] },
  },
};

const volume: Volume = {
  id: "volume-1",
  name: "trizum_data",
  region: "cdg",
  size_gb: 15,
  attached_machine_id: machine.id,
};

describe("production Fly storage", () => {
  it("accepts the existing disk after it has automatically grown", () => {
    expect(() => validateStorage(machine, volume, volume.id)).not.toThrow(
      /Fly storage|must remain in cdg/,
    );
  });
  it.each([
    { ...volume, id: "replacement" },
    { ...volume, region: "iad" },
    { ...volume, name: "empty_disk" },
    { ...volume, attached_machine_id: "another-machine" },
    { ...volume, size_gb: 1 },
  ])("rejects a replacement or unrelated disk: %j", (disk) => {
    expect(() => validateStorage(machine, disk, volume.id)).toThrow(
      /Fly storage|must remain in cdg/,
    );
  });
  it("rejects a changed mount path or additional disk", () => {
    expect(() =>
      validateStorage(
        {
          ...machine,
          config: { ...machine.config, mounts: [{ volume: volume.id, path: "/other" }] },
        },
        volume,
        volume.id,
      ),
    ).toThrow(/Fly storage|must remain in cdg/);
    expect(() =>
      validateStorage(
        {
          ...machine,
          config: {
            ...machine.config,
            mounts: [...machine.config.mounts, { volume: "other", path: "/other" }],
          },
        },
        volume,
        volume.id,
      ),
    ).toThrow(/Fly storage|must remain in cdg/);
  });
  it("converges despite API defaults and property ordering, but detects image and storage policy drift", () => {
    const config = desiredConfig(machine, "new-image", "new-commit");

    const deployed = {
      ...machine,
      config: {
        ...config,
        guest: { extra_default: true, ...config.guest },
        services: config.services.map((service) => ({ extra_default: true, ...service })),
      },
    };

    expect(configMatches(deployed, "new-image", "new-commit")).toBe(true);
    expect(configMatches(deployed, "other-image", "new-commit")).toBe(false);
    expect(
      configMatches(
        {
          ...deployed,
          config: { ...deployed.config, mounts: [{ ...config.mounts[0], size_gb_limit: 20 }] },
        },
        "new-image",
        "new-commit",
      ),
    ).toBe(false);
  });
  it("preserves disk identity, startup configuration, and volume growth on image updates", () => {
    const updated = desiredConfig(machine, "new-image", "new-commit");
    expect(updated.mounts).toEqual([
      {
        volume: volume.id,
        path: "/mnt/data",
        extend_threshold_percent: 75,
        add_size_gb: 5,
        size_gb_limit: 200,
      },
    ]);
    expect(updated).toHaveProperty("init", machine.config.init);
    expect(updated.env).toMatchObject({
      EXISTING: "keep",
      DB_FILE_NAME: "file:/mnt/data/trizum.db",
    });
    expect(machine.config.image).toBe("old-image");
  });
});
