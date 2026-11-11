require "digest"
require "json"
require "net/http"
require "uri"

# The Asset Library is separate from deliver's screenshot synchronization.
# Only selected, hash-pinned creatives enter the release; drafts stay local.
class CreativeAssets
  PLACEMENT_TYPES = %w[PRODUCT_PAGE_HEADER_ASSET APP_STORE_SEARCH_RESULTS_ASSET].freeze
  RESOURCES = {
    "video" => { collection: "appAssetLibraryVideos", library: "videos", relation: "video", specs: "videoSpecs" },
    "image" => { collection: "appAssetLibraryImages", library: "images", relation: "image", specs: "imageSpecs" }
  }.freeze
  READY_STATES = %w[PREPARE_FOR_SUBMISSION WAITING_FOR_REVIEW IN_REVIEW APPROVED].freeze

  def initialize(client:, manifest:, report:, log: ->(message) { puts(message) }, http: Net::HTTP)
    @client = client
    @http = http
    @manifest_path = File.expand_path(manifest)
    @manifest = JSON.parse(File.read(@manifest_path))
    @report_path = report
    @log = log
    @result = { "assets" => [] }
  end

  def run(version:, preflight: false)
    @result["preflight"] = preflight
    validate_files
    app = list("v1/apps", filter: { bundleId: @manifest.fetch("app_identifier") }).fetch(0)
    @result["app_id"] = app.fetch("id")
    library = get("v1/apps/#{app.fetch('id')}/assetLibrary").fetch("data")
    @result["library_id"] = library.fetch("id")
    catalog = get("v1/appAssetLibraryRefData").fetch("data")
    catalog = catalog.first if catalog.is_a?(Array)
    @asset_specs = @manifest.fetch("assets").to_h do |asset|
      specs = compatible_specs(catalog.fetch("attributes"), asset).map { |spec| spec.fetch("specId") }
      raise "No compatible specification for #{asset_key(asset).join('/')}" if specs.empty?
      [asset_key(asset), specs]
    end
    prepare_placements(version, catalog.fetch("attributes"))
    return @result if preflight

    @manifest.fetch("assets").each { |asset| upload(asset) }
    place_assets
    @result
  ensure
    File.write(@report_path, JSON.pretty_generate(@result) + "\n")
  end

  private

  def validate_files
    raise "Creative manifest must target app.trizum.capacitor" unless @manifest.fetch("app_identifier") == "app.trizum.capacitor"
    raise "No creative assets selected" if @manifest.fetch("assets").empty?
    targets = @manifest.fetch("assets").map { |asset| asset_key(asset) }
    raise "Duplicate locale/placement targets" unless targets.uniq == targets
    @manifest.fetch("assets").each do |asset|
      raise "Unsupported creative placement" unless PLACEMENT_TYPES.include?(asset.fetch("placement_type"))
      resource(asset)
      path = asset_path(asset)
      raise "Creative checksum differs from the selected manifest: #{asset_key(asset).join('/')}" unless Digest::SHA256.file(path).hexdigest == asset.fetch("sha256")
      if asset.fetch("media_type") == "image"
        bytes = File.binread(path, 33)
        raise "Creative images must be RGB PNGs without alpha" unless bytes.byteslice(0, 8) == "\x89PNG\r\n\x1a\n".b && bytes.getbyte(25) == 2
        raise "PNG dimensions differ from manifest" unless bytes.byteslice(16, 8).unpack("NN") == asset.values_at("width", "height")
      else
        raise "Creative video must be MP4 with a poster timecode" unless File.extname(path) == ".mp4" && asset["preview_frame_time_code"]
      end
    end
  end

  def compatible_specs(catalog, asset)
    catalog.fetch(resource(asset).fetch(:specs)).select do |spec|
      dimensions = spec.fetch("dimensions")
      common = spec.fetch("compatiblePlacementTypes").include?(asset.fetch("placement_type")) &&
        spec.fetch("fileExtensions").include?(File.extname(asset_path(asset))) &&
        asset.fetch("width").between?(dimensions.fetch("minWidth"), dimensions.fetch("maxWidth")) &&
        asset.fetch("height").between?(dimensions.fetch("minHeight"), dimensions.fetch("maxHeight")) &&
        File.size(asset_path(asset)) <= spec.fetch("maxFileSize")
      next false unless common
      if asset.fetch("media_type") == "video"
        !spec.fetch("audioRequired") &&
          spec.fetch("frameRates").any? { |range| asset.fetch("fps").between?(range.fetch("minFps"), range.fetch("maxFps")) } &&
          asset.fetch("duration").between?(seconds(spec.fetch("duration").fetch("min")), seconds(spec.fetch("duration").fetch("max")))
      else
        # The file is already verified RGB; allowing alpha never requires it.
        true
      end
    end
  end

  def seconds(duration)
    match = /\APT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?\z/.match(duration)
    raise "Unrecognized duration: #{duration}" unless match
    match[1].to_i * 3600 + match[2].to_i * 60 + match[3].to_f
  end

  def upload(asset)
    kind = asset.fetch("placement_type") == "PRODUCT_PAGE_HEADER_ASSET" ? "header" : "search"
    type = resource(asset).fetch(:collection)
    reference = "trizum-#{kind}-#{asset.fetch('locale')}-#{asset.fetch('sha256')}"
    # Posters belong to the shared video. Keep each selection immutable, and
    # leave videos with the legacy hash-only reference untouched.
    reference += "-poster-#{asset.fetch('preview_frame_time_code').tr(':', '-')}" if asset.fetch("media_type") == "video"
    matches = list("v1/appAssetLibraries/#{@result.fetch('library_id')}/#{resource(asset).fetch(:library)}", filter: { referenceName: reference, category: "CREATIVE_ASSETS" })
    raise "Ambiguous existing creative: #{reference}" if matches.length > 1
    entry = matches.first
    newly_reserved = entry.nil?
    unless entry
      attributes = { fileName: "trizum-#{kind}-#{asset.fetch('locale')}#{File.extname(asset_path(asset))}", fileSize: File.size(asset_path(asset)), category: "CREATIVE_ASSETS", referenceName: reference }
      attributes[:previewFrameTimeCode] = asset.fetch("preview_frame_time_code") if asset.fetch("media_type") == "video"
      entry = post("v1/#{type}", { type: type, attributes: attributes, relationships: { assetLibrary: { data: { type: "appAssetLibraries", id: @result.fetch("library_id") } } } }).fetch("data")
      record(asset, entry)
      transfer(asset_path(asset), entry.fetch("attributes").fetch("uploadOperations"))
      @client.patch("v1/#{type}/#{entry.fetch('id')}", { data: { type: type, id: entry.fetch("id"), attributes: { uploaded: true } } })
    end
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 600
    loop do
      entry = get("v1/#{type}/#{entry.fetch('id')}").fetch("data")
      record(asset, entry)
      attributes = entry.fetch("attributes")
      state = attributes.fetch("state")
      preview = attributes.dig("previewFrameImage", "state") || {}
      @log.call("#{asset_key(asset).join('/')}: #{entry.fetch('id')} #{state} (poster=#{preview['state'] || 'unavailable'})")
      raise "Creative processing failed: #{attributes['stateDetails']}" if state == "FAILED"
      raise "Existing upload is incomplete; inspect #{entry.fetch('id')} before retrying" if state == "AWAITING_UPLOAD" && !newly_reserved
      raise "Poster processing failed: #{preview['errors']}" if asset.fetch("media_type") == "video" && preview["state"] == "FAILED"
      ready = READY_STATES.include?(state) && (asset.fetch("media_type") == "image" || preview["state"] == "COMPLETE")
      if ready
        raise "Processed creative specification is incompatible" unless @asset_specs.fetch(asset_key(asset)).include?(attributes.fetch("specId"))
        break
      end
      raise "Creative processing exceeded ten minutes" if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
      sleep(5)
    end
  end

  def transfer(path, operations)
    cursor = 0
    operations.sort_by { |operation| operation.fetch("offset") }.each do |operation|
      raise "Upload operations do not cover the file contiguously" unless operation.fetch("offset") == cursor
      cursor += operation.fetch("length")
    end
    raise "Upload operations have an incorrect total length" unless cursor == File.size(path)
    operations.each do |operation|
      uri = URI(operation.fetch("url"))
      raise "Expected HTTPS upload URL" unless uri.scheme == "https"
      method = operation.fetch("method").upcase
      raise "Unsupported storage upload method" unless %w[PUT POST].include?(method)
      request = Net::HTTPGenericRequest.new(method, true, true, uri.request_uri)
      operation.fetch("requestHeaders").each { |header| request[header.fetch("name")] = header.fetch("value") }
      request.body = File.binread(path, operation.fetch("length"), operation.fetch("offset"))
      response = @http.start(uri.host, uri.port, use_ssl: true, open_timeout: 30, read_timeout: 120, write_timeout: 120) { |http| http.request(request) }
      raise "Storage upload failed (HTTP #{response.code}); asset reservation retained" unless response.is_a?(Net::HTTPSuccess)
    end
  end

  def record(asset, entry)
    result = asset.slice("locale", "placement_type", "media_type", "sha256", "preview_frame_time_code").merge("id" => entry.fetch("id"), "spec_id" => entry.fetch("attributes")["specId"], "state" => entry.fetch("attributes").fetch("state"))
    result["preview_frame_state"] = entry.fetch("attributes").dig("previewFrameImage", "state") if asset.fetch("media_type") == "video"
    @result["assets"].reject! { |existing| asset_key(existing) == asset_key(asset) }
    @result["assets"] << result
    save_report
  end

  def prepare_placements(version_string, catalog)
    versions = list("v1/apps/#{@result.fetch('app_id')}/appStoreVersions", filter: { platform: "IOS", versionString: version_string })
    raise "Expected one iOS release version #{version_string}" unless versions.length == 1
    version = versions.first
    state = version.fetch("attributes")["appVersionState"] || version.fetch("attributes")["appStoreState"]
    editable = %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED REJECTED METADATA_REJECTED INVALID_BINARY]
    raise "Release #{version_string} is not editable (#{state})" unless editable.include?(state)
    @result["version_id"] = version.fetch("id")
    @result["version"] = version_string
    feature = catalog.fetch("features").find { |item| item["featureId"] == "APP_STORE_VERSIONS" }
    mobile_groups = catalog.fetch("placementProfileGroups").select { |group| %w[IPHONE_APP_STORE IPAD_APP_STORE ANY].include?(group.fetch("platform")) }.map { |group| group.fetch("placementProfileGroupId") }
    localizations = list("v1/appStoreVersions/#{version.fetch('id')}/appStoreVersionLocalizations")
    @plans = @manifest.fetch("assets").flat_map do |asset|
      type = asset.fetch("placement_type")
      policy = feature&.fetch("placementPolicies", [])&.find { |item| item["placementType"] == type }
      groups = (policy || {}).fetch("groupLimits", []).select { |limit| limit.fetch("maxCount") > 0 }.flat_map { |limit| limit.fetch("groupIds") }
      placement_type = catalog.fetch("placementTypes").find { |item| item["placementTypeId"] == type }
      raise "Creative placement #{type} is unavailable" unless placement_type && placement_type.fetch("acceptsAssetCategories").include?("CREATIVE_ASSETS")
      mappings = placement_type.fetch("specMappings").filter_map do |mapping|
        specs = mapping.fetch("specs") & @asset_specs.fetch(asset_key(asset))
        [mapping.fetch("placementGroupId"), specs] if groups.include?(mapping.fetch("placementGroupId")) && mobile_groups.include?(mapping.fetch("placementGroupId")) && !specs.empty?
      end.to_h
      raise "No supported placement groups for #{type}" if mappings.empty?
      localization = localizations.find { |item| item.fetch("attributes")["locale"] == asset.fetch("locale") }
      raise "Release is missing localization #{asset.fetch('locale')}" unless localization
      placements = list("v1/appStoreVersionLocalizations/#{localization.fetch('id')}/placements", filter: { placementType: type }, include: "video,image")
      mappings.map do |group, specs|
        { asset: asset, localization: localization.fetch("id"), group: group, specs: specs, existing: placements.select { |item| item.fetch("attributes")["placementType"] == type && item.fetch("attributes")["placementGroup"] == group } }
      end
    end
    @result["targets"] = @plans.map do |plan|
      plan.fetch(:asset).slice("locale", "placement_type", "media_type", "sha256").merge("group" => plan.fetch(:group), "spec_ids" => plan.fetch(:specs), "existing_placement_ids" => plan.fetch(:existing).map { |placement| placement.fetch("id") })
    end
  end

  def place_assets
    @result["placements"] = []
    @plans.each do |plan|
      entry = uploaded_asset(plan.fetch(:asset))
      raise "Processed creative does not match placement group #{plan.fetch(:group)}" unless plan.fetch(:specs).include?(entry.fetch("spec_id"))
    end
    @plans.each do |plan|
      asset = plan.fetch(:asset)
      entry = uploaded_asset(asset)
      definition = resource(asset)
      existing = plan.fetch(:existing)
      if existing.length == 1 && existing.first.dig("relationships", definition.fetch(:relation), "data", "id") == entry.fetch("id")
        placement = existing.first
      else
        # Every selected locale/placement is ready before replacing any slot.
        @result["replacing"] = plan
        save_report
        existing.each { |item| @client.delete("v1/appAssetLibraryPlacements/#{item.fetch('id')}") }
        placement = post("v1/appAssetLibraryPlacements", {
          type: "appAssetLibraryPlacements",
          attributes: { placementType: asset.fetch("placement_type"), placementGroup: plan.fetch(:group) },
          relationships: { definition.fetch(:relation) => { data: { type: definition.fetch(:collection), id: entry.fetch("id") } }, appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: plan.fetch(:localization) } } }
        }).fetch("data")
      end
      @result.fetch("placements") << { "locale" => asset.fetch("locale"), "placement_type" => asset.fetch("placement_type"), "group" => plan.fetch(:group), "id" => placement.fetch("id"), "asset_id" => entry.fetch("id"), "state" => placement.fetch("attributes")["state"] }
      @result.delete("replacing")
      save_report
      @log.call("#{asset_key(asset).join('/')}: placement #{placement.fetch('id')} attached to #{@result.fetch('version')}")
    end
  end

  def asset_key(asset)
    asset.values_at("locale", "placement_type")
  end

  def resource(asset)
    RESOURCES.fetch(asset.fetch("media_type"))
  end

  def uploaded_asset(asset)
    @result.fetch("assets").find { |entry| asset_key(entry) == asset_key(asset) } || raise("Selected asset was not uploaded")
  end

  def save_report
    File.write(@report_path, JSON.pretty_generate(@result) + "\n")
  end

  def asset_path(asset)
    File.expand_path(asset.fetch("path"), File.dirname(@manifest_path))
  end

  def get(path, params = nil)
    @client.get(path, params).body
  end

  def post(path, data)
    # Never blindly replay asset reservations or placement creation.
    @client.post(path, { data: data }, tries: 1).body
  end

  def list(path, params = nil)
    records = []
    while path
      page = get(path, params)
      records.concat(page.fetch("data"))
      path = page.dig("links", "next")
      params = nil
      raise "Unexpected pagination origin" if path && !path.start_with?("https://api.appstoreconnect.apple.com/")
    end
    records
  end
end
