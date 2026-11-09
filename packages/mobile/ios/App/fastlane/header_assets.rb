require "digest"
require "json"
require "net/http"
require "uri"

# The Asset Library is separate from deliver's screenshot synchronization.
# Only upload the reviewed, hash-pinned headers; never delete other artwork.
class HeaderAssets
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
    validate_files
    app = list("v1/apps", filter: { bundleId: @manifest.fetch("app_identifier") }).fetch(0)
    @result["app_id"] = app.fetch("id")
    library = get("v1/apps/#{app.fetch('id')}/assetLibrary").fetch("data")
    @result["library_id"] = library.fetch("id")
    catalog = get("v1/appAssetLibraryRefData").fetch("data")
    catalog = catalog.first if catalog.is_a?(Array)
    @specs = compatible_specs(catalog.fetch("attributes"))
    raise "No compatible header video specification is available" if @specs.empty?
    @result["compatible_spec_ids"] = @specs.map { |spec| spec.fetch("specId") }
    prepare_placements(version, catalog.fetch("attributes"))
    return @result.merge("preflight" => true) if preflight

    @manifest.fetch("assets").each { |asset| upload(asset) }
    place_headers
    @result
  ensure
    File.write(@report_path, JSON.pretty_generate(@result) + "\n")
  end

  private

  def validate_files
    raise "Only product page headers are supported" unless @manifest.fetch("placement_type") == "PRODUCT_PAGE_HEADER_ASSET"
    locales = @manifest.fetch("assets").map { |asset| asset.fetch("locale") }
    raise "Duplicate locales" unless locales.uniq == locales

    @manifest.fetch("assets").each do |asset|
      path = asset_path(asset)
      raise "Header checksum differs from the approved manifest: #{asset.fetch('locale')}" unless Digest::SHA256.file(path).hexdigest == asset.fetch("sha256")
    end
  end

  def compatible_specs(catalog)
    catalog.fetch("videoSpecs").select do |spec|
      dimensions = spec.fetch("dimensions")
      spec.fetch("compatiblePlacementTypes").include?(@manifest.fetch("placement_type")) &&
        spec.fetch("fileExtensions").include?(".mp4") && !spec.fetch("audioRequired") &&
        @manifest.fetch("width").between?(dimensions.fetch("minWidth"), dimensions.fetch("maxWidth")) &&
        @manifest.fetch("height").between?(dimensions.fetch("minHeight"), dimensions.fetch("maxHeight")) &&
        spec.fetch("frameRates").any? { |range| @manifest.fetch("fps").between?(range.fetch("minFps"), range.fetch("maxFps")) } &&
        @manifest.fetch("duration").between?(seconds(spec.fetch("duration").fetch("min")), seconds(spec.fetch("duration").fetch("max"))) &&
        @manifest.fetch("assets").all? { |asset| File.size(asset_path(asset)) <= spec.fetch("maxFileSize") }
    end
  end

  def seconds(duration)
    match = /\APT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?\z/.match(duration)
    raise "Unrecognized duration: #{duration}" unless match
    match[1].to_i * 3600 + match[2].to_i * 60 + match[3].to_f
  end

  def upload(asset)
    reference = "trizum-header-#{asset.fetch('locale')}-#{asset.fetch('sha256')}"
    matches = list("v1/appAssetLibraries/#{@result.fetch('library_id')}/videos", filter: { referenceName: reference, category: "CREATIVE_ASSETS" })
    raise "Ambiguous existing header: #{reference}" if matches.length > 1
    video = matches.first
    newly_reserved = video.nil?
    unless video
      video = post("v1/appAssetLibraryVideos", {
        type: "appAssetLibraryVideos",
        attributes: { fileName: "trizum-header-#{asset.fetch('locale')}.mp4", fileSize: File.size(asset_path(asset)), category: "CREATIVE_ASSETS", referenceName: reference, previewFrameTimeCode: asset.fetch("preview_frame_time_code") },
        relationships: { assetLibrary: { data: { type: "appAssetLibraries", id: @result.fetch("library_id") } } }
      }).fetch("data")
      record(asset, video)
      transfer(asset_path(asset), video.fetch("attributes").fetch("uploadOperations"))
      @client.patch("v1/appAssetLibraryVideos/#{video.fetch('id')}", { data: { type: "appAssetLibraryVideos", id: video.fetch("id"), attributes: { uploaded: true } } })
    end
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 600
    loop do
      video = get("v1/appAssetLibraryVideos/#{video.fetch('id')}").fetch("data")
      record(asset, video)
      attributes = video.fetch("attributes")
      state = attributes.fetch("state")
      @log.call("#{asset.fetch('locale')}: #{video.fetch('id')} #{state}")
      raise "Header processing failed: #{attributes['stateDetails']}" if state == "FAILED"
      raise "Existing upload is incomplete; inspect asset #{@result['assets'].last['id']} before retrying" if state == "AWAITING_UPLOAD" && !newly_reserved
      preview = attributes["previewFrameImage"] || {}
      raise "Poster processing failed: #{preview['errors']}" if preview["state"] == "FAILED"
      if READY_STATES.include?(state) && preview["state"] == "COMPLETE"
        raise "Processed specification is incompatible with the header placement" unless @result.fetch("compatible_spec_ids").include?(attributes.fetch("specId"))
        break
      end
      raise "Header processing exceeded ten minutes" if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
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

  def record(asset, video)
    entry = { "locale" => asset.fetch("locale"), "sha256" => asset.fetch("sha256"), "id" => video.fetch("id"), "state" => video.fetch("attributes").fetch("state"), "spec_id" => video.fetch("attributes")["specId"] }
    @result["assets"].reject! { |existing| existing["locale"] == entry["locale"] }
    @result["assets"] << entry
    File.write(@report_path, JSON.pretty_generate(@result) + "\n")
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
    type = @manifest.fetch("placement_type")
    feature = catalog.fetch("features").find { |item| item["featureId"] == "APP_STORE_VERSIONS" }
    policy = feature&.fetch("placementPolicies", [])&.find { |item| item["placementType"] == type }
    groups = (policy || {}).fetch("groupLimits", []).select { |limit| limit.fetch("maxCount") > 0 }.flat_map { |limit| limit.fetch("groupIds") }
    placement_type = catalog.fetch("placementTypes").find { |item| item["placementTypeId"] == type }
    raise "Header creative assets are unavailable" unless placement_type && placement_type.fetch("acceptsAssetCategories").include?("CREATIVE_ASSETS")
    mobile_groups = catalog.fetch("placementProfileGroups").select { |group| %w[IPHONE_APP_STORE IPAD_APP_STORE ANY].include?(group.fetch("platform")) }.map { |group| group.fetch("placementProfileGroupId") }
    @group_specs = placement_type.fetch("specMappings").filter_map do |mapping|
      specs = mapping.fetch("specs") & @result.fetch("compatible_spec_ids")
      [mapping.fetch("placementGroupId"), specs] if groups.include?(mapping.fetch("placementGroupId")) && mobile_groups.include?(mapping.fetch("placementGroupId")) && !specs.empty?
    end.to_h
    raise "No supported header placement groups" if @group_specs.empty?
    localizations = list("v1/appStoreVersions/#{version.fetch('id')}/appStoreVersionLocalizations")
    @plans = @manifest.fetch("assets").flat_map do |asset|
      localization = localizations.find { |item| item.fetch("attributes")["locale"] == asset.fetch("locale") }
      raise "Release is missing localization #{asset.fetch('locale')}" unless localization
      placements = list("v1/appStoreVersionLocalizations/#{localization.fetch('id')}/placements", filter: { placementType: type }, include: "video,image")
      @group_specs.keys.map do |group|
        { locale: asset.fetch("locale"), localization: localization.fetch("id"), group: group, existing: placements.select { |item| item.fetch("attributes")["placementType"] == type && item.fetch("attributes")["placementGroup"] == group } }
      end
    end
  end

  def place_headers
    @result["placements"] = []
    @plans.each do |plan|
      asset = @result.fetch("assets").find { |item| item.fetch("locale") == plan.fetch(:locale) }
      raise "Processed header does not match placement group #{plan.fetch(:group)}" unless @group_specs.fetch(plan.fetch(:group)).include?(asset.fetch("spec_id"))
    end
    @plans.each do |plan|
      asset = @result.fetch("assets").find { |item| item.fetch("locale") == plan.fetch(:locale) }
      existing = plan.fetch(:existing)
      if existing.length == 1 && existing.first.dig("relationships", "video", "data", "id") == asset.fetch("id")
        placement = existing.first
      else
        # All locales are ready before replacing only the target header slots.
        # A failure aborts the lane before app-version review; live pages stay intact.
        @result["replacing"] = plan
        File.write(@report_path, JSON.pretty_generate(@result) + "\n")
        existing.each { |item| @client.delete("v1/appAssetLibraryPlacements/#{item.fetch('id')}") }
        placement = post("v1/appAssetLibraryPlacements", {
          type: "appAssetLibraryPlacements",
          attributes: { placementType: @manifest.fetch("placement_type"), placementGroup: plan.fetch(:group) },
          relationships: { video: { data: { type: "appAssetLibraryVideos", id: asset.fetch("id") } }, appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: plan.fetch(:localization) } } }
        }).fetch("data")
      end
      @result.fetch("placements") << { "locale" => plan.fetch(:locale), "group" => plan.fetch(:group), "id" => placement.fetch("id"), "video_id" => asset.fetch("id"), "state" => placement.fetch("attributes")["state"] }
      @result.delete("replacing")
      File.write(@report_path, JSON.pretty_generate(@result) + "\n")
      @log.call("#{plan.fetch(:locale)}: header #{placement.fetch('id')} attached to #{@result.fetch('version')}")
    end
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
