require "minitest/autorun"
require "openssl"
require_relative "header_assets_api_client"

class HeaderAssetsAPIClientTest < Minitest::Test
  def setup
    @token = Spaceship::ConnectAPI::Token.create(
      key_id: "test-key", issuer_id: "test-issuer",
      key: OpenSSL::PKey::EC.generate("prime256v1").to_pem, in_house: false
    )
    @stubs = Faraday::Adapter::Test::Stubs.new
    @client = HeaderAssetsAPIClient.new(token: @token)
    @client.instance_variable_get(:@client).builder.adapter(:test, @stubs)
    # Exercise the pinned retry implementation without its backoff delay.
    @client.define_singleton_method(:sleep) { |_seconds| }
  end

  %w[appAssetLibraryVideos appAssetLibraryPlacements].each do |resource|
    [Faraday::TimeoutError, Faraday::ConnectionFailed].each do |failure|
      define_method("test_#{resource}_does_not_replay_#{failure.name.split('::').last}") do
        attempts = 0
        @stubs.post("/v1/#{resource}") do
          attempts += 1
          raise failure, "Response lost after Apple accepted the request" if attempts == 1
          [201, { "Content-Type" => "application/json" }, JSON.generate({ data: { type: resource, id: "duplicate" } })]
        end
        assert_raises(failure) { @client.post("v1/#{resource}", { data: { type: resource } }, tries: 1) }
        assert_equal 1, attempts
        @stubs.verify_stubbed_calls
      end
    end
  end

  def test_failed_post_restores_normal_get_retry_behavior
    attempts = 0
    @stubs.post("/v1/appAssetLibraryVideos") { raise Faraday::TimeoutError, "Lost response" }
    assert_raises(Faraday::TimeoutError) { @client.post("v1/appAssetLibraryVideos", { data: {} }, tries: 1) }
    @stubs.get("/v1/apps") do
      attempts += 1
      raise Faraday::ConnectionFailed, "Temporary read failure" if attempts == 1
      [200, { "Content-Type" => "application/json" }, JSON.generate({ data: [{ type: "apps", id: "app" }] })]
    end
    assert_equal "app", @client.get("v1/apps").body.fetch("data").first.fetch("id")
    assert_equal 2, attempts
    @stubs.verify_stubbed_calls
  end

  def test_successful_post_keeps_jwt_middleware_and_json_response_handling
    @token.instance_variable_set(:@expiration, Time.now - 1)
    payload = { data: { type: "appAssetLibraryVideos", attributes: { fileName: "header.mp4" } } }
    @stubs.post("/v1/appAssetLibraryVideos") do |request|
      assert_equal "Bearer #{@token.text}", request.request_headers.fetch("Authorization")
      assert_equal "application/json", request.request_headers.fetch("Content-Type")
      assert_equal JSON.parse(JSON.generate(payload)), JSON.parse(request.body)
      [201, { "Content-Type" => "application/json" }, JSON.generate({ data: { type: "appAssetLibraryVideos", id: "video" } })]
    end
    assert_equal "video", @client.post("v1/appAssetLibraryVideos", payload, tries: 1).body.fetch("data").fetch("id")
    refute @token.expired?
    @stubs.verify_stubbed_calls
  end

  def test_post_does_not_replay_a_server_error_even_if_caller_requests_retries
    attempts = 0
    @stubs.post("/v1/appAssetLibraryVideos") do
      attempts += 1
      status = attempts == 1 ? 500 : 201
      [status, { "Content-Type" => "application/json" }, JSON.generate({ data: { type: "appAssetLibraryVideos", id: "video" } })]
    end
    assert_raises(Spaceship::InternalServerError) { @client.post("v1/appAssetLibraryVideos", { data: {} }, tries: 5) }
    assert_equal 1, attempts
    @stubs.verify_stubbed_calls
  end
end
