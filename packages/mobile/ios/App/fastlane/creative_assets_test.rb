require "minitest/autorun"
require "tmpdir"
require "zlib"
require_relative "creative_assets"

class CreativeAssetsClientFake
  Response = Struct.new(:body)
  attr_reader :mutations, :requests, :videos
  attr_accessor :version_state, :processing_failure, :placement_failure, :transient_upload_state, :image_alpha_allowed

  def initialize(manifest)
    @manifest = manifest
    @mutations = []
    @requests = []
    @videos = {}
    @images = {}
    @placements = { "en-US" => [], "es-ES" => [] }
    @next_placement_id = 0
    @version_state = "PREPARE_FOR_SUBMISSION"
  end

  def catalog
    groups = %w[phone tablet desktop]
    types = %w[PRODUCT_PAGE_HEADER_ASSET APP_STORE_SEARCH_RESULTS_ASSET]
    header_video = { "specId" => "header-video", "compatiblePlacementTypes" => [types[0]], "dimensions" => { "minWidth" => 3840, "maxWidth" => 3840, "minHeight" => 1646, "maxHeight" => 1646 }, "fileExtensions" => [".mp4"], "audioRequired" => false, "frameRates" => [{ "minFps" => 60, "maxFps" => 60 }], "duration" => { "min" => "PT5S", "max" => "PT30S" }, "maxFileSize" => 20_000_000 }
    search_dimensions = { "minWidth" => 1920, "maxWidth" => 1920, "minHeight" => 1280, "maxHeight" => 1280 }
    {
      "placementProfileGroups" => [{ "placementProfileGroupId" => "phone", "platform" => "IPHONE_APP_STORE" }, { "placementProfileGroupId" => "tablet", "platform" => "IPAD_APP_STORE" }, { "placementProfileGroupId" => "desktop", "platform" => "MAC_APP_STORE" }],
      "features" => [{ "featureId" => "APP_STORE_VERSIONS", "placementPolicies" => types.map { |type| { "placementType" => type, "groupLimits" => [{ "groupIds" => groups, "maxCount" => 1 }] } } }],
      "placementTypes" => types.map { |type| { "placementTypeId" => type, "acceptsAssetCategories" => ["CREATIVE_ASSETS"], "specMappings" => groups.map { |group| { "placementGroupId" => group, "specs" => type == types[0] ? ["header-video"] : %w[search-image search-video] } } } },
      "videoSpecs" => [header_video, header_video.merge("specId" => "search-video", "compatiblePlacementTypes" => [types[1]], "dimensions" => search_dimensions)],
      "imageSpecs" => [{ "specId" => "search-image", "compatiblePlacementTypes" => [types[1]], "dimensions" => search_dimensions, "fileExtensions" => [".png"], "alphaAllowed" => !!@image_alpha_allowed, "maxFileSize" => 20_000_000 }]
    }
  end

  def seed_placement(locale, group, video_id, type = "PRODUCT_PAGE_HEADER_ASSET")
    item = { "id" => "old-#{locale}-#{group}-#{type}", "attributes" => { "placementType" => type, "placementGroup" => group, "state" => "PARENT_PREPARE_FOR_SUBMISSION" }, "relationships" => { "video" => { "data" => { "id" => video_id } } } }
    @placements.fetch(locale) << item
    item
  end

  def get(path, params = nil)
    @requests << [path, params]
    data = case path
           when "v1/apps" then [{ "id" => "app" }]
           when "v1/apps/app/assetLibrary" then { "id" => "library" }
           when "v1/appAssetLibraryRefData" then [{ "attributes" => catalog }]
           when "v1/apps/app/appStoreVersions" then [{ "id" => "version", "attributes" => { "appVersionState" => @version_state } }]
           when "v1/appStoreVersions/version/appStoreVersionLocalizations" then %w[en-US es-ES].map { |locale| { "id" => locale, "attributes" => { "locale" => locale } } }
           when %r{\Av1/appStoreVersionLocalizations/(.+)/placements\z} then @placements.fetch(Regexp.last_match(1)).map(&:dup)
           when %r{\Av1/appAssetLibraries/library/(videos|images)\z} then (Regexp.last_match(1) == "videos" ? @videos : @images).values.select { |video| video.dig("attributes", "referenceName") == params.fetch(:filter).fetch(:referenceName) }
           when %r{\Av1/appAssetLibrary(Videos|Images)/(.+)\z}
             collection, id = Regexp.last_match(1), Regexp.last_match(2)
             video = (collection == "Videos" ? @videos : @images).fetch(id)
             if @transient_upload_state && !@transient_seen
               @transient_seen = true
               return Response.new({ "data" => video.merge("attributes" => video.fetch("attributes").merge("state" => "AWAITING_UPLOAD")) })
             end
             video["attributes"]["state"] = "FAILED" if @processing_failure && video["id"].include?("es-ES")
             video
           else raise "Unexpected GET: #{path}"
           end
    Response.new({ "data" => data })
  end

  def post(path, body, tries:)
    raise "Mutating POST must not retry" unless tries == 1
    @mutations << [:post, path, body]
    data = body.fetch(:data)
    item = if %w[v1/appAssetLibraryVideos v1/appAssetLibraryImages].include?(path)
             id = "#{data.fetch(:attributes).fetch(:referenceName)}-#{@videos.length + @images.length}"
             attributes = data.fetch(:attributes).transform_keys(&:to_s).merge("state" => "AWAITING_UPLOAD", "specId" => (path.end_with?("Images") ? "search-image" : id.include?("search") ? "search-video" : "header-video"), "previewFrameImage" => { "state" => { "state" => "COMPLETE", "errors" => [], "warnings" => [] } }, "uploadOperations" => [{ "method" => "PUT", "url" => "https://upload.example.test/part", "offset" => 0, "length" => data.fetch(:attributes).fetch(:fileSize), "requestHeaders" => [{ "name" => "Content-Type", "value" => "video/mp4" }] }])
             attributes.delete("previewFrameImage") if path.end_with?("Images")
             (path.end_with?("Images") ? @images : @videos)[id] = { "id" => id, "attributes" => attributes }
           elsif path == "v1/appAssetLibraryPlacements"
             raise "Simulated ambiguous placement failure" if @placement_failure
             relationships = data.fetch(:relationships).transform_keys(&:to_s)
             locale = relationships.fetch("appStoreVersionLocalization").fetch(:data).fetch(:id)
             relation = relationships.key?("video") ? "video" : "image"
             item = { "id" => "new-#{@next_placement_id += 1}", "attributes" => data.fetch(:attributes).transform_keys(&:to_s), "relationships" => { relation => { "data" => { "id" => relationships.fetch(relation).fetch(:data).fetch(:id) } } } }
             @placements.fetch(locale) << item
             item
           else raise "Unexpected POST: #{path}"
           end
    Response.new({ "data" => item })
  end

  def patch(path, body)
    @mutations << [:patch, path, body]
    (path.include?("/appAssetLibraryImages/") ? @images : @videos).fetch(path.split('/').last).fetch("attributes")["state"] = "PREPARE_FOR_SUBMISSION"
    Response.new({})
  end

  def delete(path)
    @mutations << [:delete, path]
    @placements.each_value { |items| items.reject! { |item| item.fetch("id") == path.split('/').last } }
    Response.new({})
  end
end

class CreativeAssetsTest < Minitest::Test
  def setup
    @directory = Dir.mktmpdir("trizum-header-test")
    @manifest = JSON.parse(File.read(File.join(__dir__, "creative_assets/manifest.json")))
    @manifest.fetch("assets").each { |asset| asset["path"] = File.expand_path(asset.fetch("path"), File.join(__dir__, "creative_assets")) }
    @release_manifest = JSON.parse(JSON.generate(@manifest))
    @manifest["assets"] = @manifest.fetch("assets").select { |asset| asset.fetch("placement_type") == "PRODUCT_PAGE_HEADER_ASSET" }
    @manifest_path = File.join(@directory, "manifest.json")
    File.write(@manifest_path, JSON.generate(@manifest))
    @client = CreativeAssetsClientFake.new(@manifest)
    @uploads = []
  end

  def teardown
    FileUtils.remove_entry(@directory)
  end

  def run_creatives(preflight: false, on_wait: nil)
    http = Object.new
    uploads = @uploads
    http.define_singleton_method(:request) do |request|
      uploads << request
      Net::HTTPOK.new("1.1", "200", "OK")
    end
    transport = Object.new
    transport.define_singleton_method(:start) { |*_arguments, **_options, &block| block.call(http) }
    uploader = CreativeAssets.new(client: @client, manifest: @manifest_path, report: File.join(@directory, "report.json"), log: ->(_message) {}, http: transport)
    uploader.define_singleton_method(:sleep) do |_seconds|
      raise "Unexpected wait for a processed creative" unless on_wait
      on_wait.call
    end
    uploader.run(version: "1.14.0", preflight: preflight)
  end

  def test_uploads_exact_approved_bytes_without_api_token_and_places_both_locales
    result = run_creatives
    assert_equal 2, @uploads.length
    @uploads.zip(@manifest.fetch("assets")).each do |request, asset|
      assert_equal File.binread(asset.fetch("path")), request.body
      assert_nil request["Authorization"]
      assert_equal "video/mp4", request["Content-Type"]
    end
    assert_equal 4, result.fetch("placements").length
    assert_equal %w[en-US es-ES], result.fetch("placements").map { |placement| placement.fetch("locale") }.uniq
    assert @client.mutations.all? { |_method, path| !path.include?("reviewSubmission") }
    assert @client.mutations.any? { |method, path, body| method == :patch && path.include?("Videos/") && body.dig(:data, :attributes) == { uploaded: true } }
  end

  def test_release_manifest_uploads_selected_headers_and_search_images_in_both_locales
    File.write(@manifest_path, JSON.generate(@release_manifest))

    result = run_creatives

    assert_equal 4, result.fetch("assets").length
    assert_equal 8, result.fetch("placements").length
    @uploads.zip(@release_manifest.fetch("assets")).each do |request, asset|
      assert_equal File.binread(asset.fetch("path")), request.body
    end
    %w[en-US es-ES].each do |locale|
      assert_equal %w[APP_STORE_SEARCH_RESULTS_ASSET PRODUCT_PAGE_HEADER_ASSET], result.fetch("placements").select { |placement| placement.fetch("locale") == locale }.map { |placement| placement.fetch("placement_type") }.uniq.sort
    end
    @client.mutations.clear
    @uploads.clear
    run_creatives
    assert_empty @client.mutations
    assert_empty @uploads
  end

  def test_freshly_committed_upload_can_briefly_report_awaiting_upload
    @client.transient_upload_state = true
    result = run_creatives(on_wait: -> {})
    assert_equal 4, result.fetch("placements").length
  end

  def test_waits_for_nested_poster_processing_before_placing_any_assets
    run_creatives
    @client.mutations.clear
    @client.videos.each_value do |video|
      video.fetch("attributes")["previewFrameImage"]["state"] = { "state" => "PROCESSING" }
    end
    waits = 0

    result = run_creatives(on_wait: lambda do
      waits += 1
      assert_empty @client.mutations
      @client.videos.each_value do |video|
        video.fetch("attributes")["previewFrameImage"]["state"] = { "state" => "COMPLETE" }
      end
    end)

    assert_equal 1, waits
    assert_equal 4, result.fetch("placements").length
    assert result.fetch("assets").all? { |asset| asset.dig("preview_frame_state", "state") == "COMPLETE" }
  end

  def test_nested_poster_failure_reports_apple_errors_without_replacing_assets
    run_creatives
    @client.mutations.clear
    @client.videos.each_value do |video|
      video.fetch("attributes")["previewFrameImage"]["state"] = { "state" => "FAILED", "errors" => [{ "code" => "INVALID_TIMECODE" }] }
    end

    error = assert_raises(RuntimeError) { run_creatives }

    assert_match(/Poster processing failed.*INVALID_TIMECODE/, error.message)
    assert_empty @client.mutations
    report = JSON.parse(File.read(File.join(@directory, "report.json")))
    assert_equal "FAILED", report.fetch("assets").first.dig("preview_frame_state", "state")
  end

  def test_search_video_uses_the_same_nested_poster_readiness_contract
    asset = @manifest.fetch("assets").first.merge("placement_type" => "APP_STORE_SEARCH_RESULTS_ASSET", "width" => 1920, "height" => 1280)
    @manifest.fetch("assets") << asset
    File.write(@manifest_path, JSON.generate(@manifest))

    result = run_creatives

    assert_equal 3, result.fetch("assets").length
    assert_equal 6, result.fetch("placements").length
    assert_equal 2, result.fetch("placements").count { |placement| placement.fetch("placement_type") == "APP_STORE_SEARCH_RESULTS_ASSET" }
  end

  def test_rerun_reuses_assets_and_placements
    run_creatives
    @client.mutations.clear
    @uploads.clear
    run_creatives
    assert_empty @client.mutations
    assert_empty @uploads
  end

  def test_poster_only_selection_uploads_a_distinct_video_and_then_reuses_it
    original = run_creatives
    original_videos = JSON.parse(JSON.generate(@client.videos))
    search = @client.seed_placement("en-US", "phone", "existing-search", "APP_STORE_SEARCH_RESULTS_ASSET")
    @manifest.fetch("assets").first["preview_frame_time_code"] = "00:00:16:00"
    File.write(@manifest_path, JSON.generate(@manifest))
    @client.mutations.clear
    @uploads.clear

    updated = run_creatives
    assert_equal 1, @uploads.length
    assert_equal 3, @client.videos.length
    old_en = original.fetch("assets").find { |asset| asset.fetch("locale") == "en-US" }
    new_en = updated.fetch("assets").find { |asset| asset.fetch("locale") == "en-US" }
    assert_equal old_en.fetch("sha256"), new_en.fetch("sha256")
    refute_equal old_en.fetch("id"), new_en.fetch("id")
    assert_equal "00:00:16:00", new_en.fetch("preview_frame_time_code")
    assert_equal "00:00:16:00", @client.videos.fetch(new_en.fetch("id")).dig("attributes", "previewFrameTimeCode")
    original_videos.each { |id, video| assert_equal video, @client.videos.fetch(id) }
    assert_equal original.fetch("placements").select { |placement| placement.fetch("locale") == "es-ES" }, updated.fetch("placements").select { |placement| placement.fetch("locale") == "es-ES" }
    assert updated.fetch("placements").select { |placement| placement.fetch("locale") == "en-US" }.all? { |placement| placement.fetch("asset_id") == new_en.fetch("id") }
    refute @client.mutations.any? { |method, path| method == :delete && path.end_with?(search.fetch("id")) }
    @client.mutations.clear
    @uploads.clear
    run_creatives
    assert_empty @client.mutations
    assert_empty @uploads
  end

  def test_legacy_hash_only_videos_remain_untouched_during_migration
    run_creatives
    @client.videos.each_value do |video|
      video.fetch("attributes")["referenceName"].sub!(/-poster-.*\z/, "")
    end
    legacy_videos = JSON.parse(JSON.generate(@client.videos))
    @client.mutations.clear
    @uploads.clear

    run_creatives
    assert_equal 2, @uploads.length
    assert_equal 4, @client.videos.length
    legacy_videos.each { |id, video| assert_equal video, @client.videos.fetch(id) }
    refute @client.mutations.any? { |method, path| method == :patch && legacy_videos.keys.any? { |id| path.end_with?(id) } }
    @client.mutations.clear
    @uploads.clear
    run_creatives
    assert_empty @client.mutations
    assert_empty @uploads
  end

  def test_preflight_and_noneditable_versions_do_not_mutate
    result = run_creatives(preflight: true)
    assert result.fetch("preflight")
    assert_equal 4, result.fetch("targets").length
    assert_empty @client.mutations
    @client.version_state = "IN_REVIEW"
    assert_match(/not editable/, assert_raises(RuntimeError) { run_creatives }.message)
    assert_empty @client.mutations
  end

  def test_all_uploads_finish_before_replacing_headers_and_preserves_other_slots
    header = @client.seed_placement("en-US", "phone", "previous-video")
    screenshot = @client.seed_placement("en-US", "unrelated", "screenshot", "APP_SCREENSHOT")
    run_creatives
    deletions = @client.mutations.select { |method, _path| method == :delete }.map { |_method, path| path }
    assert_equal ["v1/appAssetLibraryPlacements/#{header.fetch('id')}"], deletions
    refute deletions.include?("v1/appAssetLibraryPlacements/#{screenshot.fetch('id')}")
    first_delete = @client.mutations.index { |method, _path| method == :delete }
    assert_equal 2, @client.mutations.take(first_delete).count { |method, _path| method == :patch }
  end

  def test_processing_failure_preserves_existing_headers
    @client.seed_placement("en-US", "phone", "previous-video")
    @client.processing_failure = true
    assert_match(/processing failed/, assert_raises(RuntimeError) { run_creatives }.message)
    refute @client.mutations.any? { |method, path| method == :delete || path.include?("Placements") }
  end

  def test_ambiguous_placement_failure_is_not_retried
    @client.placement_failure = true
    assert_match(/ambiguous placement failure/, assert_raises(RuntimeError) { run_creatives }.message)
    assert_equal 1, @client.mutations.count { |_method, path| path == "v1/appAssetLibraryPlacements" }
  end

  def select_search_image(alpha: false)
    chunk = ->(type, data) { [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N") }
    bytes = "\x89PNG\r\n\x1a\n".b + chunk.call("IHDR", [1920, 1280, 8, alpha ? 6 : 2, 0, 0, 0].pack("NNC5")) + chunk.call("IDAT", Zlib::Deflate.deflate(("\0" + "\0" * 1920 * (alpha ? 4 : 3)) * 1280)) + chunk.call("IEND", "")
    image = File.join(@directory, "search.png")
    File.binwrite(image, bytes)
    @manifest.fetch("assets") << { "locale" => "en-US", "placement_type" => "APP_STORE_SEARCH_RESULTS_ASSET", "media_type" => "image", "width" => 1920, "height" => 1280, "path" => image, "sha256" => Digest::SHA256.hexdigest(bytes) }
    File.write(@manifest_path, JSON.generate(@manifest))
  end

  def test_search_image_can_be_selected_alongside_header_videos
    select_search_image
    result = run_creatives
    assert_equal 3, result.fetch("assets").length
    assert_equal 6, result.fetch("placements").length
    assert_equal 2, result.fetch("assets").count { |asset| asset.fetch("locale") == "en-US" }
    image = @client.mutations.find { |method, target| method == :post && target == "v1/appAssetLibraryImages" }
    refute image.fetch(2).fetch(:data).fetch(:attributes).key?(:previewFrameTimeCode)
    placements = @client.mutations.select { |method, target| method == :post && target == "v1/appAssetLibraryPlacements" }.map { |entry| entry.fetch(2).fetch(:data) }
    assert_equal 2, placements.count { |entry| entry.fetch(:relationships).key?("image") }
    @client.mutations.clear
    run_creatives
    assert_empty @client.mutations
  end

  def test_rgb_image_can_use_a_specification_that_also_allows_alpha
    select_search_image
    @client.image_alpha_allowed = true
    assert_equal 6, run_creatives.fetch("placements").length
  end

  def test_unselected_search_slot_is_preserved
    @client.seed_placement("en-US", "phone", "existing-search", "APP_STORE_SEARCH_RESULTS_ASSET")
    run_creatives
    refute @client.mutations.any? { |method, _target| method == :delete }
  end

  def test_alpha_image_is_rejected_before_any_api_access
    select_search_image(alpha: true)
    assert_match(/without alpha/, assert_raises(RuntimeError) { run_creatives }.message)
    assert_empty @client.requests
    assert_empty @client.mutations
  end

  def test_checksum_failure_stops_before_any_api_access
    @manifest.fetch("assets").first["sha256"] = "incorrect"
    File.write(@manifest_path, JSON.generate(@manifest))
    assert_match(/checksum differs/, assert_raises(RuntimeError) { run_creatives }.message)
    assert_empty @client.requests
    assert_empty @client.mutations
  end
end
