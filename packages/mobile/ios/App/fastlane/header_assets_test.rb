require "minitest/autorun"
require "tmpdir"
require_relative "header_assets"

class HeaderAssetsClientFake
  Response = Struct.new(:body)
  attr_reader :mutations, :requests
  attr_accessor :version_state, :processing_failure, :placement_failure, :transient_upload_state

  def initialize(manifest)
    @manifest = manifest
    @mutations = []
    @requests = []
    @videos = {}
    @placements = { "en-US" => [], "es-ES" => [] }
    @version_state = "PREPARE_FOR_SUBMISSION"
  end

  def catalog
    {
      "placementProfileGroups" => [{ "placementProfileGroupId" => "phone", "platform" => "IPHONE_APP_STORE" }, { "placementProfileGroupId" => "tablet", "platform" => "IPAD_APP_STORE" }, { "placementProfileGroupId" => "desktop", "platform" => "MAC_APP_STORE" }],
      "features" => [{ "featureId" => "APP_STORE_VERSIONS", "placementPolicies" => [{ "placementType" => "PRODUCT_PAGE_HEADER_ASSET", "groupLimits" => [{ "groupIds" => %w[phone tablet desktop], "maxCount" => 1 }] }] }],
      "placementTypes" => [{ "placementTypeId" => "PRODUCT_PAGE_HEADER_ASSET", "acceptsAssetCategories" => ["CREATIVE_ASSETS"], "specMappings" => %w[phone tablet desktop].map { |group| { "placementGroupId" => group, "specs" => ["header-video"] } } }],
      "videoSpecs" => [{ "specId" => "header-video", "compatiblePlacementTypes" => ["PRODUCT_PAGE_HEADER_ASSET"], "dimensions" => { "minWidth" => 3840, "maxWidth" => 3840, "minHeight" => 1646, "maxHeight" => 1646 }, "fileExtensions" => [".mp4"], "audioRequired" => false, "frameRates" => [{ "minFps" => 60, "maxFps" => 60 }], "duration" => { "min" => "PT5S", "max" => "PT30S" }, "maxFileSize" => 20_000_000 }]
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
           when "v1/appAssetLibraries/library/videos" then @videos.values.select { |video| video.dig("attributes", "referenceName") == params.fetch(:filter).fetch(:referenceName) }
           when %r{\Av1/appAssetLibraryVideos/(.+)\z}
             video = @videos.fetch(Regexp.last_match(1))
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
    item = if path == "v1/appAssetLibraryVideos"
             id = data.fetch(:attributes).fetch(:fileName)
             attributes = data.fetch(:attributes).transform_keys(&:to_s).merge("state" => "AWAITING_UPLOAD", "specId" => "header-video", "previewFrameImage" => { "state" => "COMPLETE" }, "uploadOperations" => [{ "method" => "PUT", "url" => "https://upload.example.test/part", "offset" => 0, "length" => data.fetch(:attributes).fetch(:fileSize), "requestHeaders" => [{ "name" => "Content-Type", "value" => "video/mp4" }] }])
             @videos[id] = { "id" => id, "attributes" => attributes }
           elsif path == "v1/appAssetLibraryPlacements"
             raise "Simulated ambiguous placement failure" if @placement_failure
             locale = data.fetch(:relationships).fetch(:appStoreVersionLocalization).fetch(:data).fetch(:id)
             item = { "id" => "new-#{@mutations.length}", "attributes" => data.fetch(:attributes).transform_keys(&:to_s), "relationships" => { "video" => { "data" => { "id" => data.fetch(:relationships).fetch(:video).fetch(:data).fetch(:id) } } } }
             @placements.fetch(locale) << item
             item
           else raise "Unexpected POST: #{path}"
           end
    Response.new({ "data" => item })
  end

  def patch(path, body)
    @mutations << [:patch, path, body]
    @videos.fetch(path.split('/').last).fetch("attributes")["state"] = "PREPARE_FOR_SUBMISSION"
    Response.new({})
  end

  def delete(path)
    @mutations << [:delete, path]
    @placements.each_value { |items| items.reject! { |item| item.fetch("id") == path.split('/').last } }
    Response.new({})
  end
end

class HeaderAssetsTest < Minitest::Test
  def setup
    @directory = Dir.mktmpdir("trizum-header-test")
    @manifest = JSON.parse(File.read(File.join(__dir__, "creative_assets/header.json")))
    @manifest.fetch("assets").each { |asset| asset["path"] = File.expand_path(asset.fetch("path"), File.join(__dir__, "creative_assets")) }
    @manifest_path = File.join(@directory, "header.json")
    File.write(@manifest_path, JSON.generate(@manifest))
    @client = HeaderAssetsClientFake.new(@manifest)
    @uploads = []
  end

  def teardown
    FileUtils.remove_entry(@directory)
  end

  def run_headers(preflight: false)
    http = Object.new
    uploads = @uploads
    http.define_singleton_method(:request) do |request|
      uploads << request
      Net::HTTPOK.new("1.1", "200", "OK")
    end
    transport = Object.new
    transport.define_singleton_method(:start) { |*_arguments, **_options, &block| block.call(http) }
    HeaderAssets.new(client: @client, manifest: @manifest_path, report: File.join(@directory, "report.json"), log: ->(_message) {}, http: transport).run(version: "1.14.0", preflight: preflight)
  end

  def test_uploads_exact_approved_bytes_without_api_token_and_places_both_locales
    result = run_headers
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

  def test_freshly_committed_upload_can_briefly_report_awaiting_upload
    @client.transient_upload_state = true
    result = run_headers
    assert_equal 4, result.fetch("placements").length
  end

  def test_rerun_reuses_assets_and_placements
    run_headers
    @client.mutations.clear
    @uploads.clear
    run_headers
    assert_empty @client.mutations
    assert_empty @uploads
  end

  def test_preflight_and_noneditable_versions_do_not_mutate
    run_headers(preflight: true)
    assert_empty @client.mutations
    @client.version_state = "IN_REVIEW"
    assert_match(/not editable/, assert_raises(RuntimeError) { run_headers }.message)
    assert_empty @client.mutations
  end

  def test_all_uploads_finish_before_replacing_headers_and_preserves_other_slots
    header = @client.seed_placement("en-US", "phone", "previous-video")
    screenshot = @client.seed_placement("en-US", "unrelated", "screenshot", "APP_SCREENSHOT")
    run_headers
    deletions = @client.mutations.select { |method, _path| method == :delete }.map { |_method, path| path }
    assert_equal ["v1/appAssetLibraryPlacements/#{header.fetch('id')}"], deletions
    refute deletions.include?("v1/appAssetLibraryPlacements/#{screenshot.fetch('id')}")
    first_delete = @client.mutations.index { |method, _path| method == :delete }
    assert_equal 2, @client.mutations.take(first_delete).count { |method, _path| method == :patch }
  end

  def test_processing_failure_preserves_existing_headers
    @client.seed_placement("en-US", "phone", "previous-video")
    @client.processing_failure = true
    assert_match(/processing failed/, assert_raises(RuntimeError) { run_headers }.message)
    refute @client.mutations.any? { |method, path| method == :delete || path.include?("Placements") }
  end

  def test_ambiguous_placement_failure_is_not_retried
    @client.placement_failure = true
    assert_match(/ambiguous placement failure/, assert_raises(RuntimeError) { run_headers }.message)
    assert_equal 1, @client.mutations.count { |_method, path| path == "v1/appAssetLibraryPlacements" }
  end

  def test_checksum_failure_stops_before_any_api_access
    @manifest.fetch("assets").first["sha256"] = "incorrect"
    File.write(@manifest_path, JSON.generate(@manifest))
    assert_match(/checksum differs/, assert_raises(RuntimeError) { run_headers }.message)
    assert_empty @client.requests
    assert_empty @client.mutations
  end
end
